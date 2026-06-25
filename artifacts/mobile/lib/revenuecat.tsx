import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import React, { createContext, useCallback, useContext } from "react";
import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

// Entitlement identifiers created by the seed script. Business is a superset of
// Pro (the Business product unlocks both entitlements), so a Business subscriber
// always has `pro` active too.
export const ENTITLEMENT_PRO = "pro";
export const ENTITLEMENT_BUSINESS = "business";

// Package lookup keys created by the seed script. Used to map an offering's
// packages to tiers by exact identifier (with a substring fallback) rather than
// relying on naming heuristics alone.
export const PACKAGE_PRO = "pro_monthly";
export const PACKAGE_BUSINESS = "business_monthly";

export type Plan = "free" | "pro" | "business";

function getRevenueCatApiKey(): string {
  if (
    !REVENUECAT_TEST_API_KEY ||
    !REVENUECAT_IOS_API_KEY ||
    !REVENUECAT_ANDROID_API_KEY
  ) {
    throw new Error("RevenueCat Public API Keys not found");
  }

  if (
    __DEV__ ||
    Platform.OS === "web" ||
    Constants.executionEnvironment === "storeClient"
  ) {
    return REVENUECAT_TEST_API_KEY;
  }

  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY;
}

let configured = false;

export function initializeRevenueCat() {
  if (configured) return;
  const apiKey = getRevenueCatApiKey();
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
  configured = true;
  // eslint-disable-next-line no-console
  console.log("Configured RevenueCat");
}

// Whether the SDK is running against the Test Store (dev / Expo Go / web).
// Used to require an explicit confirmation modal for purchases.
export function isTestStore(): boolean {
  return (
    __DEV__ ||
    Platform.OS === "web" ||
    Constants.executionEnvironment === "storeClient"
  );
}

function planFromCustomerInfo(info: CustomerInfo | undefined): Plan {
  const active = info?.entitlements.active ?? {};
  if (active[ENTITLEMENT_BUSINESS]) return "business";
  if (active[ENTITLEMENT_PRO]) return "pro";
  return "free";
}

function useSubscriptionContext() {
  const queryClient = useQueryClient();

  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: async () => {
      return Purchases.getCustomerInfo();
    },
    staleTime: 60 * 1000,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      return Purchases.getOfferings();
    },
    staleTime: 300 * 1000,
  });

  const refreshCustomerInfo = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: ["revenuecat", "customer-info"],
    });
  }, [queryClient]);

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: PurchasesPackage) => {
      const { customerInfo } =
        await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
    onSuccess: () => refreshCustomerInfo(),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      return Purchases.restorePurchases();
    },
    onSuccess: () => refreshCustomerInfo(),
  });

  const logIn = useCallback(
    async (appUserId: string) => {
      try {
        await Purchases.logIn(appUserId);
        await refreshCustomerInfo();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("RevenueCat logIn failed", err);
      }
    },
    [refreshCustomerInfo],
  );

  const logOut = useCallback(async () => {
    try {
      await Purchases.logOut();
      await refreshCustomerInfo();
    } catch {
      // logOut throws if the user is already anonymous; safe to ignore.
    }
  }, [refreshCustomerInfo]);

  const customerInfo = customerInfoQuery.data;
  const plan = planFromCustomerInfo(customerInfo);

  return {
    customerInfo,
    offerings: offeringsQuery.data as PurchasesOfferings | undefined,
    plan,
    isPro: plan === "pro" || plan === "business",
    isBusiness: plan === "business",
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    error: customerInfoQuery.error ?? offeringsQuery.error,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    refetchOfferings: offeringsQuery.refetch,
    logIn,
    logOut,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return ctx;
}
