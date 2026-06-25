import { useAuth } from "@clerk/expo";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Redirect, Stack } from "expo-router";
import React, { useEffect } from "react";

import { useSubscription } from "@/lib/revenuecat";

export default function HomeLayout() {
  const { isSignedIn, isLoaded, getToken, userId } = useAuth();
  const { logIn } = useSubscription();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (isSignedIn && userId) {
      logIn(userId);
    }
  }, [isSignedIn, userId, logIn]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="account" />
      <Stack.Screen name="paywall" />
    </Stack>
  );
}
