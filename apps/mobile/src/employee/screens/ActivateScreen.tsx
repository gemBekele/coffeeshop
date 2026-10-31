import React, { useState } from "react";
import { Text, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import {
  Btn,
  Card,
  colors,
  Screen,
  SectionTitle,
  Subtitle,
  Title,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { ClaimResult } from "../../api/client";

/**
 * Employee-side activation: the owner opens their app and shows the join QR;
 * this phone scans it and is signed in immediately. No code, no approval step.
 */
export function ActivateScreen({ onDone }: { onDone: () => void }) {
  const { api, signIn } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [claimed, setClaimed] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);

  const join = async ({ data }: BarcodeScanningResult) => {
    if (claimed || busy) return;
    setScanned(true);
    setBusy(true);
    setError(null);
    try {
      const token = String(data).trim();
      const result = await api.pairingClaim(token);
      setClaimed(result);
      await signIn({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        staff: result.staff,
      });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const rescan = () => {
    setClaimed(null);
    setScanned(false);
    setBusy(false);
    setError(null);
  };

  if (!permission) {
    return (
      <Screen title="Join the shop" onBack={onDone}>
        <Subtitle>Preparing camera…</Subtitle>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen title="Join the shop" onBack={onDone}>
        <View style={{ gap: 12 }}>
          <Title>Camera access</Title>
          <Subtitle>
            The camera is used only to read the join QR code your shop owner
            shows you.
          </Subtitle>
          <Btn label="Allow camera" onPress={requestPermission} />
        </View>
      </Screen>
    );
  }

  if (claimed) {
    return (
      <Screen title="Join the shop" onBack={onDone}>
        <View style={{ gap: 12, alignItems: "center", paddingTop: 30 }}>
          <Title>Joined ✓</Title>
          <Subtitle>
            You are in{claimed.shopName ? ` ${claimed.shopName}` : " the shop"}.
            Your account now lives on this phone.
          </Subtitle>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="Join the shop"
      onBack={onDone}
      scroll={false}
      footer={
        <Btn
          label="Cancel"
          variant="outline"
          onPress={() => {
            setScanned(false);
            setError(null);
            onDone();
          }}
        />
      }
    >
      <View style={{ flex: 1, gap: 12 }}>
        <View
          style={{
            flex: 1,
            borderRadius: 24,
            borderWidth: 2,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanned ? undefined : join}
          />
        </View>

        <Card>
          <SectionTitle>One scan and you're in</SectionTitle>
          <Subtitle>
            Ask the owner to open their app → Staff → + Add employee and show
            you the QR code.
          </Subtitle>
          {error ? <Subtitle>{error}</Subtitle> : null}
          {busy ? <Subtitle>Joining…</Subtitle> : null}
        </Card>
      </View>
    </Screen>
  );
}
