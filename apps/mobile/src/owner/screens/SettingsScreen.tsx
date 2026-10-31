import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Btn,
  Card,
  colors,
  Loading,
  NumberPad,
  radius,
  Screen,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { api } = useApp();
  const [limit, setLimit] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .settings()
      .then((s) => setLimit(String(s.paymentMaxAmount)))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoaded(true));
  }, [api]);

  const save = async () => {
    setError(null);
    setMessage(null);
    const value = Number(limit);
    if (!Number.isFinite(value) || value < 0) {
      setError("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      await api.updateSettings({ paymentMaxAmount: value });
      setMessage(`Payments up to ETB ${value.toFixed(2)} will be picked up.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <Screen title="Auto-accept limit" onBack={onBack}>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen title="Auto-accept limit" onBack={onBack}>
      <Card>
        <Text style={styles.heading}>Largest automatic payment</Text>
        <Subtitle>
          Transfers up to this amount count as sales. Anything larger stays in
          unmatched messages, because big transfers are usually not sales.
        </Subtitle>
      </Card>

      <View style={styles.amountBox}>
        <Text style={styles.amountLabel}>Maximum amount</Text>
        <Text style={styles.amountValue}>ETB {limit || "0"}</Text>
      </View>

      <NumberPad
        value={limit}
        onChange={setLimit}
        allowDecimal
        maxLength={10}
        leftKey={{ label: "C", onPress: () => setLimit("") }}
      />

      {message ? <Subtitle>{message}</Subtitle> : null}
      {error ? <Subtitle>{error}</Subtitle> : null}

      <Btn
        label={busy ? "Saving…" : "Save limit"}
        onPress={save}
        disabled={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  amountBox: {
    backgroundColor: colors.brand,
    borderRadius: radius.card,
    padding: 22,
    alignItems: "center",
    gap: 4,
  },
  amountLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  amountValue: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.onInverse,
  },
});
