import { useAuth } from "@clerk/expo";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Redirect, Stack } from "expo-router";
import React, { useEffect } from "react";

export default function HomeLayout() {
  const { isSignedIn, isLoaded, getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="account" />
    </Stack>
  );
}
