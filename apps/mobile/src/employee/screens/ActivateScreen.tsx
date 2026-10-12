import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import {
  Badge,
  Btn,
  Card,
  Input,
  Screen,
  SectionTitle,
  Subtitle,
  Title,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { PairingRequest } from "../../api/client";

const POLL_MS = 2500;

/**
 * Employee-side activation.
 *
 * 1. Employee types the short code the owner gave them.
 * 2. The phone shows a QR code.
 * 3. The owner scans it with their phone and approves.
 * 4. This screen detects the approval and signs the employee in.
 */
export function ActivateScreen({ onDone }: { onDone: () => void }) {
  const { api, signIn } = useApp();
  const [step, setStep] = useState<"code" | "waiting" | "done" | "expired">("code");
  const [code, setCode] = useState("");
  const [pairing, setPairing] = useState<PairingRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const poll = useCallback(
    async (token: string) => {
      try {
        const status = await api.pairingStatus(token);
        if (status.approved && status.accessToken && status.staff) {
          stopPolling();
          setStep("done");
          await signIn({
            accessToken: status.accessToken,
            refreshToken: status.refreshToken ?? "",
            staff: status.staff,
          });
          return;
        }
        if (status.expired) {
          stopPolling();
          setStep("expired");
        }
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [api, signIn, stopPolling],
  );

  const request = async () => {
    setError(null);
    if (code.trim().length < 3) {
      setError("Enter the code from the owner");
      return;
    }
    try {
      const result = await api.pairingRequest(code.trim());
      setPairing(result);
      setStep("waiting");
      setSecondsLeft(
        Math.max(0, Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000)),
      );
      stopPolling();
      timer.current = setInterval(() => {
        void poll(result.token);
        setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      }, POLL_MS);
      void poll(result.token);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const restart = () => {
    stopPolling();
    setPairing(null);
    setCode("");
    setStep("code");
    setError(null);
  };

  return (
    <Screen
      title="Activate account"
      onBack={onDone}
      footer={
        step === "waiting" ? (
          <Btn label="Cancel" variant="outline" onPress={restart} />
        ) : step === "code" ? (
          <Btn label="Show my QR" onPress={request} />
        ) : (
          <Btn label="Start over" variant="outline" onPress={restart} />
        )
      }
    >
      {step === "code" ? (
        <>
          <Title>Scan-free setup</Title>
          <Subtitle>
            Ask the shop owner for your short code, then show them the QR code on
            this phone. They scan it and you are signed in.
          </Subtitle>
          <Card>
            <SectionTitle>Your employee code</SectionTitle>
            <Input
              value={code}
              onChangeText={setCode}
              placeholder="CS-1234"
              autoCapitalize="sentences"
            />
            {error ? <Subtitle>{error}</Subtitle> : null}
          </Card>
        </>
      ) : null}

      {step === "waiting" && pairing ? (
        <View style={{ alignItems: "center", gap: 16 }}>
          <Card tone="invert" style={{ alignSelf: "stretch" }}>
            <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "900" }}>
              {pairing.staffName}
            </Text>
            <Text style={{ color: "#FFFFFF", fontSize: 16 }}>{pairing.shopName}</Text>
            <Badge label={pairing.code} tone="outline" />
          </Card>

          <Subtitle>Owner: scan this code with your phone</Subtitle>

          <View style={{ backgroundColor: "#FFFFFF", padding: 20, borderWidth: 3, borderColor: "#000000" }}>
            <QRCode value={pairing.token} size={230} backgroundColor="#FFFFFF" color="#000000" />
          </View>

          <Badge
            label={secondsLeft > 0 ? `expires in ${secondsLeft}s` : "expired"}
            tone={secondsLeft > 0 ? "outline" : "muted"}
          />
          <Subtitle>Waiting for the owner to approve…</Subtitle>
        </View>
      ) : null}

      {step === "done" ? (
        <View style={{ gap: 12, alignItems: "center" }}>
          <Title>Activated</Title>
          <Subtitle>Your account is now on this phone.</Subtitle>
        </View>
      ) : null}

      {step === "expired" ? (
        <View style={{ gap: 12, alignItems: "center" }}>
          <Title>Code expired</Title>
          <Subtitle>Ask the owner to scan a fresh code.</Subtitle>
        </View>
      ) : null}
    </Screen>
  );
}