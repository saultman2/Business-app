---
name: Multitenancy pattern
description: All data is scoped by companyId derived from Clerk auth, never from the request body
---

Every DB query must filter by `eq(table.companyId, req.companyId!)`. The `req.companyId` is set by the `requireAuth` middleware via Clerk + JIT company provisioning.

**Why:** Prevents cross-tenant data leakage. CompanyId in request body would be trivially spoofable.

**How to apply:** In every route handler, use `req.companyId` for ownership checks and scoping. Never accept companyId from req.body or req.query. See `artifacts/api-server/src/lib/auth.ts` and `lib/ownership.ts`.
