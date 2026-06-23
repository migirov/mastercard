import { Repository } from 'typeorm';
import { AuditEntry, AuditService } from './audit.service';
import { AuditLogEntity } from '../entities/audit-log.entity';

// A controllable fake repository: insert returns a promise we resolve manually,
// to keep a flush "in flight" and test re-entrancy.
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
    repo.insert.mockReturnValueOnce(d.promise); // the first flush "hangs"

    fill(100); // the 100th record triggers flush → insert called once, buffer empty
    expect(repo.insert).toHaveBeenCalledTimes(1);

    fill(100); // buffer is 100 again → triggers flush, but it's still in flight → no-op
    expect(repo.insert).toHaveBeenCalledTimes(1); // not called again

    d.resolve(); // complete the first insert → guard released
    await Promise.resolve();
    await Promise.resolve();
    // the next flush drains the accumulated 100
    await svc.recent().catch(() => undefined);
    expect(repo.insert).toHaveBeenCalledTimes(2);
  });

  it('recent(): двойной флаш — пишет записи, добавленные во время in-flight флаша', async () => {
    repo.insert = jest.fn().mockResolvedValue(undefined) as never;
    (repo.insert as jest.Mock).mockImplementationOnce(() => {
      // during the FIRST insert one more record arrives
      svc.record(entry(999));
      return Promise.resolve();
    });
    // @ts-expect-error: find isn't needed for the check — stub it
    repo.find = jest.fn().mockResolvedValue([]);

    fill(100); // flush #1 (one record is added inside it)
    await svc.recent(); // should drain the "tail" with a second flush
    // insert called twice: the main batch + the tail record
    expect((repo.insert as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('capBuffer: переполнение сбрасывает САМЫЕ СТАРЫЕ и логирует drop', async () => {
    const d = deferred();
    repo.insert.mockReturnValueOnce(d.promise); // keep the flush in flight

    fill(100); // flush #1 in flight, buffer empty
    fill(1001); // buffer grows > MAX_RETAINED(1000) → drop the oldest
    expect(svc['logger'].warn).toHaveBeenCalledWith(
      expect.stringContaining('dropped'),
    );
    d.resolve();
  });

  it('insert failure: батч возвращается в буфер для повторной попытки', async () => {
    repo.insert.mockRejectedValueOnce(new Error('db down'));
    fill(100); // flush fails → unshift back
    await Promise.resolve();
    await Promise.resolve();
    // the next successful flush re-sends the same batch
    await svc.recent().catch(() => undefined);
    expect(repo.insert.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('backoff: после провала НЕпринудительный флаш пропускается в окне; force (recent/shutdown) его игнорирует', async () => {
    // @ts-expect-error: stub find for recent()
    repo.find = jest.fn().mockResolvedValue([]);
    repo.insert.mockRejectedValueOnce(new Error('db down')); // the 1st insert fails

    fill(100); // MAX_BUFFER → flush #1 → insert #1 → fail → backoff (~2s), batch returned
    await Promise.resolve();
    await Promise.resolve();
    expect(repo.insert).toHaveBeenCalledTimes(1);

    // a non-forced flush inside the backoff window (record at >=100) → skipped
    svc.record(entry(101));
    await Promise.resolve();
    await Promise.resolve();
    expect(repo.insert).toHaveBeenCalledTimes(1); // not called — backoff

    // recent() forces a flush past the backoff → the insert goes through
    await svc.recent();
    expect(repo.insert).toHaveBeenCalledTimes(2);
  });
});
