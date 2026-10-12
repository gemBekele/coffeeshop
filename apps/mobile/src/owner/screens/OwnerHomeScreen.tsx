import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import {
  Badge,
  Btn,
  Card,
  KeyValue,
  Screen,
  SectionTitle,
  Subtitle,
  Title,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import { smsCapture, type CaptureEvent } from "../../sms/service";
import { notificationCapture } from "../../notifications/service";
import type { MeResult, ReportSummary } from "../../api/client";

export function OwnerHomeScreen({ onOpenTemplates }: { onOpenTemplates: () => void }) {
  const { api, session, deviceKey, setDeviceKey, signOut } = useApp();
  const [me, setMe] = useState<MeResult | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [events, setEvents] = useState<CaptureEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [ntfRunning, setNtfRunning] = useState(false);
  const [ntfGranted, setNtfGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const smsLog = useRef<CaptureEvent[]>([]);

  useEffect(() => {
    api.me().then(setMe).catch(() => {});
    api.reportSummary().then(setSummary).catch(() => {});
  }, [api]);

  useEffect(() => {
    const unsub = smsCapture.onEvent((e) => {
      smsLog.current = [e, ...smsLog.current].slice(0, 20);
      setEvents([...smsLog.current]);
    });
    setRunning(smsCapture.isRunning());
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = notificationCapture.onEvent(() => {});
    setNtfRunning(notificationCapture.isRunning());
    setNtfGranted(notificationCapture.isPermissionGranted());
    return unsub;
  }, []);

  const register = useCallback(async () => {
    setError(null);
    try {
      const res = await api.registerDevice({
        label: `${Platform.OS} owner phone`,
        role: "OWNER",
        platform: Platform.OS === "ios" ? "ios" : "android",
      });
      await setDeviceKey(res.apiKey);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [api, setDeviceKey]);

  const toggleSms = useCallback(async () => {
    setError(null);
    if (!deviceKey) return setError("Register this phone first");
    try {
      if (smsCapture.isRunning()) smsCapture.stop();
      else await smsCapture.start(deviceKey, api);
      setRunning(smsCapture.isRunning());
    } catch (err) {
      setError((err as Error).message);
    }
  }, [api, deviceKey]);

  const toggleNtf = useCallback(async () => {
    setError(null);
    if (!deviceKey) return setError("Register this phone first");
    if (!notificationCapture.isPermissionGranted()) {
      notificationCapture.openPermissionSettings();
      return setError("Grant notification access, then start again");
    }
    try {
      if (notificationCapture.isRunning()) notificationCapture.stop();
      else await notificationCapture.start(deviceKey, api);
      setNtfRunning(notificationCapture.isRunning());
      setNtfGranted(notificationCapture.isPermissionGranted());
    } catch (err) {
      setError((err as Error).message);
    }
  }, [api, deviceKey]);

  return (
    <Screen title="Owner" scroll>
      <Card tone="invert">
        <Title>{me?.shop.name ?? "CoffeeShop"}</Title>
        <Subtitle>
          {session?.staff.fullName} · {session?.staff.role}
        </Subtitle>
      </Card>

      {summary ? (
        <Card>
          <SectionTitle>Last 30 days</SectionTitle>
          <KeyValue label="Sales" value={summary.orders.grossSales.toFixed(2)} />
          <KeyValue label="Paid orders" value={String(summary.orders.paidCount)} />
          <KeyValue label="Open orders" value={String(summary.orders.openCount)} />
          <KeyValue label="Low stock" value={String(summary.lowStockCount)} />
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Phone registration</SectionTitle>
        <Subtitle>
          {deviceKey
            ? "This phone is paired to the shop."
            : "Pair this phone to start capturing payments."}
        </Subtitle>
        {!deviceKey ? (
          <Btn label="Register this phone" onPress={register} />
        ) : (
          <View style={{ gap: 10 }}>
            <Badge label="registered" tone="invert" />
          </View>
        )}
        {error ? <Subtitle>{error}</Subtitle> : null}
      </Card>

      <Card>
        <SectionTitle>Bank app notifications</SectionTitle>
        <Subtitle>Reads payment alerts from Telebirr, CBE, Amole and Awash.</Subtitle>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Badge label={ntfRunning ? "capturing" : "stopped"} tone={ntfRunning ? "invert" : "muted"} />
          <Badge
            label={ntfGranted ? "access granted" : "access needed"}
            tone={ntfGranted ? "invert" : "muted"}
          />
        </View>
        {!ntfGranted ? (
          <Btn
            label="Grant notification access"
            onPress={() => notificationCapture.openPermissionSettings()}
            variant="outline"
          />
        ) : null}
        <Btn
          label={ntfRunning ? "Stop notifications" : "Start notifications"}
          onPress={toggleNtf}
          variant={ntfRunning ? "outline" : "primary"}
          disabled={!deviceKey}
        />
      </Card>

      <Card>
        <SectionTitle>SMS inbox</SectionTitle>
        <Subtitle>Reads payment SMS while this app is open.</Subtitle>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Badge label={running ? "capturing" : "stopped"} tone={running ? "invert" : "muted"} />
          <Badge
            label={smsCapture.smsModuleAvailable() ? "ok" : "module missing"}
            tone={smsCapture.smsModuleAvailable() ? "invert" : "muted"}
          />
        </View>
        <Btn
          label={running ? "Stop SMS capture" : "Start SMS capture"}
          onPress={toggleSms}
          variant={running ? "outline" : "primary"}
          disabled={!deviceKey}
        />
      </Card>

      {events.length > 0 ? (
        <Card tone="muted">
          <SectionTitle>Activity</SectionTitle>
          {events.slice(0, 6).map((e, i) => (
            <Text key={i} style={{ fontSize: 14, color: "#000000" }}>
              {e.message}
            </Text>
          ))}
        </Card>
      ) : null}

      <Btn label="SMS templates" onPress={onOpenTemplates} variant="outline" />
      <Btn label="Sign out" onPress={signOut} variant="outline" />
    </Screen>
  );
}