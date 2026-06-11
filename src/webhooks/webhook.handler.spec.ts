import { Test } from '@nestjs/testing';
import { KV_STORE, KvStore } from '../store/kv.types';
import { WebhookHandler } from './webhook.handler';

function mockKv(): jest.Mocked<KvStore> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    setIfAbsent: jest.fn(),
    del: jest.fn(),
  };
}

describe('WebhookHandler', () => {
  let kv: jest.Mocked<KvStore>;
  let handler: WebhookHandler;

  beforeEach(async () => {
    kv = mockKv();
    const moduleRef = await Test.createTestingModule({
      providers: [WebhookHandler, { provide: KV_STORE, useValue: kv }],
    }).compile();
    handler = moduleRef.get(WebhookHandler);
  });

  it('accepts a fresh event and dedups by eventRef', async () => {
    kv.setIfAbsent.mockResolvedValue(true);
    const r = await handler.handle({ eventRef: 'e1', eventType: 'STATUS_CHG' });
    expect(r).toEqual({ status: 'accepted' });
    expect(kv.setIfAbsent).toHaveBeenCalledWith(
      'wh:e1',
      '1',
      expect.any(Number),
    );
  });

  it('returns duplicate when the eventRef was already seen', async () => {
    kv.setIfAbsent.mockResolvedValue(false);
    const r = await handler.handle({ eventRef: 'e1' });
    expect(r).toEqual({ status: 'duplicate' });
  });

  it('falls back to notificationId when eventRef is missing', async () => {
    kv.setIfAbsent.mockResolvedValue(true);
    await handler.handle({ notificationId: 'n1' });
    expect(kv.setIfAbsent).toHaveBeenCalledWith(
      'wh:n1',
      '1',
      expect.any(Number),
    );
  });

  it('accepts (without a dedup key) when there is no ref at all', async () => {
    const r = await handler.handle({});
    expect(r).toEqual({ status: 'accepted' });
    expect(kv.setIfAbsent).not.toHaveBeenCalled();
  });
});
