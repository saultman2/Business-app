import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/Themed";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";

export function Brandmark({ size = 56 }: { size?: number }) {
  const colors = useColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MaterialCommunityIcons
        name="hard-hat"
        size={size * 0.56}
        color={colors.primaryForeground}
      />
    </View>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.header}>
          <Brandmark />
          <View style={{ gap: 6 }}>
            <AppText variant="title">{title}</AppText>
            <AppText variant="subtitle" tone="muted">
              {subtitle}
            </AppText>
          </View>
        </View>
        <View style={{ gap: 16 }}>{children}</View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 32, maxWidth: 480, width: "100%", alignSelf: "center" },
  header: { gap: 20 },
});
