import { Test } from '@nestjs/testing';
import { sha256hex } from '../../common/utils/crypto.util';
import { EncryptionService } from '../../encryption/services/encryption.service';
import { TenantRegistry } from '../../tenants/services/tenant.registry';
import { TransactionStatusStore } from './transaction-status.store';
import { WebhookHandler } from './webhook.handler';

describe('WebhookHandler', () => {
  let statusStore: { record: jest.Mock };
  let tenants: { findOwnTenantIdByPartnerId: jest.Mock };
  let encryption: { decryptPush: jest.Mock };
  let handler: WebhookHandler;

  beforeEach(async () => {
    statusStore = { record: jest.fn(async () => true) };
    tenants = { findOwnTenantIdByPartnerId: jest.fn(async () => null) };
    // By default a push cannot be decrypted (no key / FLE off) → the persist path.
    encryption = { decryptPush: jest.fn(() => undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhookHandler,
        { provide: TransactionStatusStore, useValue: statusStore },
        { provide: TenantRegistry, useValue: tenants },
        { provide: EncryptionService, useValue: encryption },
      ],
    }).compile();
    handler = moduleRef.get(WebhookHandler);
  });

  describe('status events → persist with atomic dedup', () => {
    it('STATUS_CHG (fresh) → record + accepted', async () => {
      statusStore.record.mockResolvedValue(true);
      const r = await handler.handle({
        eventRef: 'e1',
        eventType: 'STATUS_CHG',
        transactionReference: 'TX1',
      });
      expect(r).toEqual({ status: 'accepted' });
      expect(statusStore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventRef: 'e1',
          eventType: 'STATUS_CHG',
          transactionReference: 'TX1',
        }),
      );
    });

    it('STATUS_CHG (duplicate: record=false) → duplicate', async () => {
      statusStore.record.mockResolvedValue(false);
      const r = await handler.handle({
        eventRef: 'e1',
        eventType: 'STATUS_CHG',
      });
      expect(r).toEqual({ status: 'duplicate' });
    });

    it('tenant attribution: OWN partnerId resolves to tenantId', async () => {
      tenants.findOwnTenantIdByPartnerId.mockResolvedValue('own-1');
      await handler.handle({
        eventRef: 'e2',
        eventType: 'QUOTE_STATUS_CHG',
        partnerId: 'OWN_PID',
      });
      expect(tenants.findOwnTenantIdByPartnerId).toHaveBeenCalledWith(
        'OWN_PID',
      );
      expect(statusStore.record).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'own-1' }),
      );
    });

    it('PLATFORM/unknown partnerId → shared pool (tenantId=null)', async () => {
      tenants.findOwnTenantIdByPartnerId.mockResolvedValue(null);
      await handler.handle({
        eventRef: 'e3',
        eventType: 'STATUS_CHG',
        partnerId: 'SHARED',
      });
      expect(statusStore.record).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: null }),
      );
    });

    it('snake_case notation (event_type/event_ref/...) is normalized', async () => {
      await handler.handle({
        event_ref: 'snake-1',
        event_type: 'STATUS_CHG',
        transaction_reference: 'TXS',
      } as never);
      expect(statusStore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventRef: 'snake-1',
          transactionReference: 'TXS',
        }),
      );
    });

    it('pulls status/stage from quote.confirmStatus', async () => {
      await handler.handle({
        eventRef: 'e4',
        eventType: 'STATUS_CHG',
        quote: {
          confirmStatus: { status: 'PENDING', pendingStage: 'Expired' },
        },
      } as never);
      expect(statusStore.record).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING', stage: 'Expired' }),
      );
    });
  });

  describe('non-status events → atomic dedup in Postgres', () => {
    it('CARDFX_PUB (snake_case) → record by event_ref, tenantId=null', async () => {
      statusStore.record.mockResolvedValue(true);
      const r = await handler.handle({
        event_ref: 'cf1',
        event_type: 'CARDFX_PUB',
      } as never);
      expect(r).toEqual({ status: 'accepted' });
      expect(statusStore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventRef: 'cf1',
          eventType: 'CARDFX_PUB',
          tenantId: null,
        }),
      );
    });

    it('duplicate when record=false (eventRef already seen)', async () => {
      statusStore.record.mockResolvedValue(false);
      const r = await handler.handle({
        eventRef: 'x1',
        eventType: 'CARDFX_PUB',
      });
      expect(r).toEqual({ status: 'duplicate' });
    });

    it('falls back to notificationId when eventRef is absent', async () => {
      statusStore.record.mockResolvedValue(true);
      await handler.handle({ notificationId: 'n1', eventType: 'CARDFX_PUB' });
      expect(statusStore.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventRef: 'n1' }),
      );
    });

    it('accepted without dedup/persist when there is no ref at all', async () => {
      const r = await handler.handle({ eventType: 'CARDFX_PUB' });
      expect(r).toEqual({ status: 'accepted' });
      expect(statusStore.record).not.toHaveBeenCalled();
    });

    it('empty/undefined body → accepted (no 500)', async () => {
      await expect(handler.handle(undefined as never)).resolves.toEqual({
        status: 'accepted',
      });
      await expect(handler.handle(null as never)).resolves.toEqual({
        status: 'accepted',
      });
      expect(statusStore.record).not.toHaveBeenCalled();
    });
  });

  describe('encrypted push → decrypt by kid, else persist before ack', () => {
    it('decrypts to a STATUS event → processed (recorded with status, not ENCRYPTED)', async () => {
      encryption.decryptPush.mockReturnValue({
        eventRef: 'd1',
        eventType: 'STATUS_CHG',
        transactionReference: 'TXD',
        status: 'COMPLETED',
      });
      const r = await handler.handle({
        encrypted_payload: { data: 'JWE' },
      } as never);
      expect(r).toEqual({ status: 'accepted' });
      expect(statusStore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventRef: 'd1',
          eventType: 'STATUS_CHG',
          transactionReference: 'TXD',
          status: 'COMPLETED',
        }),
      );
    });

    it('persisted to tx_status (eventType=ENCRYPTED, tenantId=null) when undecryptable → accepted', async () => {
      statusStore.record.mockResolvedValue(true);
      const r = await handler.handle({
        encrypted_payload: { data: 'JWE...' },
      } as never);
      expect(r).toEqual({ status: 'accepted' });
      expect(statusStore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ENCRYPTED',
          tenantId: null,
          payload: expect.objectContaining({
            encrypted_payload: { data: 'JWE...' },
          }),
        }),
      );
    });

    it('dedup key = enc:sha256(ciphertext) when there is no outer ref', async () => {
      statusStore.record.mockResolvedValue(true);
      await handler.handle({ encrypted_payload: { data: 'CIPHER' } } as never);
      expect(statusStore.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventRef: `enc:${sha256hex('CIPHER')}` }),
      );
    });

    it('a top-level ref (outside the cipher) is used as the key when present', async () => {
      statusStore.record.mockResolvedValue(true);
      await handler.handle({
        eventRef: 'OUTER1',
        encrypted_payload: { data: 'X' },
      } as never);
      expect(statusStore.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventRef: 'OUTER1', eventType: 'ENCRYPTED' }),
      );
    });

    it('an EMPTY outer ref is not used → key = enc:sha256(data) (no collision)', async () => {
      statusStore.record.mockResolvedValue(true);
      await handler.handle({
        eventRef: '',
        notificationId: '   ',
        encrypted_payload: { data: 'C2' },
      } as never);
      expect(statusStore.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventRef: `enc:${sha256hex('C2')}` }),
      );
    });

    it('retry of an already-stored envelope (record=false) → duplicate', async () => {
      statusStore.record.mockResolvedValue(false);
      const r = await handler.handle({
        encrypted_payload: { data: 'JWE...' },
      } as never);
      expect(r).toEqual({ status: 'duplicate' });
    });

    it('a persist failure is NOT swallowed → throws (→ 500 → MC retries, no ack)', async () => {
      statusStore.record.mockRejectedValue(new Error('db down'));
      await expect(
        handler.handle({ encrypted_payload: { data: 'JWE...' } } as never),
      ).rejects.toThrow('db down');
    });
  });
});
