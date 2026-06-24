---
name: Multi-tenant scoping rules
description: Invariants for companyId scoping in BuildPro API routes
---

BuildPro is multi-tenant: every row belongs to a company (`companyId`), derived from Clerk auth (`req.companyId`), never from the request body.

Invariants to keep on every route:

- Primary queries filter by `companyId`. Detail/update/delete must scope by both `id` AND `companyId`.
- Every `leftJoin`/`innerJoin` must add a `companyId` predicate on the joined table too — joining only on the FK leaks cross-tenant rows.
- Aggregate/summary subqueries (e.g. `/jobs/:id/summary` counting photos, receipts, estimates, material lists) must each be company-scoped.
- Any client-supplied foreign key (clientId, jobId, estimateId, invoiceId) must be ownership-checked before insert/update via `lib/ownership.ts` helpers (`ownsClient`/`ownsJob`/`ownsEstimate`...). On mismatch reject 400.

**Why:** Architect review previously FAILed on 3 severe cross-tenant leaks (unauthenticated storage routes, FK injection, unscoped joins).

**How to apply:** Ownership helpers treat null/undefined ids as allowed (so optional/clearing fields don't reopen writes). Storage: `GET /api/storage/objects/*` requires auth + `companyOwnsObject(companyId, storedUrl)`; stored URL format is `/api/storage/objects/uploads/<uuid>` and must match the reconstructed `storedUrl` exactly.
