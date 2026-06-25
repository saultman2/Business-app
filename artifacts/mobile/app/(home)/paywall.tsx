import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, Card, Divider } from "@/components/Themed";
import { useColors } from "@/hooks/useColors";
import {
  ENTITLEMENT_BUSINESS,
  ENTITLEMENT_PRO,
  isTestStore,
  PACKAGE_BUSINESS,
  PACKAGE_PRO,
  type Plan,
  useSubscription,
} from "@/lib/revenuecat";

type TierKey = Exclude<Plan, "free"> | "free";

const TIER_FEATURES: Record<
  TierKey,
  { name: string; tagline: string; features: string[] }
> = {
  free: {
    name: "Free",
    tagline: "Get started managing your jobs",
    features: [
      "Up to 3 active jobs",
      "Client list & contacts",
      "Basic job tracking",
    ],
  },
  pro: {
    name: "Pro",
    tagline: "Everything you need to run the business",
    features: [
      "Unlimited jobs",
      "Estimates & invoices",
      "Material lists & job photos",
      "Calendar & dashboard insights",
    ],
  },
  business: {
    name: "Business",
    tagline: "Scale with your whole crew",
    features: [
      "Everything in Pro",
      "Team member access",
      "Priority support",
      "Advanced reporting",
    ],
  },
};

function tierForPackage(pkg: PurchasesPackage): "pro" | "business" {
  // Prefer an exact match on the seed-defined package lookup keys, then fall
  // back to a substring heuristic for resilience to naming changes.
  if (pkg.identifier === PACKAGE_BUSINESS) return "business";
  if (pkg.identifier === PACKAGE_PRO) return "pro";
  const id = `${pkg.identifier} ${pkg.product.identifier}`.toLowerCase();
  return id.includes("business") ? "business" : "pro";
}

