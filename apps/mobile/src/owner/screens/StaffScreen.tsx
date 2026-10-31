import React, { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import {
  Btn,
  Card,
  colors,
  Dropdown,
  Empty,
  Input,
  ListRowCard,
  Loading,
  Screen,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { Staff, StaffInvite, StaffRole } from "../../api/client";

const ROLES: Array<{ label: string; value: StaffRole }> = [
  { label: "Barista", value: "BARISTA" },
  { label: "Cashier", value: "CASHIER" },
  { label: "Manager", value: "MANAGER" },
];

interface InviteTarget {
  staff: Staff;
  invite: StaffInvite;
}

export function StaffScreen({ onBack }: { onBack: () => void }) {
  const { api } = useApp();
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("BARISTA");
  const [busy, setBusy] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<InviteTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.staff().then(setStaff).catch(() => setStaff([]));
  }, [api]);

  useEffect(load, [load]);

  const create = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError("Enter the employee's name");
      return;
    }
    setBusy(true);
    try {
      const employee = await api.createStaff({ fullName: name.trim(), role });
      setName("");
      setRole("BARISTA");
      setAdding(false);
      if (employee.invite) {
        setInviteTarget({ staff: employee, invite: employee.invite });
      }
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const showQr = async (s: Staff) => {
    setError(null);
    try {
      const invite = await api.staffInvite(s.id);
      setInviteTarget({ staff: s, invite });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const closeQr = () => {
    setInviteTarget(null);
    load();
  };

  return (
    <Screen
      title="Staff"
      onBack={onBack}
      footer={
        inviteTarget ? (
          <Btn label="Done" variant="outline" onPress={closeQr} />
        ) : adding ? (
          <Btn label="Cancel" variant="outline" onPress={() => setAdding(false)} />
        ) : (
          <Btn label="+ Add employee" onPress={() => setAdding(true)} />
        )
      }
    >
      {inviteTarget ? (
        <Card tone="invert" style={{ alignItems: "center", gap: 10 }}>
          <Text style={styles.createdLabel}>Scan this QR on the employee's phone</Text>
          <Text style={styles.createdName}>{inviteTarget.staff.fullName}</Text>
          <View style={styles.qrBox}>
            <QRCode
              value={inviteTarget.invite.token}
              size={210}
              backgroundColor="#FFFFFF"
              color="#0F172A"
            />
          </View>
          <Text style={styles.createdHint}>
            Their app: tap "Staff phone? Activate with QR" and point the camera
            at this code. That's it — they are signed in.
          </Text>
          <Btn
            label="Show a fresh QR"
            variant="outline"
            size="md"
            onPress={() => showQr(inviteTarget.staff)}
          />
        </Card>
      ) : null}

      {adding ? (
        <Card>
          <Text style={styles.heading}>New employee</Text>
          <Input
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Abebe Kebede"
            autoCapitalize="words"
          />
          <Dropdown
            label="Role"
            title="Choose role"
            options={ROLES}
            value={role}
            onChange={setRole}
          />
          {error ? <Subtitle>{error}</Subtitle> : null}
          <Btn
            label={busy ? "Adding…" : "Add employee"}
            onPress={create}
            disabled={busy}
          />
        </Card>
      ) : null}

      {error && !adding && !inviteTarget ? <Subtitle>{error}</Subtitle> : null}

      {staff === null ? (
        <Loading />
      ) : staff.length === 0 ? (
        <Empty text="No staff accounts yet." />
      ) : (
        <View style={{ gap: 10 }}>
          {staff
            .filter((s) => s.role !== "OWNER")
            .map((s) => (
              <ListRowCard
                key={s.id}
                icon={s.fullName[0]?.toUpperCase() ?? "S"}
                title={s.fullName}
                subtitle={s.role}
                rightTop={s.isActive ? "Show QR" : "Disabled"}
                rightBottom={s.isActive ? "Add another phone" : "Tap to enable"}
                onPress={s.isActive ? () => showQr(s) : undefined}
              />
            ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "800", color: colors.text },
  createdLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
  createdName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.onInverse,
  },
  qrBox: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  createdHint: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 20,
    textAlign: "center",
  },
});
