import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Btn, Card, colors, Input, Screen, Subtitle } from "../ui/kit";
import { useApp } from "../state/AppContext";
import { prefs } from "../lib/session";

export function RegisterScreen({ onBack }: { onBack: () => void }) {
  const { api, signIn } = useApp();
  const [shopName, setShopName] = useState("");
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (shopName.trim().length < 2) {
      setError("Enter your shop name");
      return;
    }
    if (fullName.trim().length < 2) {
      setError("Enter your name");
      return;
    }
    if (identifier.trim().length < 5) {
      setError("Enter an email or phone number");
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      setError("PIN must be 4 to 8 digits");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }
    setBusy(true);
    try {
      const result = await api.register({
        shopName: shopName.trim(),
        fullName: fullName.trim(),
        identifier: identifier.trim(),
        pin,
      });
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
    <Screen
      title="Create account"
      onBack={onBack}
      footer={
        <Btn
          label={busy ? "Creating…" : "Create account"}
          onPress={submit}
          disabled={busy}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>New shop</Text>
        <Text style={styles.title}>Set up CoffeeShop</Text>
        <Text style={styles.hint}>
          One account for the owner. Add your staff later with a QR code.
        </Text>
      </View>

      <Card>
        <Input
          label="Shop name"
          value={shopName}
          onChangeText={setShopName}
          placeholder="Buna House"
          autoCapitalize="words"
        />
        <Input
          label="Your name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Abebe Kebede"
          autoCapitalize="words"
        />
        <Input
          label="Email or phone"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="you@shop.com or 09…"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </Card>

      <Card>
        <Input
          label="PIN (4–8 digits)"
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, ""))}
          placeholder="1234"
          keyboardType="numeric"
          secureTextEntry
          maxLength={8}
        />
        <Input
          label="Confirm PIN"
          value={confirmPin}
          onChangeText={(v) => setConfirmPin(v.replace(/\D/g, ""))}
          placeholder="1234"
          keyboardType="numeric"
          secureTextEntry
          maxLength={8}
        />
      </Card>

      {error ? <Subtitle>{error}</Subtitle> : null}

      <Subtitle>
        Telebirr, CBE Birr, Amole and Awash payment formats are set up
        automatically.
      </Subtitle>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 4, paddingTop: 8 },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  hint: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
});
