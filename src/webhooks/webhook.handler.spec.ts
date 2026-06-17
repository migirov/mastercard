import { Test } from '@nestjs/testing';
import { TenantRegistry } from '../tenants/tenant.registry';
import { TransactionStatusStore } from './transaction-status.store';
import { WebhookHandler } from './webhook.handler';

describe('WebhookHandler', () => {
  let statusStore: { record: jest.Mock };
  let tenants: { findOwnTenantIdByPartnerId: jest.Mock };
  let handler: WebhookHandler;

  beforeEach(async () => {
    statusStore = { record: jest.fn(async () => true) };
    tenants = { findOwnTenantIdByPartnerId: jest.fn(async () => null) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhookHandler,
        { provide: TransactionStatusStore, useValue: statusStore },
        { provide: TenantRegistry, useValue: tenants },
      ],
    }).compile();
    handler = moduleRef.get(WebhookHandler);
  });

  describe('статусные события → персист с атомарным дедупом', () => {
    it('STATUS_CHG (свежее) → record + accepted', async () => {
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

    it('STATUS_CHG (дубликат: record=false) → duplicate', async () => {
      statusStore.record.mockResolvedValue(false);
      const r = await handler.handle({
        eventRef: 'e1',
        eventType: 'STATUS_CHG',
      });
      expect(r).toEqual({ status: 'duplicate' });
    });

    it('атрибуция тенанту: OWN-partnerId резолвится в tenantId', async () => {
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

    it('PLATFORM/неизвестный partnerId → общий пул (tenantId=null)', async () => {
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

    it('snake_case нотация (event_type/event_ref/...) нормализуется', async () => {
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

    it('достаёт status/stage из quote.confirmStatus', async () => {
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

  describe('не-статусные события → атомарный дедуп в Postgres', () => {
    it('CARDFX_PUB (snake_case) → record по event_ref, tenantId=null', async () => {
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

    it('duplicate, когда record=false (eventRef уже был)', async () => {
      statusStore.record.mockResolvedValue(false);
      const r = await handler.handle({
        eventRef: 'x1',
        eventType: 'CARDFX_PUB',
      });
      expect(r).toEqual({ status: 'duplicate' });
    });

    it('fallback на notificationId, когда нет eventRef', async () => {
      statusStore.record.mockResolvedValue(true);
      await handler.handle({ notificationId: 'n1', eventType: 'CARDFX_PUB' });
      expect(statusStore.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventRef: 'n1' }),
      );
    });

    it('accepted без дедупа/персиста, когда ref вообще нет', async () => {
      const r = await handler.handle({ eventType: 'CARDFX_PUB' });
      expect(r).toEqual({ status: 'accepted' });
      expect(statusStore.record).not.toHaveBeenCalled();
    });

    it('пустое/undefined тело → accepted (без 500)', async () => {
      await expect(handler.handle(undefined as never)).resolves.toEqual({
        status: 'accepted',
      });
      await expect(handler.handle(null as never)).resolves.toEqual({
        status: 'accepted',
      });
      expect(statusStore.record).not.toHaveBeenCalled();
    });
  });

  it('зашифрованный push → accepted без обработки (декрипт не подключён)', async () => {
    const r = await handler.handle({
      encrypted_payload: { data: 'JWE...' },
    } as never);
    expect(r).toEqual({ status: 'accepted' });
    expect(statusStore.record).not.toHaveBeenCalled();
  });
});
