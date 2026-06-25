import { useGetDashboardSummary } from "@workspace/api-client-react";
import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Card } from "@/components/Themed";
import { useColors } from "@/hooks/useColors";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card style={{ flex: 1, gap: 6, minWidth: 150 }}>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      <AppText variant="title">{value}</AppText>
      {hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </Card>
  );
}

function currency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch, isRefetching } =
    useGetDashboardSummary();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 110 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
    >
      <View style={{ gap: 4 }}>
        <AppText variant="heading">Today at a glance</AppText>
        <AppText variant="caption" tone="muted">
          Your live business numbers across jobs, estimates, and invoices.
        </AppText>
      </View>

      {isError ? (
        <Card>
          <AppText tone="destructive">
            Couldn't load your dashboard. Pull down to retry.
          </AppText>
        </Card>
      ) : null}

      <View style={styles.row}>
        <StatCard
          label="Active jobs"
          value={data?.activeJobs ?? 0}
          hint={`${data?.jobsInProgress ?? 0} in progress`}
        />
        <StatCard
          label="Clients"
          value={data?.totalClients ?? 0}
          hint={`${data?.paidJobs ?? 0} paid jobs`}
        />
      </View>
      <View style={styles.row}>
        <StatCard
          label="Estimates"
          value={(data?.estimatesDrafted ?? 0) + (data?.estimatesSent ?? 0)}
          hint={`${data?.estimatesSent ?? 0} sent`}
        />
        <StatCard
          label="Unpaid invoices"
          value={data?.unpaidInvoices ?? 0}
          hint={currency(data?.totalUnpaidAmount ?? 0)}
        />
      </View>

      <Card style={{ gap: 14 }}>
        <AppText variant="label" tone="muted">
          Cash flow
        </AppText>
        <View style={styles.cashRow}>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" tone="muted">
              Collected
            </AppText>
            <AppText variant="heading" tone="primary">
              {currency(data?.totalPaidAmount ?? 0)}
            </AppText>
          </View>
          <View style={{ gap: 2, alignItems: "flex-end" }}>
            <AppText variant="caption" tone="muted">
              Outstanding
            </AppText>
            <AppText variant="heading">
              {currency(data?.totalUnpaidAmount ?? 0)}
            </AppText>
          </View>
        </View>
      </Card>

      <View style={{ gap: 10 }}>
        <AppText variant="heading">Recent jobs</AppText>
        {data && data.recentJobs.length > 0 ? (
          data.recentJobs.slice(0, 5).map((job) => (
            <Card key={job.id} style={styles.jobRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="subtitle" numberOfLines={1}>
                  {job.title}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {job.status.replace(/_/g, " ")}
                </AppText>
              </View>
            </Card>
          ))
        ) : (
          <Card>
            <AppText tone="muted">
              No jobs yet. Create your first job in the web app to see it here.
            </AppText>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 18, gap: 16 },
  row: { flexDirection: "row", gap: 12 },
  cashRow: { flexDirection: "row", justifyContent: "space-between" },
  jobRow: { flexDirection: "row", alignItems: "center" },
});
