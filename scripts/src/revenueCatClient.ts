// RevenueCat authenticated client (REST Developer API v2).
//
// Uses the Replit "revenuecat" connector for auth. We resolve a fresh OAuth
// access token on every call (tokens expire, never cache the client) and hand
// it to the typed @replit/revenuecat-sdk client.
import { createClient } from "@replit/revenuecat-sdk/client";

const REVENUECAT_API_BASE_URL = "https://api.revenuecat.com/v2";

async function getAccessToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname) {
    throw new Error("REPLIT_CONNECTORS_HOSTNAME is not set");
  }
  if (!xReplitToken) {
    throw new Error("No Replit identity token found for connector access");
  }

  const res = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=revenuecat`,
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    },
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

export async function getUncachableRevenueCatClient() {
  const accessToken = await getAccessToken();
  return createClient({
    baseUrl: REVENUECAT_API_BASE_URL,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
