import React, { useState } from "react";
import { View } from "react-native";
import {
  Btn,
  Card,
  Input,
  NumberPad,
  Screen,
  SectionTitle,
  Subtitle,
  Title,
} from "../ui/kit";
import { useApp } from "../state/AppContext";

export function LoginScreen({ onActivate }: { onActivate: () => void }) {
  const { api, signIn } = useApp();
  const [identifier, setIdentifier] = useState("owner@coffeeshop.local");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pin.length < 4) {
      setError("Enter your PIN");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.login(identifier, pin);
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
      <View style={{ gap: 6, marginBottom: 6 }}>
        <Title>CoffeeShop</Title>
        <Subtitle>Owner & staff sign in</Subtitle>
      </View>

      <Input
        label="Email or phone"
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="owner@coffeeshop.local"
        keyboardType="email-address"
      />

      <Card>
        <SectionTitle>Enter PIN</SectionTitle>
        <View style={pinStyles.pinRow}>
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <View
              key={i}
              style={[pinStyles.dot, i < pin.length && pinStyles.dotFilled]}
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
        <Btn label={busy ? "Signing in…" : "Sign in"} onPress={submit} disabled={busy} />
      </Card>

      <Btn
        label="New employee? Activate with QR"
        onPress={onActivate}
        variant="outline"
      />
    </Screen>
  );
}

const pinStyles = {
  pinRow: { flexDirection: "row" as const, gap: 12, justifyContent: "center" as const, paddingVertical: 8 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#000000" },
  dotFilled: { backgroundColor: "#000000" },
};