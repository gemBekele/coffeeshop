import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { parseScanText } from "@coffeeshop/shared";
import {
  Btn,
  colors,
  radius,
  Screen,
  SettingsGroup,
  SettingsRow,
  Subtitle,
} from "../../ui/kit";
import { Ocr } from "../../../modules/ocr";
import { useApp } from "../../state/AppContext";
import { onSocketEvent } from "../../lib/socket";
import type { ScanResult } from "../../api/client";

interface Parsed {
  amount?: number;
  txnId?: string;
  sender?: string;
}

export function VerifyScreen({ onBack }: { onBack?: () => void } = {}) {
  const { api } = useApp();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<"scan" | "processing" | "result">("scan");
  const [parsed, setParsed] = useState<Parsed>({});
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // When the shop later receives the matching SMS, the server emits scan:matched.
  useEffect(() => {
    const onMatched = (payload?: unknown) => {
      const p = payload as { scanId?: string } | undefined;
      if (!p?.scanId) return;
      setResult((prev) =>
        prev && prev.scan.id === p.scanId
          ? { ...prev, status: "MATCHED" }
          : prev,
      );
    };
    return onSocketEvent("scan:matched", onMatched);
  }, []);

  const reset = () => {
    setPhase("scan");
    setResult(null);
    setParsed({});
    setError(null);
  };

  const capture = async () => {
    if (!cameraRef.current) return;
    setPhase("processing");
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) throw new Error("Could not capture image");
      if (!Ocr.isAvailable()) throw new Error("OCR is not available in this build");
      const { text } = await Ocr.recognizeText(photo.uri);
      const found = parseScanText(text);
      setParsed(found);
      if (found.amount === undefined && !found.txnId) {
        setError("Could not read the payment. Try again with the amount visible.");
        setPhase("result");
        return;
      }
      const scan = await api.scanPayment({
        txnId: found.txnId,
        amount: found.amount,
        sender: found.sender,
        rawText: text,
      });
      setResult(scan);
      setPhase("result");
    } catch (err) {
      setError((err as Error).message);
      setPhase("result");
    }
  };

  if (!permission) {
    return (
      <Screen title="Verify payment" onBack={onBack}>
        <Subtitle>Preparing camera…</Subtitle>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen title="Verify payment" onBack={onBack}>
        <Subtitle>
          The camera reads the payment confirmation on the customer's phone, so
          it can be confirmed when the shop's SMS arrives.
        </Subtitle>
        <Btn label="Allow camera" onPress={requestPermission} />
      </Screen>
    );
  }

  if (phase === "scan" || phase === "processing") {
    return (
      <Screen title="Verify payment" onBack={onBack} scroll={false}>
        <View style={styles.cameraWrap}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <View style={styles.frame} pointerEvents="none" />
        </View>
        <Subtitle>
          Point at the customer's payment screen. You can scan even before the
          SMS arrives — it is confirmed automatically.
        </Subtitle>
        <Btn
          label={phase === "processing" ? "Reading…" : "Capture"}
          onPress={capture}
          disabled={phase === "processing"}
        />
      </Screen>
    );
  }

  const matched = result?.status === "MATCHED";
  const amount = parsed.amount ?? result?.payment?.amount;
  const hasDetails = !!(parsed.txnId || parsed.sender);

  return (
    <Screen title="Verify payment" onBack={onBack}>
      <View
        style={[
          styles.resultCard,
          { backgroundColor: matched ? colors.brand : "#B45309" },
        ]}
      >
        <Text style={styles.resultIcon}>{matched ? "✓" : "⧗"}</Text>
        <Text style={styles.resultTitle}>
          {matched ? "Payment verified" : "Waiting for the SMS"}
        </Text>
        {amount !== undefined ? (
          <Text style={styles.resultAmount}>
            ETB {amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        ) : null}
        <Text style={styles.resultSub}>
          {matched
            ? result?.order
              ? `Matched to order #${result.order.orderNumber}`
              : "Matched the received transfer"
            : "Saved. It confirms itself when the matching SMS arrives."}
        </Text>
      </View>

      {hasDetails ? (
        <SettingsGroup label="From the customer's screen">
          {parsed.txnId ? (
            <SettingsRow
              title="Transaction ID"
              value={parsed.txnId}
              last={!parsed.sender}
            />
          ) : null}
          {parsed.sender ? (
            <SettingsRow title="Sender" value={parsed.sender} last />
          ) : null}
        </SettingsGroup>
      ) : null}

      {error ? <Subtitle>{error}</Subtitle> : null}

      <Btn
        label="Scan another"
        variant={matched ? "primary" : "outline"}
        onPress={reset}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    flex: 1,
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: "#000",
    minHeight: 320,
  },
  camera: { flex: 1 },
  frame: {
    position: "absolute",
    left: "8%",
    right: "8%",
    top: "22%",
    bottom: "22%",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 20,
  },
  resultCard: {
    borderRadius: radius.card,
    padding: 24,
    alignItems: "center",
    gap: 4,
  },
  resultIcon: { fontSize: 34, color: "#FFFFFF", fontWeight: "800" },
  resultTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  resultAmount: {
    fontSize: 38,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  resultSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginTop: 4,
  },
});