export default function PaywallScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    offerings,
    plan,
    isLoading,
    error,
    purchase,
    restore,
    isPurchasing,
    isRestoring,
    refetchOfferings,
  } = useSubscription();

  const [pendingPackage, setPendingPackage] =
    React.useState<PurchasesPackage | null>(null);
  const [purchaseError, setPurchaseError] = React.useState<string | null>(null);

  const current = offerings?.current;
  const packages = current?.availablePackages ?? [];

  const proPackage = packages.find((p) => tierForPackage(p) === "pro");
  const businessPackage = packages.find(
    (p) => tierForPackage(p) === "business",
  );

  const entitlementActive = (key: TierKey) => {
    if (key === "free") return plan === "free";
    if (key === "pro") return plan === "pro" || plan === "business";
    if (key === "business") return plan === "business";
    return false;
  };

  const confirmPurchase = async () => {
    if (!pendingPackage) return;
    const pkg = pendingPackage;
    setPendingPackage(null);
    setPurchaseError(null);
    try {
      await purchase(pkg);
      router.back();
    } catch (err: unknown) {
      const e = err as { userCancelled?: boolean; message?: string };
      if (e?.userCancelled) return;
      setPurchaseError(e?.message ?? "Purchase could not be completed.");
    }
  };

  const handleRestore = async () => {
    setPurchaseError(null);
    try {
      await restore();
    } catch {
      setPurchaseError("Could not restore purchases. Please try again.");
    }
  };

  const renderTier = (
    key: TierKey,
    pkg: PurchasesPackage | undefined,
    highlighted: boolean,
  ) => {
    const meta = TIER_FEATURES[key];
    const active = entitlementActive(key);
    const priceLabel =
      key === "free" ? "$0" : (pkg?.product.priceString ?? "—");

    return (
      <Card
        key={key}
        style={[
          styles.tierCard,
          highlighted
            ? { borderColor: colors.primary, borderWidth: 1.5 }
            : null,
        ]}
      >
        {highlighted ? (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <AppText variant="label" tone="inverse">
              Most popular
            </AppText>
          </View>
        ) : null}

        <View style={{ gap: 4 }}>
          <AppText variant="heading">{meta.name}</AppText>
          <AppText variant="caption" tone="muted">
            {meta.tagline}
          </AppText>
        </View>

        <View style={styles.priceRow}>
          <AppText variant="display">{priceLabel}</AppText>
          {key !== "free" ? (
            <AppText variant="caption" tone="muted">
              {" "}
              / month
            </AppText>
          ) : null}
        </View>

        <View style={{ gap: 10 }}>
          {meta.features.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Feather name="check" size={16} color={colors.primary} />
              <AppText variant="body" style={{ flex: 1 }}>
                {f}
              </AppText>
            </View>
          ))}
        </View>

        {active ? (
          <View
            style={[styles.currentPill, { backgroundColor: colors.secondary }]}
          >
            <Feather name="check-circle" size={16} color={colors.primary} />
            <AppText variant="subtitle" tone="primary">
              Current plan
            </AppText>
          </View>
        ) : key === "free" ? null : (
          <Button
            title={`Choose ${meta.name}`}
            variant={highlighted ? "primary" : "secondary"}
            disabled={!pkg || isPurchasing || isRestoring}
            onPress={() => {
              setPurchaseError(null);
              if (pkg) setPendingPackage(pkg);
            }}
          />
        )}
      </Card>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border },
        ]}
      >
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </Pressable>
        <AppText variant="heading">Plans & pricing</AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        <View style={{ gap: 6 }}>
          <AppText variant="title">Upgrade BuildPro</AppText>
          <AppText variant="body" tone="muted">
            Pick the plan that fits your crew. Cancel anytime.
          </AppText>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error || !current ? (
          <Card style={{ gap: 12 }}>
            <AppText variant="subtitle">Plans unavailable</AppText>
            <AppText variant="caption" tone="muted">
              We couldn&apos;t load subscription options right now. Please check
              your connection and try again.
            </AppText>
            <Button
              title="Retry"
              variant="secondary"
              onPress={() => refetchOfferings()}
            />
          </Card>
        ) : (
          <>
            {renderTier("free", undefined, false)}
            {renderTier("pro", proPackage, true)}
            {renderTier("business", businessPackage, false)}

            {purchaseError ? (
              <AppText variant="caption" tone="destructive">
                {purchaseError}
              </AppText>
            ) : null}

            <Button
              title="Restore purchases"
              variant="ghost"
              icon="refresh-ccw"
              loading={isRestoring}
              onPress={handleRestore}
            />

            <Divider />

            <View style={{ gap: 8 }}>
              <AppText variant="label" tone="muted">
                Billing details
              </AppText>
              <AppText variant="caption" tone="muted">
                Subscriptions are billed monthly through your app store account
                and renew automatically until cancelled. Your account will be
                charged for renewal within 24 hours before the end of the
                current period. Manage or cancel anytime from your app store
                subscription settings — cancellation takes effect at the end of
                the current billing period. Prices shown are set by RevenueCat
                offerings and may vary by region.
              </AppText>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={pendingPackage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingPackage(null)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <AppText variant="heading">Confirm subscription</AppText>
            {isTestStore() ? (
              <View
                style={[
                  styles.testBanner,
                  { backgroundColor: colors.secondary },
                ]}
              >
                <Feather name="info" size={15} color={colors.primary} />
                <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                  Test mode — this is a sandbox purchase and you will not be
                  charged.
                </AppText>
              </View>
            ) : null}
            <AppText variant="body" tone="muted">
              {pendingPackage
                ? `Subscribe to ${
                    TIER_FEATURES[tierForPackage(pendingPackage)].name
                  } for ${pendingPackage.product.priceString} / month? This renews automatically until cancelled.`
                : ""}
            </AppText>
            <View style={{ gap: 10 }}>
              <Button
                title="Confirm purchase"
                loading={isPurchasing}
                onPress={confirmPurchase}
              />
              <Button
                title="Cancel"
                variant="ghost"
                disabled={isPurchasing}
                onPress={() => setPendingPackage(null)}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 24, alignItems: "flex-start" },
  content: {
    padding: 18,
    gap: 18,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  center: { paddingVertical: 60, alignItems: "center" },
  tierCard: { gap: 16, overflow: "hidden" },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderBottomLeftRadius: 12,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  currentPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: { gap: 16, width: "100%", maxWidth: 420, alignSelf: "center" },
  testBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
});
