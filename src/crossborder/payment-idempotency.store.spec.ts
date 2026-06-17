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
  it('no key → producer directly, DB untouched', async () => {
    const repo = makeRepo();
    const producer = jest.fn(async () => ({ ok: 1 }));
    const r = await makeStore(repo).run('t1', undefined, producer, FP);
    expect(r).toEqual({ ok: 1 });
    expect(producer).toHaveBeenCalledTimes(1);
    expect(repo.query).not.toHaveBeenCalled();
  });

  it('fresh claim + success → records the result (done=true) and returns it', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([{ id: 1 }]); // slot claimed
    const producer = jest.fn(async () => ({ paymentId: 'P1' }));
    const r = await makeStore(repo).run('t1', 'k1', producer, FP);
    expect(r).toEqual({ paymentId: 'P1' });
    expect(repo.update).toHaveBeenCalledWith(
      { tenantId: 't1', idemKey: 'k1' },
      expect.objectContaining({ done: true }),
    );
  });

  it('claim failed + row done → return the cache, MC not called', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([]); // slot taken
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

  it('claim failed + row in-progress → 409', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([]);
    repo.findOne.mockResolvedValue({ done: false, result: null, fingerprint: FP });
    await expect(
      makeStore(repo).run('t1', 'k1', jest.fn(), FP),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('same key, DIFFERENT body → 422', async () => {
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

  it('claim failed + row vanished (race) → 409', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([]);
    repo.findOne.mockResolvedValue(null);
    await expect(
      makeStore(repo).run('t1', 'k1', jest.fn(), FP),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('producer 4xx → releases the slot (delete), error propagates', async () => {
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

  it('producer 5xx → slot NOT released (fail-safe against double charges)', async () => {
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

  it('network error (not HttpException) → slot NOT released', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([{ id: 1 }]);
    await expect(
      makeStore(repo).run('t1', 'k1', async () => {
        throw new Error('ECONNRESET');
      }, FP),
    ).rejects.toThrow('ECONNRESET');
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('a failed result write does NOT turn a successful payment into an error', async () => {
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
