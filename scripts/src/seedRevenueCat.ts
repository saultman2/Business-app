import { getUncachableRevenueCatClient } from "./revenueCatClient";

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

const PROJECT_NAME = "BuildPro";

const APP_STORE_APP_NAME = "BuildPro (iOS)";
const APP_STORE_BUNDLE_ID = "com.buildpro.app";
const PLAY_STORE_APP_NAME = "BuildPro (Android)";
const PLAY_STORE_PACKAGE_NAME = "com.buildpro.app";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "BuildPro Plans";

const PRODUCT_DURATION = "P1M";

// Tier definitions. "Free" is the no-purchase default and has no product/entitlement.
// Business is configured as a superset of Pro: its product is attached to BOTH the
// `pro` and `business` entitlements, so a Business subscriber gets every Pro feature too.
type Tier = {
  key: string;
  productIdentifier: string; // test store + app store store_identifier
  playStoreProductIdentifier: string; // {subscriptionId}:{basePlanId}
  productDisplayName: string;
  productTitle: string;
  entitlementIdentifier: string;
  entitlementDisplayName: string;
  packageIdentifier: string;
  packageDisplayName: string;
  // Which entitlements this tier's product unlocks (for supersets).
  unlocksEntitlements: string[];
  prices: { amount_micros: number; currency: string }[];
};

