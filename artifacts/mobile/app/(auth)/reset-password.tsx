import { useSignIn } from "@clerk/expo";
import { Link, type Href, useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import { AuthShell } from "@/components/AuthShell";
import { AppText, Button, Field } from "@/components/Themed";

type Step = "email" | "reset";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { signIn, fetchStatus } = useSignIn();

  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const goHome = (decorateUrl: (u: string) => string) => {
    const url = decorateUrl("/");
    if (url.startsWith("http")) {
      window.location.href = url;
    } else {
      router.replace(url as Href);
    }
  };

  const handleSendCode = async () => {
    setFormError(null);
    const { error } = await signIn.resetPasswordEmailCode.sendCode({ email });
    if (error) {
      setFormError("We couldn't find an account with that email.");
      return;
    }
    setStep("reset");
  };

  const handleReset = async () => {
    setFormError(null);
    const verify = await signIn.resetPasswordEmailCode.verifyCode({ code });
    if (verify.error) {
      setFormError("That code is incorrect or expired.");
      return;
    }
    const { error } = await signIn.resetPasswordEmailCode.submitPassword({
      password,
    });
    if (error) {
      setFormError("Couldn't set the new password. Try a stronger one.");
      return;
    }
    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          goHome(decorateUrl);
        },
      });
    }
  };

  if (step === "reset") {
    return (
      <AuthShell
        title="Set a new password"
        subtitle={`Enter the code sent to ${email} and choose a new password.`}
      >
        <Field
          label="Verification code"
          keyboardType="number-pad"
          value={code}
          placeholder="123456"
          onChangeText={setCode}
        />
        <Field
          label="New password"
          secureTextEntry
          autoComplete="password-new"
          value={password}
          placeholder="At least 8 characters"
          onChangeText={setPassword}
          error={formError ?? undefined}
        />
        <Button
          title="Reset password"
          onPress={handleReset}
          loading={fetchStatus === "fetching"}
          disabled={!code || !password}
        />
        <Pressable
          hitSlop={8}
          style={{ alignSelf: "center" }}
          onPress={() => setStep("email")}
        >
          <AppText variant="caption" tone="primary">
            Use a different email
          </AppText>
        </Pressable>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="We'll email you a code to reset your password."
    >
      <Field
        label="Email address"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        placeholder="you@company.com"
        onChangeText={setEmail}
        error={formError ?? undefined}
      />
      <Button
        title="Send reset code"
        onPress={handleSendCode}
        loading={fetchStatus === "fetching"}
        disabled={!email}
      />
      <View style={{ flexDirection: "row", justifyContent: "center" }}>
        <AppText variant="caption" tone="muted">
          Remembered it?{" "}
        </AppText>
        <Link href="/sign-in" asChild>
          <Pressable hitSlop={8}>
            <AppText variant="caption" tone="primary">
              Back to sign in
            </AppText>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}
