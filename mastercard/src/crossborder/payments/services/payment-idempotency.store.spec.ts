import {
  ConflictException,
  HttpException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { UpstreamUnavailableException } from '../../../common/utils/upstream.exception';
import { PaymentIdempotencyEntity } from '../entities/payment-idempotency.entity';
import { PaymentIdempotencyStore } from './payment-idempotency.store';

function makeRepo() {
  return {
    query: jest.fn(),
    findOne: jest.fn(),
    // complete() reads res.affected — default to a normal 1-row update.
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => undefined),
    count: jest.fn(async () => 0),
  };
}

function makeStore(repo: ReturnType<typeof makeRepo>): PaymentIdempotencyStore {
  return new PaymentIdempotencyStore(
    repo as unknown as Repository<PaymentIdempotencyEntity>,
  );
}

const FP = 'fp-body';
const TOK = 'tok-1'; // the per-claim lock token acquire() returns via RETURNING "lockToken"

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
    repo.query.mockResolvedValue([{ lockToken: TOK }]); // slot claimed
    const producer = jest.fn(async () => ({ paymentId: 'P1' }));
    const r = await makeStore(repo).run('t1', 'k1', producer, FP);
    expect(r).toEqual({ paymentId: 'P1' });
    expect(repo.update).toHaveBeenCalledWith(
      { lockToken: TOK },
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
    repo.findOne.mockResolvedValue({
      done: false,
      result: null,
      fingerprint: FP,
    });
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
    repo.query.mockResolvedValue([{ lockToken: TOK }]);
    const err = new HttpException('bad', 400);
    await expect(
      makeStore(repo).run(
        't1',
        'k1',
        async () => {
          throw err;
        },
        FP,
      ),
    ).rejects.toBe(err);
    expect(repo.delete).toHaveBeenCalledWith({
      lockToken: TOK,
      done: false,
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('producer 5xx → slot NOT released (fail-safe against double charges)', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([{ lockToken: TOK }]);
    const err = new HttpException('upstream', 502);
    await expect(
      makeStore(repo).run(
        't1',
        'k1',
        async () => {
          throw err;
        },
        FP,
      ),
    ).rejects.toBe(err);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('producer 401/403 (UpstreamUnavailable executed=no) → slot RELEASED (payment did not run)', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([{ lockToken: TOK }]);
    const err = new UpstreamUnavailableException('no');
    await expect(
      makeStore(repo).run(
        't1',
        'k1',
        async () => {
          throw err;
        },
        FP,
      ),
    ).rejects.toBe(err);
    expect(repo.delete).toHaveBeenCalledWith({
      lockToken: TOK,
      done: false,
    });
  });

  it('producer 5xx/network (UpstreamUnavailable executed=unknown) → slot NOT released', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([{ lockToken: TOK }]);
    const err = new UpstreamUnavailableException('unknown');
    await expect(
      makeStore(repo).run(
        't1',
        'k1',
        async () => {
          throw err;
        },
        FP,
      ),
    ).rejects.toBe(err);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('network error (not HttpException) → slot NOT released', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([{ lockToken: TOK }]);
    await expect(
      makeStore(repo).run(
        't1',
        'k1',
        async () => {
          throw new Error('ECONNRESET');
        },
        FP,
      ),
    ).rejects.toThrow('ECONNRESET');
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('a failed result write does NOT turn a successful payment into an error', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([{ lockToken: TOK }]);
    repo.update.mockRejectedValue(new Error('db down'));
    const r = await makeStore(repo).run(
      't1',
      'k1',
      async () => ({ paymentId: 'P9' }),
      FP,
    );
    expect(r).toEqual({ paymentId: 'P9' });
  });

  // The result write is scoped to OUR lockToken. If the slot went stale and was re-claimed by
  // another caller mid-flight, our update matches zero rows: the payment still returns, but the
  // zero-row case is logged loudly because it means two producers reached Mastercard for one ref.
  it('result write matches zero rows (lock reclaimed) → still returns, logs a duplicate warning', async () => {
    const repo = makeRepo();
    repo.query.mockResolvedValue([{ lockToken: TOK }]);
    repo.update.mockResolvedValue({ affected: 0 });
    const errSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const r = await makeStore(repo).run(
      't1',
      'k1',
      async () => ({ paymentId: 'P0' }),
      FP,
    );
    expect(r).toEqual({ paymentId: 'P0' });
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('possible duplicate submission'),
    );
    errSpy.mockRestore();
  });
});
