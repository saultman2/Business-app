import { createClient } from "@replit/revenuecat-sdk/client";
import { listCustomerActiveEntitlements } from "@replit/revenuecat-sdk";

import { logger } from "./logger";

const REVENUECAT_API_BASE_URL = "https://api.revenuecat.com/v2";

async function getAccessToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname) throw new Error("REPLIT_CONNECTORS_HOSTNAME is not set");
  if (!xReplitToken) throw new Error("No Replit identity token for connector");

  const res = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=revenuecat`,
    { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch RevenueCat connection: ${res.status}`);
  }
  const data = (await res.json()) as {
    items?: {
      settings?: {
        access_token?: string;
        oauth?: { credentials?: { access_token?: string } };
      };
    }[];
  };
  const settings = data.items?.[0]?.settings;
  const accessToken =
    settings?.access_token ?? settings?.oauth?.credentials?.access_token;
  if (!accessToken) {
    throw new Error("RevenueCat connector is not connected (no access token)");
  }
  return accessToken;
}

async function getUncachableRevenueCatClient() {
  const accessToken = await getAccessToken();
  return createClient({
    baseUrl: REVENUECAT_API_BASE_URL,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Small in-memory cache so a burst of requests from one user doesn't hammer the
// RevenueCat API. Subscription state changes infrequently relative to requests.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: boolean; expiresAt: number }>();

/**
 * Returns true if the customer (keyed by Clerk user id, matching the
 * `Purchases.logIn(userId)` call on the client) has at least one active
 * entitlement — i.e. is on a paid plan (Pro or Business).
 *
 * Failure semantics:
 * - Customer not found (404) → no entitlements → `false` (Free tier).
 * - Transient/unexpected errors → fail OPEN (`true`) so infra issues never
 *   block a legitimate paying user from working.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) {
    logger.warn("REVENUECAT_PROJECT_ID not set; treating user as free tier");
    return false;
  }

  let value: boolean;
  try {
    const client = await getUncachableRevenueCatClient();
    const { data, error, response } = await listCustomerActiveEntitlements({
      client,
      path: { project_id: projectId, customer_id: userId },
    });

    if (error) {
      if (response?.status === 404) {
        value = false;
      } else {
        logger.warn({ status: response?.status }, "RevenueCat entitlement check failed; failing open");
        return true;
      }
    } else {
      value = (data?.items?.length ?? 0) > 0;
    }
  } catch (err) {
    logger.warn({ err }, "RevenueCat entitlement check threw; failing open");
    return true;
  }

  cache.set(userId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Free plan cap on the number of jobs a company may have. */
export const FREE_JOB_LIMIT = 3;
