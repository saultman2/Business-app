# BuildPro — Construction Business Manager

A multi-tenant SaaS for construction businesses to manage clients, jobs, material lists, estimates, invoices, payments, and photos. Each signed-in user gets their own company workspace; all data is isolated per company.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/construction-app run dev` — run the web frontend (Vite)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string; Clerk + object-storage env (provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Replit-managed Clerk (cookie-based web auth, JIT company provisioning per user)
- Storage: Replit object storage (logo, job photos, receipts)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: Vite + React, wouter routing, TanStack Query, PWA manifest

## Where things live

- DB schema (source of truth): `lib/db/src/schema.ts`
- API contract (source of truth): `lib/api-spec` OpenAPI → generated hooks/schemas in `@workspace/api-client-react`
- Server routes: `artifacts/api-server/src/routes/*`
- Auth + ownership helpers: `artifacts/api-server/src/lib/auth.ts`, `artifacts/api-server/src/lib/ownership.ts`
- Storage routes: `artifacts/api-server/src/routes/storage.ts`
- Frontend pages: `artifacts/construction-app/src/pages/*`

## Architecture decisions

- Multi-tenant: `companyId` is derived from Clerk auth (`req.companyId`), never the request body. Every query, join, and client-supplied FK is company-scoped/ownership-checked. See `.agents/memory/multitenancy.md`.
- No seed/fake data: totals default to 0 and every list has an empty state.
- Estimates are section-toggleable and can drive from a per-job material list; printable for PDF via browser print.
- Email/SMS intentionally unconfigured — UI shows a "not configured" warning and offers PDF download instead.
- Object uploads: client reads `objectPath` from the `request-url` response (the GCS PUT response is empty). See `.agents/memory/upload-objectpath.md`.

## Product

Company settings (+ logo), customers (route `/clients`), jobs across 9 stages (list + kanban + detail), per-job material lists, estimate builder, invoices/payments, job photos, calendar, dashboard with real counts, search/filters, mobile-responsive + PWA.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Storage `objectPath` must come from `POST /api/storage/uploads/request-url`, not the Uppy GCS PUT response (which is empty).
- `GET /api/storage/objects/*` requires auth + company ownership; stored logo/photo URLs use format `/api/storage/objects/uploads/<uuid>`.
- Run `pnpm run typecheck:libs` before leaf typechecks if you change a `lib/*` package.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
