import { NotFoundException } from '@nestjs/common';
import { IsNull, Not, Repository } from 'typeorm';
import { sha256hex } from '../../../common/utils/crypto.util';
import { CredentialMode, Tenant } from '../../../tenants/tenant.types';
import { TransactionOwnershipEntity } from '../entities/transaction-ownership.entity';
import {
  TransactionOwnership,
  extractMcPaymentId,
} from './transaction-ownership.service';

const platform = {
  id: 'acme',
  credentialMode: CredentialMode.PLATFORM,
} as unknown as Tenant;

const own = {
  id: 'own-demo',
  credentialMode: CredentialMode.OWN,
} as unknown as Tenant;

function makeRepo() {
  return {
    count: jest.fn(async () => 0),
    query: jest.fn(
      async (_sql: string, _params?: unknown[]) => [] as unknown[],
    ),
  };
}

function make(repo = makeRepo()) {
  const svc = new TransactionOwnership(
    repo as unknown as Repository<TransactionOwnershipEntity>,
  );
  return { svc, repo };
}

describe('TransactionOwnership — refHash', () => {
  it('is sha256 of the raw reference (stable, 64 hex)', () => {
    const { svc } = make();
    expect(svc.refHash('INV-2026-0042')).toBe(sha256hex('INV-2026-0042'));
    expect(svc.refHash('INV-2026-0042')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('TransactionOwnership — assertOwnsRef', () => {
  // OWN tenants each have their own MC partnerId, so Mastercard isolates them upstream.
  // Gating them would be dead work and would break single-tenant/OWN deployments.
  it('OWN tenant: no-op, the repository is never touched', async () => {
    const { svc, repo } = make();
    await expect(svc.assertOwnsRef(own, 'ANY-REF')).resolves.toBeUndefined();
    expect(repo.count).not.toHaveBeenCalled();
  });

  it('PLATFORM tenant with a claim: passes', async () => {
    const repo = makeRepo();
    repo.count.mockResolvedValue(1);
    const { svc } = make(repo);
    await expect(svc.assertOwnsRef(platform, 'R1')).resolves.toBeUndefined();
    expect(repo.count).toHaveBeenCalledWith({
      where: { tenantId: 'acme', refHash: sha256hex('R1') },
    });
  });

  it('PLATFORM tenant without a claim: 404 (not 403 — no enumeration oracle)', async () => {
    const repo = makeRepo();
    repo.count.mockResolvedValue(0);
    const { svc } = make(repo);
    await expect(svc.assertOwnsRef(platform, 'R1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // "Cannot prove ownership" must not mean "is allowed" — falling through on a missing
  // reference would make the whole gate a one-character bypass.
  it.each([undefined, ''])(
    'PLATFORM tenant with ref=%p: fails closed without querying',
    async (ref) => {
      const { svc, repo } = make();
      await expect(
        svc.assertOwnsRef(platform, ref as string | undefined),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.count).not.toHaveBeenCalled();
    },
  );
});

describe('TransactionOwnership — assertOwnsPaymentId', () => {
  it('OWN tenant: no-op', async () => {
    const { svc, repo } = make();
    await expect(
      svc.assertOwnsPaymentId(own, 'rem_x'),
    ).resolves.toBeUndefined();
    expect(repo.count).not.toHaveBeenCalled();
  });

  it('PLATFORM tenant owning the id: passes', async () => {
    const repo = makeRepo();
    repo.count.mockResolvedValue(1);
    const { svc } = make(repo);
    await expect(
      svc.assertOwnsPaymentId(platform, 'rem_x'),
    ).resolves.toBeUndefined();
    expect(repo.count).toHaveBeenCalledWith({
      where: { tenantId: 'acme', mcPaymentId: 'rem_x' },
    });
  });

  it("PLATFORM tenant not owning the id: 404 (a peer's payment is not addressable)", async () => {
    const repo = makeRepo();
    repo.count.mockResolvedValue(0);
    const { svc } = make(repo);
    await expect(
      svc.assertOwnsPaymentId(platform, 'rem_foreign'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('empty id: 404 without querying', async () => {
    const { svc, repo } = make();
    await expect(svc.assertOwnsPaymentId(platform, '')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.count).not.toHaveBeenCalled();
  });
});

describe('TransactionOwnership — hasCompletedClaim (gates shared-pool reads)', () => {
  // Only a COMPLETED payment (a row whose mcPaymentId is set) may unlock the shared status
  // pool; a bare quote claim (mcPaymentId NULL) must not. This is the invariant the pool read
  // depends on, moved here from the retired PaymentIdempotencyStore.ownsKey.
  it('true for a completed-payment row, filtering on mcPaymentId IS NOT NULL', async () => {
    const repo = makeRepo();
    repo.count.mockResolvedValue(1);
    const { svc } = make(repo);
    await expect(svc.hasCompletedClaim('acme', 'R1')).resolves.toBe(true);
    expect(repo.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'acme',
        refHash: sha256hex('R1'),
        mcPaymentId: Not(IsNull()),
      },
    });
  });

  // The load-bearing filter must actually reach the DB — a mocked count cannot prove the
  // WHERE clause on its own, so assert the mcPaymentId IS NOT NULL predicate is present.
  it('false when only a quote claim exists (mcPaymentId NULL is not counted)', async () => {
    const repo = makeRepo();
    repo.count.mockResolvedValue(0);
    const { svc } = make(repo);
    await expect(svc.hasCompletedClaim('acme', 'R1')).resolves.toBe(false);
    expect(repo.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ mcPaymentId: Not(IsNull()) }),
      }),
    );
  });
});

describe('TransactionOwnership — claim/recordPayment are best-effort', () => {
  it('claim writes the upsert with the hashed ref', async () => {
    const { svc, repo } = make();
    await svc.claim(platform, 'R1');
    expect(repo.query).toHaveBeenCalledTimes(1);
    expect(repo.query.mock.calls[0][1]).toEqual([
      'acme',
      sha256hex('R1'),
      null,
    ]);
  });

  it('recordPayment stores the MC payment id', async () => {
    const { svc, repo } = make();
    await svc.recordPayment(platform, 'R1', 'rem_abc');
    expect(repo.query.mock.calls[0][1]).toEqual([
      'acme',
      sha256hex('R1'),
      'rem_abc',
    ]);
  });

  it('no reference → nothing is written', async () => {
    const { svc, repo } = make();
    await svc.claim(platform, undefined);
    expect(repo.query).not.toHaveBeenCalled();
  });

  // A payment that already succeeded at Mastercard must still return 201 — a bookkeeping
  // failure here must never surface as an error to the merchant.
  it('a repository failure is swallowed, not thrown', async () => {
    const repo = makeRepo();
    repo.query.mockRejectedValue(new Error('db down'));
    const { svc } = make(repo);
    await expect(
      svc.recordPayment(platform, 'R1', 'rem_abc'),
    ).resolves.toBeUndefined();
  });
});

describe('extractMcPaymentId', () => {
  it('reads payment.id, then falls back to a top-level id', () => {
    expect(extractMcPaymentId({ payment: { id: 'rem_a' } })).toBe('rem_a');
    expect(extractMcPaymentId({ id: 'rem_b' })).toBe('rem_b');
  });

  // An unrecognised shape must yield undefined (→ the by-id route 404s for that payment)
  // rather than throw and fail a payment that already went through.
  it.each<[string, unknown]>([
    ['empty object', {}],
    ['payment without an id', { payment: {} }],
    ['non-string id', { payment: { id: 42 } }],
    ['blank id', { id: '   ' }],
    ['null', null],
    ['a bare string response', 'rem_x'],
    ['an array', [{ id: 'rem_x' }]],
  ])('returns undefined for %s', (_label, input) => {
    expect(extractMcPaymentId(input)).toBeUndefined();
  });

  it('rejects an over-long id rather than truncating it', () => {
    expect(extractMcPaymentId({ id: 'r'.repeat(129) })).toBeUndefined();
  });
});
