import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { KV_STORE, KvStore } from '../store/kv.types';
import { IdempotencyService } from './idempotency.service';

function mockKv(): jest.Mocked<KvStore> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    setIfAbsent: jest.fn(),
    del: jest.fn(),
  };
}

describe('IdempotencyService', () => {
  let kv: jest.Mocked<KvStore>;
  let svc: IdempotencyService;

  beforeEach(async () => {
    kv = mockKv();
    const moduleRef = await Test.createTestingModule({
      providers: [IdempotencyService, { provide: KV_STORE, useValue: kv }],
    }).compile();
    svc = moduleRef.get(IdempotencyService);
  });

  it('without a key runs the producer directly (no idempotency)', async () => {
    const r = await svc.run('tenant', undefined, async () => 'result');
    expect(r).toBe('result');
    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.setIfAbsent).not.toHaveBeenCalled();
  });

  it('returns the cached result without calling the producer', async () => {
    kv.get.mockResolvedValue(JSON.stringify({ done: true, result: 'cached' }));
    const producer = jest.fn();
    const r = await svc.run('tenant', 'key', producer as never);
    expect(r).toBe('cached');
    expect(producer).not.toHaveBeenCalled();
  });

  it('throws Conflict when a request is already in progress', async () => {
    kv.get.mockResolvedValue(JSON.stringify({ done: false }));
    await expect(
      svc.run('tenant', 'key', async () => 'x'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('acquires the lock, runs the producer and caches the result', async () => {
    kv.get.mockResolvedValue(null);
    kv.setIfAbsent.mockResolvedValue(true);
    const r = await svc.run('tenant', 'key', async () => 'fresh');
    expect(r).toBe('fresh');
    expect(kv.setIfAbsent).toHaveBeenCalledWith(
      'idem:tenant:key',
      expect.any(String),
      expect.any(Number),
    );
    expect(kv.set).toHaveBeenCalledWith(
      'idem:tenant:key',
      expect.stringContaining('fresh'),
      expect.any(Number),
    );
  });

  it('lost-lock race throws Conflict when the other run is not done yet', async () => {
    kv.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ done: false }));
    kv.setIfAbsent.mockResolvedValue(false);
    await expect(
      svc.run('tenant', 'key', async () => 'x'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('releases the lock and rethrows when the producer fails', async () => {
    kv.get.mockResolvedValue(null);
    kv.setIfAbsent.mockResolvedValue(true);
    const err = new Error('upstream boom');
    await expect(
      svc.run('tenant', 'key', async () => {
        throw err;
      }),
    ).rejects.toBe(err);
    expect(kv.del).toHaveBeenCalledWith('idem:tenant:key');
  });

  it('a result-cache failure does not turn a settled result into an error', async () => {
    kv.get.mockResolvedValue(null);
    kv.setIfAbsent.mockResolvedValue(true);
    kv.set.mockRejectedValue(new Error('cache down'));
    const r = await svc.run('tenant', 'key', async () => 'ok');
    expect(r).toBe('ok');
  });
});
