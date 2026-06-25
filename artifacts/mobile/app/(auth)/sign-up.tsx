import { useSignUp } from "@clerk/expo";
import { Link, type Href, useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import { AuthShell } from "@/components/AuthShell";
import { AppText, Button, Field } from "@/components/Themed";

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pendingVerification, setPendingVerification] = React.useState(false);
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
    const { error } = await signUp.password({ emailAddress, password });
    if (error) {
      setFormError("Couldn't create your account. Try a stronger password.");
      return;
    }
    await signUp.verifications.sendEmailCode();
    setPendingVerification(true);
  };

  const handleVerify = async () => {
    setFormError(null);
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          goHome(decorateUrl);
        },
      });
    } else {
      setFormError("That code didn't work. Request a new one and try again.");
    }
  };

  if (pendingVerification) {
    return (
      <AuthShell
        title="Verify your email"
        subtitle="Enter the 6-digit code we just sent to your inbox."
      >
        <Field
          label="Verification code"
          keyboardType="number-pad"
          value={code}
          placeholder="123456"
          onChangeText={setCode}
          error={formError ?? errors?.fields?.code?.message ?? undefined}
        />
        <Button
          title="Verify and continue"
          onPress={handleVerify}
          loading={fetchStatus === "fetching"}
          disabled={!code}
        />
        <Pressable
          hitSlop={8}
          style={{ alignSelf: "center" }}
          onPress={() => signUp.verifications.sendEmailCode()}
        >
          <AppText variant="caption" tone="primary">
            Resend code
          </AppText>
        </Pressable>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start running your construction business from your pocket."
    >
      <Field
        label="Email address"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={emailAddress}
        placeholder="you@company.com"
        onChangeText={setEmailAddress}
        error={errors?.fields?.emailAddress?.message ?? undefined}
      />
      <Field
        label="Password"
        secureTextEntry
        autoComplete="password-new"
        value={password}
        placeholder="At least 8 characters"
        onChangeText={setPassword}
        error={formError ?? errors?.fields?.password?.message ?? undefined}
      />

      <Button
        title="Create account"
        onPress={handleSubmit}
        loading={fetchStatus === "fetching"}
        disabled={!emailAddress || !password}
      />

      {/* Required for sign-up flows. Clerk's bot sign-up protection is enabled by default */}
      <View nativeID="clerk-captcha" />

      <View style={{ flexDirection: "row", justifyContent: "center" }}>
        <AppText variant="caption" tone="muted">
          Already have an account?{" "}
        </AppText>
        <Link href="/sign-in" asChild>
          <Pressable hitSlop={8}>
            <AppText variant="caption" tone="primary">
              Sign in
            </AppText>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}
