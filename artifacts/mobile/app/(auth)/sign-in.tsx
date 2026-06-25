import { useSSO, useSignIn } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import { Link, type Href, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { Platform, Pressable, View } from "react-native";

import { AuthShell } from "@/components/AuthShell";
import { AppText, Button, Divider, Field } from "@/components/Themed";
import { useColors } from "@/hooks/useColors";

export const useWarmUpBrowser = () => {
  React.useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [appleLoading, setAppleLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const goHome = (decorateUrl: (u: string) => string) => {
    const url = decorateUrl("/");
    if (url.startsWith("http")) {
      window.location.href = url;
    } else {
      router.replace(url as Href);
    }
  };

  const handleSubmit = async () => {
    setFormError(null);
    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      setFormError("Couldn't sign you in. Check your email and password.");
      return;
    }
    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          goHome(decorateUrl);
        },
      });
    } else {
      setFormError("Additional verification is required to sign in.");
    }
  };

  const handleApple = async () => {
    setFormError(null);
    setAppleLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_apple",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            goHome(decorateUrl);
          },
        });
      }
    } catch {
      setFormError(
        "Apple sign in is unavailable. Enable Apple in the Clerk dashboard, or use email and password.",
      );
    } finally {
      setAppleLoading(false);
    }
  };

  const fieldError =
    formError ??
    errors?.fields?.identifier?.message ??
    errors?.fields?.password?.message ??
    null;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your jobs, estimates, and crews."
    >
      <Field
        label="Email address"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={emailAddress}
        placeholder="you@company.com"
        onChangeText={setEmailAddress}
      />
      <Field
        label="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        placeholder="Enter your password"
        onChangeText={setPassword}
        error={fieldError ?? undefined}
      />

      <View style={{ alignItems: "flex-end" }}>
        <Link href="/reset-password" asChild>
          <Pressable hitSlop={8}>
            <AppText variant="caption" tone="primary">
              Forgot password?
            </AppText>
          </Pressable>
        </Link>
      </View>

      <Button
        title="Sign in"
        onPress={handleSubmit}
        loading={fetchStatus === "fetching"}
        disabled={!emailAddress || !password}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Divider style={{ flex: 1 }} />
        <AppText variant="caption" tone="muted">
          or
        </AppText>
        <Divider style={{ flex: 1 }} />
      </View>

      <Pressable
        onPress={handleApple}
        disabled={appleLoading}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: colors.foreground,
          borderRadius: colors.radius,
          paddingVertical: 15,
          opacity: appleLoading ? 0.55 : pressed ? 0.85 : 1,
        })}
      >
        <Ionicons name="logo-apple" size={20} color={colors.background} />
        <AppText
          variant="subtitle"
          style={{ color: colors.background, fontFamily: undefined }}
        >
          Sign in with Apple
        </AppText>
      </Pressable>

      <View
        style={{ flexDirection: "row", justifyContent: "center", paddingTop: 4 }}
      >
        <AppText variant="caption" tone="muted">
          New to BuildPro?{" "}
        </AppText>
        <Link href="/sign-up" asChild>
          <Pressable hitSlop={8}>
            <AppText variant="caption" tone="primary">
              Create an account
            </AppText>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}
