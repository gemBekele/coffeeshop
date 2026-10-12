import React, { useState } from "react";
import { Text, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import {
  Badge,
  Btn,
  Card,
  Screen,
  SectionTitle,
  Subtitle,
  Title,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { PairingApproved } from "../../api/client";

/** Owner-side: scan an employee's QR code and approve their account. */
export function ScanPairingScreen({ onBack }: { onBack: () => void }) {
  const { api } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<PairingApproved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);

  const onScan = async ({ data }: BarcodeScanningResult) => {
    if (scanned || busy) return;
    setScanned(true);
    setBusy(true);
    setError(null);
    try {
      const token = String(data).trim();
      const approved = await api.pairingApprove(token);
      setResult(approved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return (
      <Screen title="Scan employee" onBack={onBack}>
        <Loading label="Camera" />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen title="Scan employee" onBack={onBack}>
        <View style={{ gap: 16, paddingTop: 20 }}>
          <Title>Camera access</Title>
          <Subtitle>
            The camera is used only to read the employee's activation QR code.
          </Subtitle>
          <Btn label="Allow camera" onPress={requestPermission} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Scan employee" onBack={onBack} scroll={false}>
      <View style={{ flex: 1, gap: 12 }}>
        <View style={{ flex: 1, borderWidth: 3, borderColor: "#000000", overflow: "hidden" }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanned ? undefined : onScan}
          />
        </View>

        {result ? (
          <Card tone="invert">
            <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "900" }}>
              {result.staffName}
            </Text>
            <Text style={{ color: "#FFFFFF", fontSize: 16 }}>
              Account approved and ready on their phone.
            </Text>
            <Badge label={result.code} tone="outline" />
          </Card>
        ) : (
          <Card>
            <SectionTitle>Instructions</SectionTitle>
            <Subtitle>
              Point the camera at the QR code on the employee's phone. Approving
              signs them in on that device.
            </Subtitle>
            {error ? <Subtitle>{error}</Subtitle> : null}
            {busy ? <Subtitle>Approving…</Subtitle> : null}
          </Card>
        )}

        <Btn
          label={result ? "Scan another" : "Cancel"}
          variant="outline"
          onPress={() => {
            if (result) {
              setResult(null);
              setScanned(false);
            } else {
              onBack();
            }
          }}
        />
      </View>
    </Screen>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <View style={{ padding: 40, alignItems: "center" }}>
      <Subtitle>{label}</Subtitle>
    </View>
  );
}