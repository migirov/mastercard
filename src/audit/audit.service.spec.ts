import { Repository } from 'typeorm';
import { AuditEntry, AuditService } from './audit.service';
import { AuditLogEntity } from './audit-log.entity';

// Управляемый fake-репозиторий: insert возвращает промис, который мы резолвим
// вручную, чтобы держать flush «в полёте» и проверять re-entrancy.
function deferred<T = void>() {
  let resolve!: (v?: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res as (v?: T) => void;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const entry = (i = 0): AuditEntry => ({
  ts: new Date(0).toISOString(),
  method: 'GET',
  path: `/p/${i}`,
  status: 200,
  ms: 1,
});

describe('AuditService', () => {
  let repo: { insert: jest.Mock };
  let svc: AuditService;

  beforeEach(() => {
    repo = { insert: jest.fn().mockResolvedValue(undefined) };
    svc = new AuditService(repo as unknown as Repository<AuditLogEntity>);
    jest.spyOn(svc['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(svc['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(svc['logger'], 'error').mockImplementation(() => undefined);
  });

  const fill = (n: number) => {
    for (let i = 0; i < n; i++) svc.record(entry(i));
  };

  it('re-entrancy: a flush in flight is not started twice (no double insert)', async () => {
    const d = deferred();
    repo.insert.mockReturnValueOnce(d.promise); // первый flush «зависает»

    fill(100); // 100-я запись триггерит flush → insert вызван 1 раз, буфер пуст
    expect(repo.insert).toHaveBeenCalledTimes(1);

    fill(100); // буфер снова 100 → триггер flush, но он ещё в полёте → no-op
    expect(repo.insert).toHaveBeenCalledTimes(1); // не вызван повторно

    d.resolve(); // завершаем первый insert → гард снят
    await Promise.resolve();
    await Promise.resolve();
    // следующий флаш добивает накопленные 100
    await svc.recent().catch(() => undefined);
    expect(repo.insert).toHaveBeenCalledTimes(2);
  });

  it('recent(): двойной флаш — пишет записи, добавленные во время in-flight флаша', async () => {
    repo.insert = jest.fn().mockResolvedValue(undefined) as never;
    (repo.insert as jest.Mock).mockImplementationOnce(() => {
      // во время ПЕРВОГО insert прилетает ещё запись
      svc.record(entry(999));
      return Promise.resolve();
    });
    // @ts-expect-error: find не нужен для проверки — заглушаем
    repo.find = jest.fn().mockResolvedValue([]);

    fill(100); // flush #1 (внутри добавится 1 запись)
    await svc.recent(); // должен добить «хвост» вторым флашем
    // insert вызван дважды: основной батч + хвостовая запись
    expect((repo.insert as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('capBuffer: переполнение сбрасывает САМЫЕ СТАРЫЕ и логирует drop', async () => {
    const d = deferred();
    repo.insert.mockReturnValueOnce(d.promise); // держим флаш в полёте

    fill(100); // flush #1 в полёте, буфер пуст
    fill(1001); // буфер растёт > MAX_RETAINED(1000) → дроп старейших
    expect(svc['logger'].warn).toHaveBeenCalledWith(
      expect.stringContaining('dropped'),
    );
    d.resolve();
  });

  it('insert failure: батч возвращается в буфер для повторной попытки', async () => {
    repo.insert.mockRejectedValueOnce(new Error('db down'));
    fill(100); // flush падает → unshift обратно
    await Promise.resolve();
    await Promise.resolve();
    // следующий успешный флаш переотправит тот же батч
    await svc.recent().catch(() => undefined);
    expect(repo.insert.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('backoff: после провала НЕпринудительный флаш пропускается в окне; force (recent/shutdown) его игнорирует', async () => {
    // @ts-expect-error: find заглушаем для recent()
    repo.find = jest.fn().mockResolvedValue([]);
    repo.insert.mockRejectedValueOnce(new Error('db down')); // 1-й insert падает

    fill(100); // MAX_BUFFER → flush #1 → insert #1 → fail → backoff (~2с), батч возвращён
    await Promise.resolve();
    await Promise.resolve();
    expect(repo.insert).toHaveBeenCalledTimes(1);

    // НЕпринудительный флаш в окне backoff (record при >=100) → пропускается
    svc.record(entry(101));
    await Promise.resolve();
    await Promise.resolve();
    expect(repo.insert).toHaveBeenCalledTimes(1); // не вызван — backoff

    // recent() форсит флаш мимо backoff → вставка проходит
    await svc.recent();
    expect(repo.insert).toHaveBeenCalledTimes(2);
  });
});
