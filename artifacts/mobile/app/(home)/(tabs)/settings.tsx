import { useAuth, useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useGetCompany } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  Appearance,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Card, Divider } from "@/components/Themed";
import { useColors } from "@/hooks/useColors";

function Row({
  icon,
  title,
  subtitle,
  onPress,
  destructive,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed && onPress ? 0.6 : 1 },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.secondary },
        ]}
      >
        <Feather
          name={icon}
          size={18}
          color={destructive ? colors.destructive : colors.primary}
        />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText
          variant="subtitle"
          tone={destructive ? "destructive" : "default"}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {onPress ? (
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { data: company } = useGetCompany();

  const email = user?.primaryEmailAddress?.emailAddress ?? "Signed in";

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 110 },
      ]}
    >
      <Card style={styles.profile}>
        <View
          style={[styles.avatar, { backgroundColor: colors.primary }]}
        >
          <AppText variant="heading" tone="inverse">
            {(company?.name ?? email).charAt(0).toUpperCase()}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading" numberOfLines={1}>
            {company?.name || "Your company"}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {email}
          </AppText>
        </View>
      </Card>

      <View style={{ gap: 4 }}>
        <AppText variant="label" tone="muted" style={{ marginLeft: 4 }}>
          Account
        </AppText>
        <Card style={{ padding: 6 }}>
          <Row
            icon="user"
            title="Account & data"
            subtitle="Update info, delete account, data deletion"
            onPress={() => router.push("/account")}
          />
        </Card>
      </View>

      <View style={{ gap: 4 }}>
        <AppText variant="label" tone="muted" style={{ marginLeft: 4 }}>
          Appearance
        </AppText>
        <Card style={{ padding: 6 }}>
          <Row
            icon={scheme === "dark" ? "moon" : "sun"}
            title="Theme"
            subtitle="Switch between light and dark"
            onPress={() =>
              Appearance.setColorScheme(scheme === "dark" ? "light" : "dark")
            }
          />
        </Card>
      </View>

      <View style={{ gap: 4 }}>
        <Card style={{ padding: 6 }}>
          <Row
            icon="log-out"
            title="Sign out"
            destructive
            onPress={() => signOut()}
          />
        </Card>
      </View>

      <Divider style={{ marginTop: 8 }} />
      <AppText variant="caption" tone="muted" style={{ textAlign: "center" }}>
        BuildPro Mobile
      </AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 18 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
