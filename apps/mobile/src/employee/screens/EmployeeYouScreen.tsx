import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Btn,
  Card,
  colors,
  Screen,
  SettingsGroup,
  SettingsRow,
  StatPair,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { MeResult } from "../../api/client";

export function EmployeeYouScreen() {
  const { api, session, signOut } = useApp();
  const [me, setMe] = useState<MeResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.me().then(setMe).catch(() => {});
  }, [api]);

  const role = session?.staff.role
    ? session.staff.role.charAt(0) + session.staff.role.slice(1).toLowerCase()
    : "";

  return (
    <Screen title="You" footer={<Btn label="Sign out" variant="outline" onPress={async () => {
      if (busy) return;
      setBusy(true);
      await signOut();
    }} />}>
      <Card>
        <Text style={styles.name}>{session?.staff.fullName ?? "Employee"}</Text>
        <Text style={styles.shop}>{me?.shop?.name ?? "CoffeeShop"}</Text>
        <Text style={styles.role}>{role}</Text>
      </Card>

      <SettingsGroup label="Account">
        <SettingsRow title="Role" value={role} />
        <SettingsRow
          title="Signed in on this phone"
          subtitle="You stay signed in until you sign out here."
          last
        />
      </SettingsGroup>

      {me?.shop ? (
        <SettingsGroup label="Shop">
          <StatPair label="Currency" value={me.shop.currency} last />
        </SettingsGroup>
      ) : null}

      <Subtitle>
        Signing out removes this account from this phone. You will need a new QR
        code from the owner to sign in again.
      </Subtitle>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 24, fontWeight: "800", color: colors.text },
  shop: { fontSize: 16, fontWeight: "600", color: colors.textMuted },
  role: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brand,
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
