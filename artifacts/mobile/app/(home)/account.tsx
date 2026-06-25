import { useAuth, useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import {
  useDeleteAccount,
  useGetCompany,
  useRequestDataDeletion,
  useUpdateCompany,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { AppText, Button, Card, Field } from "@/components/Themed";
import { useColors } from "@/hooks/useColors";

function confirm(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
  destructive = false,
) {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    {
      text: confirmLabel,
      style: destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
}

export default function AccountScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useAuth();

  const { data: company, isLoading } = useGetCompany();
  const updateCompany = useUpdateCompany();
  const deleteAccount = useDeleteAccount();
  const requestDataDeletion = useRequestDataDeletion();

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
    }
  }, [user]);

  React.useEffect(() => {
    if (company) {
      setName(company.name ?? "");
      setPhone(company.phone ?? "");
      setEmail(company.email ?? "");
    }
  }, [company]);

  const handleSave = async () => {
    setSaved(false);
    try {
      if (
        user &&
        (firstName !== (user.firstName ?? "") ||
          lastName !== (user.lastName ?? ""))
      ) {
        await user.update({ firstName, lastName });
      }
      await updateCompany.mutateAsync({
        data: { name, phone, email },
      });
      setSaved(true);
    } catch {
      Alert.alert("Couldn't save", "Please try again in a moment.");
    }
  };

  const handleRequestDataDeletion = () => {
    confirm(
      "Request data deletion",
      "This permanently erases your business data (clients, jobs, estimates, invoices, photos) but keeps your login. This cannot be undone.",
      "Erase data",
      async () => {
        try {
          await requestDataDeletion.mutateAsync();
          Alert.alert("Done", "Your business data has been erased.");
        } catch {
          Alert.alert("Couldn't complete", "Please try again later.");
        }
      },
      true,
    );
  };

  const handleDeleteAccount = () => {
    confirm(
      "Delete account",
      "This permanently deletes your account and all associated data. This cannot be undone.",
      "Delete account",
      async () => {
        try {
          await deleteAccount.mutateAsync();
          await signOut();
          router.replace("/sign-in");
        } catch {
          Alert.alert("Couldn't delete", "Please try again later.");
        }
      },
      true,
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
        <Pressable
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </Pressable>
        <AppText variant="heading">Account & data</AppText>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        <View style={{ gap: 14 }}>
          <AppText variant="label" tone="muted" style={{ marginLeft: 2 }}>
            Your information
          </AppText>
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Field
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last"
              />
            </View>
          </View>
          <Field
            label="Company name"
            value={name}
            onChangeText={setName}
            placeholder="Your company"
          />
          <Field
            label="Company phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="(555) 555-5555"
          />
          <Field
            label="Company email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="hello@company.com"
          />
          {saved ? (
            <AppText variant="caption" tone="primary">
              Changes saved.
            </AppText>
          ) : null}
          <Button
            title="Save changes"
            icon="check"
            onPress={handleSave}
            loading={updateCompany.isPending}
            disabled={isLoading}
          />
        </View>

        <Card style={{ gap: 14, borderColor: colors.destructive }}>
          <View style={{ gap: 4 }}>
            <AppText variant="heading" tone="destructive">
              Danger zone
            </AppText>
            <AppText variant="caption" tone="muted">
              These actions are permanent and cannot be undone.
            </AppText>
          </View>
          <Button
            title="Request data deletion"
            variant="secondary"
            onPress={handleRequestDataDeletion}
            loading={requestDataDeletion.isPending}
          />
          <Button
            title="Delete account"
            variant="destructive"
            icon="trash-2"
            onPress={handleDeleteAccount}
            loading={deleteAccount.isPending}
          />
        </Card>
      </KeyboardAwareScrollViewCompat>
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
  content: { padding: 18, gap: 24, maxWidth: 560, width: "100%", alignSelf: "center" },
  nameRow: { flexDirection: "row", gap: 12 },
});
