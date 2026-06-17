import {
  ConflictException,
  HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { PaymentIdempotencyEntity } from './payment-idempotency.entity';
import { PaymentIdempotencyStore } from './payment-idempotency.store';

function makeRepo() {
  return {
    query: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
  };
}

function makeStore(repo: ReturnType<typeof makeRepo>): PaymentIdempotencyStore {
  return new PaymentIdempotencyStore(
    repo as unknown as Repository<PaymentIdempotencyEntity>,
  );
}

const FP = 'fp-body';

describe('PaymentIdempotencyStore', () => {
  it('без ключа → producer напрямую, БД не трогаем', async () => {
    const repo = makeRepo();
    const producer = jest.fn(async () => ({ ok: 1 }));
    const r = await makeStore(repo).run('t1', undefined, producer, FP);
    expect(r).toEqual({ ok: 1 });
    expect(producer).toHaveBeenCalledTimes(1);
    expect(repo.query).not.toHaveBeenCalled();
  });

  it('свежий захват + успех → фиксируем результат (done=true) и возвращаем', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([{ id: 1 }]); // захватили слот
    const producer = jest.fn(async () => ({ paymentId: 'P1' }));
    const r = await makeStore(repo).run('t1', 'k1', producer, FP);
    expect(r).toEqual({ paymentId: 'P1' });
    expect(repo.update).toHaveBeenCalledWith(
      { tenantId: 't1', idemKey: 'k1' },
      expect.objectContaining({ done: true }),
    );
  });

  it('захват не удался + запись done → отдаём кэш, MC не зовём', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([]); // слот занят
    repo.findOne.mockResolvedValue({
      done: true,
      result: { paymentId: 'CACHED' },
      fingerprint: FP,
    });
    const producer = jest.fn();
    const r = await makeStore(repo).run('t1', 'k1', producer, FP);
    expect(r).toEqual({ paymentId: 'CACHED' });
    expect(producer).not.toHaveBeenCalled();
  });

  it('захват не удался + запись in-progress → 409', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([]);
    repo.findOne.mockResolvedValue({ done: false, result: null, fingerprint: FP });
    await expect(
      makeStore(repo).run('t1', 'k1', jest.fn(), FP),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('тот же ключ, ДРУГОЕ тело → 422', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([]);
    repo.findOne.mockResolvedValue({
      done: true,
      result: { x: 1 },
      fingerprint: 'OTHER',
    });
    await expect(
      makeStore(repo).run('t1', 'k1', jest.fn(), FP),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('захват не удался + запись исчезла (гонка) → 409', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([]);
    repo.findOne.mockResolvedValue(null);
    await expect(
      makeStore(repo).run('t1', 'k1', jest.fn(), FP),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('producer 4xx → освобождаем слот (delete), ошибка пробрасывается', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([{ id: 1 }]);
    const err = new HttpException('bad', 400);
    await expect(
      makeStore(repo).run('t1', 'k1', async () => {
        throw err;
      }, FP),
    ).rejects.toBe(err);
    expect(repo.delete).toHaveBeenCalledWith({
      tenantId: 't1',
      idemKey: 'k1',
      done: false,
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('producer 5xx → слот НЕ освобождаем (fail-safe против двойного списания)', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([{ id: 1 }]);
    const err = new HttpException('upstream', 502);
    await expect(
      makeStore(repo).run('t1', 'k1', async () => {
        throw err;
      }, FP),
    ).rejects.toBe(err);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('сетевая ошибка (не HttpException) → слот НЕ освобождаем', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([{ id: 1 }]);
    await expect(
      makeStore(repo).run('t1', 'k1', async () => {
        throw new Error('ECONNRESET');
      }, FP),
    ).rejects.toThrow('ECONNRESET');
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('сбой записи результата НЕ превращает успешный платёж в ошибку', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([{ id: 1 }]);
    repo.update.mockRejectedValue(new Error('db down'));
    const r = await makeStore(repo).run(
      't1',
      'k1',
      async () => ({ paymentId: 'P9' }),
      FP,
    );
    expect(r).toEqual({ paymentId: 'P9' });
  });
});
