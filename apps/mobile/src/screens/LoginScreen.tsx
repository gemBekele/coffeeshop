import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Btn,
  Card,
  colors,
  Input,
  NumberPad,
  Screen,
  Subtitle,
} from "../ui/kit";
import { useApp } from "../state/AppContext";
import { prefs } from "../lib/session";

export function LoginScreen({
  onActivate,
  onRegister,
}: {
  onActivate: () => void;
  onRegister: () => void;
}) {
  const { api, signIn } = useApp();
  const [identifier, setIdentifier] = useState("owner@coffeeshop.local");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    prefs
      .getIdentifier()
      .then((saved) => {
        if (saved) setIdentifier(saved);
      })
      .catch(() => {});
  }, []);

  const submit = async () => {
    if (pin.length < 4) {
      setError("Enter your 4-digit PIN");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.login(identifier.trim(), pin);
      void prefs.setIdentifier(identifier.trim()).catch(() => {});
      await signIn({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        staff: result.staff,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.welcome}>Welcome back</Text>
        <Text style={styles.brand}>CoffeeShop</Text>
      </View>

      <Input
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="Email or phone"
        keyboardType="email-address"
      />

      <Card>
        <Text style={styles.pinLabel}>Enter PIN</Text>
        <View style={styles.pinRow}>
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i < pin.length && styles.dotFilled]}
            />
          ))}
        </View>

        <NumberPad
          value={pin}
          onChange={setPin}
          maxLength={8}
          leftKey={{ label: "C", onPress: () => setPin("") }}
        />

        {error ? <Subtitle>{error}</Subtitle> : null}
        <Btn
          label={busy ? "Signing in…" : "Sign in"}
          onPress={submit}
          disabled={busy}
        />
      </Card>

      <Btn
        label="Staff phone? Activate with QR"
        onPress={onActivate}
        variant="outline"
      />

      <Btn label="New shop? Create account" onPress={onRegister} variant="ghost" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: 32,
    gap: 2,
  },
  welcome: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
  brand: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.brand,
    letterSpacing: -0.5,
  },
  pinLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textAlign: "center",
  },
  pinRow: {
    flexDirection: "row",
    gap: 14,
    justifyContent: "center",
    paddingVertical: 6,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  dotFilled: {
    backgroundColor: colors.brand,
  },
});