const TIERS: Tier[] = [
  {
    key: "pro",
    productIdentifier: "pro_monthly",
    playStoreProductIdentifier: "pro_monthly:monthly",
    productDisplayName: "BuildPro Pro (Monthly)",
    productTitle: "BuildPro Pro",
    entitlementIdentifier: "pro",
    entitlementDisplayName: "Pro Access",
    packageIdentifier: "pro_monthly",
    packageDisplayName: "Pro Monthly",
    unlocksEntitlements: ["pro"],
    prices: [
      { amount_micros: 29990000, currency: "USD" }, // $29.99
      { amount_micros: 27990000, currency: "EUR" }, // €27.99
    ],
  },
  {
    key: "business",
    productIdentifier: "business_monthly",
    playStoreProductIdentifier: "business_monthly:monthly",
    productDisplayName: "BuildPro Business (Monthly)",
    productTitle: "BuildPro Business",
    entitlementIdentifier: "business",
    entitlementDisplayName: "Business Access",
    packageIdentifier: "business_monthly",
    packageDisplayName: "Business Monthly",
    // Business unlocks both pro and business entitlements.
    unlocksEntitlements: ["pro", "business"],
    prices: [
      { amount_micros: 79990000, currency: "USD" }, // $79.99
      { amount_micros: 74990000, currency: "EUR" }, // €74.99
    ],
  },
];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  // --- Project ---
  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });
  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);
  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error: createProjectError } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (createProjectError) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  // --- Apps ---
  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps || apps.items.length === 0) {
    throw new Error("No apps found");
  }

  const app: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!app) throw new Error("No app with test store found");
  console.log("App with test store found:", app.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: APP_STORE_APP_NAME,
        type: "app_store",
        app_store: { bundle_id: APP_STORE_BUNDLE_ID },
      },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app found:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: PLAY_STORE_APP_NAME,
        type: "play_store",
        play_store: { package_name: PLAY_STORE_PACKAGE_NAME },
      },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app found:", playStoreApp.id);
  }

  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error("Failed to list products");

  const ensureProductForApp = async (
    targetApp: App,
    label: string,
    productIdentifier: string,
    displayName: string,
    title: string,
    isTestStore: boolean,
  ): Promise<Product> => {
    const existingProduct = existingProducts.items?.find(
      (p) => p.store_identifier === productIdentifier && p.app_id === targetApp.id,
    );
    if (existingProduct) {
      console.log(label + " product already exists:", existingProduct.id);
      return existingProduct;
    }

    const body: CreateProductData["body"] = {
      store_identifier: productIdentifier,
      app_id: targetApp.id,
      type: "subscription",
      display_name: displayName,
    };
    if (isTestStore) {
      body.subscription = { duration: PRODUCT_DURATION };
      body.title = title;
    }

    const { data: createdProduct, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body,
    });
    if (error) throw new Error("Failed to create " + label + " product");
    console.log("Created " + label + " product:", createdProduct.id);
    return createdProduct;
  };

  // --- Offering (shared by all tiers) ---
  let offering: Offering | undefined;
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOfferingsError) throw new Error("Failed to list offerings");

  const existingOffering = existingOfferings.items?.find(
    (o) => o.lookup_key === OFFERING_IDENTIFIER,
  );
  if (existingOffering) {
    console.log("Offering already exists:", existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newOffering, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create offering");
    console.log("Created offering:", newOffering.id);
    offering = newOffering;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("Set offering as current");
  }

  const { data: existingEntitlements, error: listEntitlementsError } =
    await listEntitlements({
      client,
      path: { project_id: project.id },
      query: { limit: 20 },
    });
  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  const ensureEntitlement = async (
    lookupKey: string,
    displayName: string,
  ): Promise<Entitlement> => {
    const existing = existingEntitlements.items?.find((e) => e.lookup_key === lookupKey);
    if (existing) {
      console.log("Entitlement already exists:", existing.id);
      return existing;
    }
    const { data: created, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: { lookup_key: lookupKey, display_name: displayName },
    });
    if (error) throw new Error("Failed to create entitlement " + lookupKey);
    console.log("Created entitlement:", created.id);
    return created;
  };

  const { data: existingPackages, error: listPackagesError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });
  if (listPackagesError) throw new Error("Failed to list packages");

  // Map of entitlement lookup_key -> product ids to attach.
  const entitlementProductIds: Record<string, string[]> = {};
  // Cache of ensured entitlements by lookup_key.
  const entitlementsByKey: Record<string, Entitlement> = {};

  for (const tier of TIERS) {
    console.log(`\n--- Seeding tier: ${tier.key} ---`);

    const testStoreProduct = await ensureProductForApp(
      app,
      "Test Store",
      tier.productIdentifier,
      tier.productDisplayName,
      tier.productTitle,
      true,
    );
    const appStoreProduct = await ensureProductForApp(
      appStoreApp,
      "App Store",
      tier.productIdentifier,
      tier.productDisplayName,
      tier.productTitle,
      false,
    );
    const playStoreProduct = await ensureProductForApp(
      playStoreApp,
      "Play Store",
      tier.playStoreProductIdentifier,
      tier.productDisplayName,
      tier.productTitle,
      false,
    );

    // Test store prices for the test store product.
    console.log("Adding test store prices for product:", testStoreProduct.id);
    const { error: priceError } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: testStoreProduct.id },
      body: { prices: tier.prices },
    });
    if (priceError) {
      if (
        priceError &&
        typeof priceError === "object" &&
        "type" in priceError &&
        priceError["type"] === "resource_already_exists"
      ) {
        console.log("Test store prices already exist for this product");
      } else {
        throw new Error("Failed to add test store prices");
      }
    } else {
      console.log("Successfully added test store prices");
    }

    const tierProductIds = [
      testStoreProduct.id,
      appStoreProduct.id,
      playStoreProduct.id,
    ];

    // Ensure each entitlement this tier unlocks, and queue products for attach.
    for (const entKey of tier.unlocksEntitlements) {
      if (!entitlementsByKey[entKey]) {
        const displayName =
          TIERS.find((t) => t.entitlementIdentifier === entKey)
            ?.entitlementDisplayName ?? entKey;
        entitlementsByKey[entKey] = await ensureEntitlement(entKey, displayName);
      }
      entitlementProductIds[entKey] = (entitlementProductIds[entKey] ?? []).concat(
        tierProductIds,
      );
    }

    // --- Package for this tier ---
    let pkg: Package | undefined = existingPackages.items?.find(
      (p) => p.lookup_key === tier.packageIdentifier,
    );
    if (pkg) {
      console.log("Package already exists:", pkg.id);
    } else {
      const { data: newPackage, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: {
          lookup_key: tier.packageIdentifier,
          display_name: tier.packageDisplayName,
        },
      });
      if (error) throw new Error("Failed to create package " + tier.packageIdentifier);
      console.log("Created package:", newPackage.id);
      pkg = newPackage;
    }

    const { error: attachPackageError } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: tierProductIds.map((id) => ({
          product_id: id,
          eligibility_criteria: "all" as const,
        })),
      },
    });
    if (attachPackageError) {
      if (
        attachPackageError.type === "unprocessable_entity_error" &&
        attachPackageError.message?.includes("Cannot attach product")
      ) {
        console.log("Skipping package attach: package already has incompatible product");
      } else {
        throw new Error("Failed to attach products to package");
      }
    } else {
      console.log("Attached products to package");
    }
  }

  // --- Attach products to entitlements (dedup) ---
  for (const [entKey, productIds] of Object.entries(entitlementProductIds)) {
    const entitlement = entitlementsByKey[entKey]!;
    const uniqueIds = Array.from(new Set(productIds));
    const { error: attachEntitlementError } = await attachProductsToEntitlement({
      client,
      path: { project_id: project.id, entitlement_id: entitlement.id },
      body: { product_ids: uniqueIds },
    });
    if (attachEntitlementError) {
      if (attachEntitlementError.type === "unprocessable_entity_error") {
        console.log(`Products already attached to entitlement ${entKey}`);
      } else {
        throw new Error("Failed to attach products to entitlement " + entKey);
      }
    } else {
      console.log(`Attached products to entitlement ${entKey}`);
    }
  }

  // --- Public API keys ---
  const { data: testStoreApiKeys, error: testStoreApiKeysError } =
    await listAppPublicApiKeys({
      client,
      path: { project_id: project.id, app_id: app.id },
    });
  if (testStoreApiKeysError) throw new Error("Failed to list Test Store API keys");

  const { data: appStoreApiKeys, error: appStoreApiKeysError } =
    await listAppPublicApiKeys({
      client,
      path: { project_id: project.id, app_id: appStoreApp.id },
    });
  if (appStoreApiKeysError) throw new Error("Failed to list App Store API keys");

  const { data: playStoreApiKeys, error: playStoreApiKeysError } =
    await listAppPublicApiKeys({
      client,
      path: { project_id: project.id, app_id: playStoreApp.id },
    });
  if (playStoreApiKeysError) throw new Error("Failed to list Play Store API keys");

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("REVENUECAT_PROJECT_ID:", project.id);
  console.log("REVENUECAT_TEST_STORE_APP_ID:", app.id);
  console.log("REVENUECAT_APPLE_APP_STORE_APP_ID:", appStoreApp.id);
  console.log("REVENUECAT_GOOGLE_PLAY_STORE_APP_ID:", playStoreApp.id);
  console.log("Entitlements: pro, business");
  console.log(
    "EXPO_PUBLIC_REVENUECAT_TEST_API_KEY:",
    testStoreApiKeys?.items.map((item) => item.key).join(", ") ?? "N/A",
  );
  console.log(
    "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:",
    appStoreApiKeys?.items.map((item) => item.key).join(", ") ?? "N/A",
  );
  console.log(
    "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY:",
    playStoreApiKeys?.items.map((item) => item.key).join(", ") ?? "N/A",
  );
  console.log("====================\n");
}

seedRevenueCat().catch(console.error);
