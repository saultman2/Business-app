import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export const fonts = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
} as const;

type Variant =
  | "display"
  | "title"
  | "heading"
  | "subtitle"
  | "body"
  | "label"
  | "caption";

type Tone = "default" | "muted" | "primary" | "destructive" | "inverse";

const VARIANT_STYLE: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38 },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32 },
  heading: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 25 },
  subtitle: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
};

export function AppText({
  variant = "body",
  tone = "default",
  style,
  ...props
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const colors = useColors();
  const toneColor: Record<Tone, string> = {
    default: colors.foreground,
    muted: colors.mutedForeground,
    primary: colors.primary,
    destructive: colors.destructive,
    inverse: colors.primaryForeground,
  };
  return (
    <Text
      style={[VARIANT_STYLE[variant], { color: toneColor[tone] }, style]}
      {...props}
    />
  );
}

export function Card({
  style,
  ...props
}: ViewProps & { style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: colors.radius + 4,
          padding: 18,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function Field({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  const colors = useColors();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: 7 }}>
      {label ? (
        <AppText variant="label" tone="muted">
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        selectionColor={colors.primary}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          {
            backgroundColor: colors.card,
            borderColor: error
              ? colors.destructive
              : focused
                ? colors.primary
                : colors.input,
            borderWidth: 1.5,
            borderRadius: colors.radius,
            paddingHorizontal: 14,
            paddingVertical: 13,
            fontFamily: fonts.medium,
            fontSize: 16,
            color: colors.foreground,
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <AppText variant="caption" tone="destructive">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  icon,
  style,
}: {
  title: string;
  onPress?: PressableProps["onPress"];
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  icon?: keyof typeof Feather.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const isDisabled = disabled || loading;

  const bg: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.secondary,
    destructive: colors.destructive,
    ghost: "transparent",
  };
  const fg: Record<ButtonVariant, string> = {
    primary: colors.primaryForeground,
    secondary: colors.secondaryForeground,
    destructive: colors.destructiveForeground,
    ghost: colors.foreground,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: bg[variant],
          borderRadius: colors.radius,
          paddingVertical: 15,
          paddingHorizontal: 18,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: colors.border,
          opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={18} color={fg[variant]} /> : null}
          <Text
            style={{ fontFamily: fonts.semibold, fontSize: 16, color: fg[variant] }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <View
      style={[
        { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        style,
      ]}
    />
  );
}
