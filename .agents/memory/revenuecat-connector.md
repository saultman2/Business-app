---
name: RevenueCat connector + entitlement gating
description: How RevenueCat IAP is wired in BuildPro — connector token fetch, entitlement model, and the user↔company subscription invariant.
---

# RevenueCat integration

## Server token fetch (connector pattern)
- The RevenueCat **REST v2** access token is fetched fresh per call from the Replit connector endpoint, never cached as a token: `GET https://${REPLIT_CONNECTORS_HOSTNAME}/api/v2/connection?include_secrets=true&connector_names=revenuecat` with header `X_REPLIT_TOKEN` = `repl ${REPL_IDENTITY}` (dev) or `depl ${WEB_REPL_RENEWAL}` (deployment). Read `settings.access_token` (fallback `settings.oauth.credentials.access_token`).
- SDK: `@replit/revenuecat-sdk` (NOT in the workspace catalog — pin an explicit version). `createClient` comes from `@replit/revenuecat-sdk/client`; entitlement calls (e.g. `listCustomerActiveEntitlements`) from the package root.
- `REVENUECAT_PROJECT_ID` is required for REST calls (path `project_id`).

## Entitlement model
- Two entitlements: `pro` and `business`. **Business is a superset of Pro** — the Business product attaches BOTH entitlements, so a Business subscriber always shows `pro` active too. Derive plan = business if `business` active, else pro if `pro` active, else free.
- Packages use lookup keys `pro_monthly` / `business_monthly`. Map offering packages to tiers by **exact package identifier first**, substring heuristic only as fallback.
- Prices are always read from the offering's `priceString` — never hardcoded.

## user↔company subscription invariant
- **Why:** BuildPro is multi-tenant but each Clerk user JIT-provisions exactly one company (keyed by owner id), so the requesting `userId` IS the company owner today.
- The client calls `Purchases.logIn(clerkUserId)`; the server checks entitlements keyed by that same Clerk `userId`. They must stay in sync.
- **How to apply:** When team members (a Business feature) are added, the data model gains non-owner users per company — at that point resolve the company **owner's** id for the entitlement check instead of `req.userId`.

## Free-tier server cap fail-open
- The server job-cap check (`hasActiveSubscription`) **fails OPEN** on transient/unexpected RevenueCat errors (returns true → no cap). 404 (customer not found) → free. Missing project id → free.
- **Why:** fail-open only relaxes a soft free-tier cap; it never grants Pro *features* (those gate client-side on real entitlements from customerInfo). Blocking a paying user during an RC outage is worse than briefly letting a free user exceed the cap.

## Test Store (dev)
- Dev uses the RevenueCat **Test Store**; `isTestStore` drives a custom in-app confirm modal instead of a real store sheet. Expo web preview runs RevenueCat in "Browser Mode" and initializes anonymously until `logIn`.
