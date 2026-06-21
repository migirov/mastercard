# What to clarify with the client / Mastercard

A list of questions and materials needed to continue the integration.
🔴 — blocks prod / needed for Phase 3. 🟡 — for later phases. ✅ — RESOLVED.

---

## Already resolved (closed questions)

- ✅ **Separate service or part of the monolith?** → **DECIDED:** one umbrella module
  embedded into the host `b24club-api`; the host provides the TypeORM `DataSource` and
  runs the migrations.
- ✅ **e2e on Postgres** → **done** (live Postgres in Docker).
- ✅ **`Idempotency-Key`** → **SUPERSEDED** (team-lead issue #3): the header was removed;
  idempotency is now derived from `transaction_reference`.

---

## A. Mastercard access (production)

Everything currently runs in **sandbox** (shared `partner-id = SANDBOX_1234567`).
Going live requires production data.

- 🔴 **A1.** A confirmed **production partner-id** (issued during onboarding).
- 🔴 **A2.** Production **credentials**: consumer key, signing key (`.p12`) + password,
  encryption certificate + fingerprint, decryption key.
- 🔴 **A3.** Which environments do we use: Production only, or also **MTF (Test)**?
- 🟡 **A4.** Is **mTLS** used to receive push notifications (the docs mention "mTLS
  onboarding")? If yes — a certificate and a registration process are needed.

## B. Merchant model (key to the architecture)

We support two modes; we need to know which merchant uses which:

- 🔴 **B1.** Does each merchant get **their own** Mastercard partner-id and keys
  (a separate onboarding per merchant), **or** do all work under the platform's
  **shared** partner-id and differ inside the payload?
- 🔴 **B2.** If merchants have **their own** keys: how is their MC onboarding set up —
  who initiates it, and what do we receive per merchant and in what form?
- 🟡 **B3.** If a **shared** partner-id: how is the specific sending merchant
  distinguished in a payment (which originator/sender fields are required)?

## C. Webhooks / push notifications

We're building webhook reception. We need specifics from MC:

- 🔴 **C1.** The **signature scheme** of incoming push notifications and the **payload
  format** (from the *Push Notifications Details* section). How do we verify authenticity?
- 🔴 **C2.** How do we **register our callback URL** with Mastercard (where and how
  the address MC sends notifications to is configured)?
- 🟡 **C3.** Which **event types** will we receive (status change, payment status,
  account-validation result) and their structure?
- 🟡 **C4.** Is there an event for merchant **onboarding/approval**, or is approval
  purely a business process (portal/email)?

## D. Approval process

In our system, transactions are only allowed for approved merchants (Mastercard +
platform approval).

- 🔴 **D1.** What exactly counts as **"Mastercard approval"** for a merchant to go
  live, and **how do we learn about it** (email / portal / API / webhook)?
- 🔴 **D2.** What counts as **"platform approval"** — your internal criteria and who sets it?

## E. Operation scope (what merchants actually need)

- 🟡 **E1.** Which Cross-Border operations are needed first: quote, payment, retrieve
  payment, cancel, balance, account validation, RFI? (**All 15** MC API Reference
  groups are implemented — prioritization now drives test plans, not development.)
- 🟡 **E2.** Is a payment synchronous or asynchronous (via a completion webhook)?
- 🟡 **E3.** Do merchants need **their own sandbox** (test clients on our side)?

## H. Dependencies (supply chain)

- 🔴 **H1. (NEW) axios version.** We pin `axios 1.6.0` — an **exact match** with the
  host `b24club-api` (their `package.json` also pins `1.6.0`; `@nestjs/axios@4`
  peer-requires `^1.3.1`, so no conflict). But `npm audit` flags `axios 1.0.0–1.15.2`
  with HIGH advisories (SSRF / prototype-pollution / ReDoS); the latest is `1.17.0`.
  Our practical exposure is **low** (fixed `baseURL`, relative paths, no client-supplied
  absolute URLs). **Question:** bump axios to a patched `1.x`? Since the host owns the
  single deduped axios in the monolith, the bump should be **host-driven** and we follow
  in lockstep. Please confirm the desired version.

## F. Infrastructure

- 🔴 **F1.** Which **secret manager** does the platform use: HashiCorp Vault / AWS
  Secrets Manager / GCP Secret Manager? (We'll implement the merchant key store for it.)
- 🟡 **F2.** Where is the deployment (AWS / GCP / on-prem) and **how many instances**
  of the service (one or several — affects the rate-limit store: in-memory vs Redis)?
- 🟡 **F3.** Are there **audit/log retention** and PII-handling requirements
  (sender/recipient data in cross-border)?

## G. External merchant access (OAuth2)

We chose OAuth2 client credentials for connecting companies.

- 🟡 **G1.** Expected **volumes/limits** per merchant (for rate-limiting)?
- 🟡 **G2.** Who issues **client_id/secret** to a merchant and how — our operator via
  an admin panel? Is self-service issuance needed?

---

## What they must technically hand us (artifacts)

| # | What | For | Priority |
|---|-----|----------|-----------|
| 1 | Production `.p12` (signing) + password | signing live requests | 🔴 |
| 2 | Production consumer key | OAuth1 to MC | 🔴 |
| 3 | Encryption cert (`.pem`) + fingerprint (prod) | body encryption (Phase 4) | 🔴 |
| 4 | Decryption key (`.p12`) + password (prod) | decrypting responses | 🔴 |
| 5 | Production partner-id | request paths | 🔴 |
| 6 | Webhook signature/format spec | verifying push notifications | 🔴 |
| 7 | Access/instructions to the secret manager | storing merchant keys | 🔴 |
| 8 | Per OWN merchant: their keys/partner-id | OWN mode in prod | 🟡 |

---

## What can be started ALREADY (without client answers)

Phase 3 is mostly **not blocked** — built and verified on sandbox:

- ✅ OAuth2 server (token endpoint + client_id/secret registry);
- ✅ `ExternalAuthGuard` (Bearer JWT) + `InternalAuthGuard` (service token);
- ✅ `TenantContext` (replacing the `x-tenant-id` header);
- ✅ approval model (2 flags, `ACTIVE` computed) + admin API;
- ✅ per-tenant rate-limit (in-memory; Redis — once F2 is answered);
- ✅ webhook reception (push authenticity = **mTLS**, NOT a payload signature — MC does
  not sign the body; the noop signature verifier was removed in issue #7). The real
  remaining webhook item is decrypting the encrypted push, not a payload-signature check.

**Only blocked by:** going live (needs A1–A2, prod keys) and the final webhook check
(C1). Phase 3 development can proceed in parallel with the request.
