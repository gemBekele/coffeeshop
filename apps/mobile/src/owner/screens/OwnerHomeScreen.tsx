import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  colors,
  Empty,
  ListRowCard,
  Screen,
  SectionHeader,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import { notificationCapture } from "../../notifications/service";
import { useLive } from "../../lib/live";
import type { DayClose, MeResult, Payment, UnmatchedSms } from "../../api/client";

function initials(name?: string) {
  if (!name) return "S";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const money = (currency: string, n: number) =>
  `${currency} ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function OwnerHomeScreen({
  onDayClose,
  onStaff,
  onSeeAllPayments,
  onOpenInbox,
}: {
  onDayClose: () => void;
  onStaff: () => void;
  onSeeAllPayments: () => void;
  onOpenInbox: () => void;
}) {
  const { api, session, syncCapture } = useApp();
  const [me, setMe] = useState<MeResult | null>(null);
  const [close, setClose] = useState<DayClose | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [unmatchedSms, setUnmatchedSms] = useState<UnmatchedSms[]>([]);
  const [ntfGranted, setNtfGranted] = useState(
    notificationCapture.isPermissionGranted(),
  );

  const load = useCallback(() => {
    setNtfGranted(notificationCapture.isPermissionGranted());
    api.me().then(setMe).catch(() => {});
    api.dayClose().then(setClose).catch(() => {});
    api
      .payments()
      // Home is about bank money; cash lives in the daily totals.
      .then((r) =>
        setPayments(
          r.items
            .filter(
              (p) =>
                (p.source ?? "SMS") !== "MANUAL" &&
                (p.bank ?? "").toUpperCase() !== "CASH",
            )
            .slice(0, 3),
        ),
      )
      .catch(() => {});
    api
      .smsInbox()
      .then((list) =>
        setUnmatchedSms(list.filter((i) => !i.resolvedAt).slice(0, 2)),
      )
      .catch(() => {});
  }, [api]);

  useLive(load);
  useEffect(() => {
    void syncCapture();
    return notificationCapture.onEvent(load);
  }, [load, syncCapture]);

  const currency = me?.shop.currency ?? "ETB";
  const totalSold = close?.total ?? 0;
  const bankTotal = close?.transfers.amount ?? 0;
  const cashTotal = close?.cash.amount ?? 0;
  const hasPayments = payments.length > 0 || unmatchedSms.length > 0;

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {initials(me?.fullName ?? session?.staff.fullName)}
            </Text>
          </View>
          <View>
            <Text style={styles.greetingText}>{greeting()}</Text>
            <Text style={styles.nameText}>
              {me?.fullName ?? session?.staff.fullName ?? "Shop Owner"}
            </Text>
          </View>
        </View>
      </View>

      {!ntfGranted ? (
        <Pressable
          onPress={() => notificationCapture.openPermissionSettings()}
          style={styles.banner}
        >
          <View style={styles.bannerDot} />
          <Text style={styles.bannerText}>
            Payment reading is off — turn it on to capture bank messages
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Sold today</Text>
        <Text style={styles.heroAmount}>{money(currency, totalSold)}</Text>
        <View style={styles.splitRow}>
          <View style={styles.splitBox}>
            <Text style={styles.splitLabel}>Bank</Text>
            <Text style={styles.splitValue}>{money(currency, bankTotal)}</Text>
          </View>
          <View style={styles.splitDivider} />
          <View style={styles.splitBox}>
            <Text style={styles.splitLabel}>Cash</Text>
            <Text style={styles.splitValue}>{money(currency, cashTotal)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.linksRow}>
        <Pressable onPress={onDayClose} style={styles.link}>
          <Text style={styles.linkText}>Day close</Text>
          <Text style={styles.linkChevron}>›</Text>
        </Pressable>
        <Pressable onPress={onStaff} style={styles.link}>
          <Text style={styles.linkText}>Staff QR</Text>
          <Text style={styles.linkChevron}>›</Text>
        </Pressable>
      </View>

      {hasPayments ? (
        <SectionHeader
          title="Bank payments"
          actionLabel="See all"
          onAction={onSeeAllPayments}
        />
      ) : null}

      {!hasPayments ? (
        <Empty text="No bank payments yet. Incoming transfers appear here automatically." />
      ) : (
        <View style={{ gap: 10 }}>
          {unmatchedSms.map((sms) => (
            <ListRowCard
              key={`sms-${sms.id}`}
              icon="!"
              highlight
              title={sms.sender ?? "New bank message"}
              subtitle={sms.body}
              rightTop="Add rule"
              rightBottom="One tap"
              onPress={onOpenInbox}
            />
          ))}
          {payments.map((p) => (
            <ListRowCard
              key={p.id}
              icon={p.status === "VERIFIED" ? "✓" : "•"}
              title={p.sender ?? p.bank ?? "Transfer"}
              subtitle={`Ref ${p.txnId}`}
              rightTop={money(currency, p.amount)}
              rightBottom={p.status === "VERIFIED" ? "Verified" : "Unmatched"}
            />
          ))}
        </View>
      )}

      {close?.closedAt ? (
        <Subtitle>Day closed at {new Date(close.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.</Subtitle>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 4,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.onInverse, fontWeight: "800", fontSize: 16 },
  greetingText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  nameText: { fontSize: 18, fontWeight: "800", color: colors.text },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#B45309",
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
  },
  heroCard: {
    backgroundColor: colors.brand,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.68)",
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.onInverse,
    letterSpacing: -0.8,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  splitBox: { flex: 1, alignItems: "center", gap: 2 },
  splitDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  splitLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  splitValue: { fontSize: 15, fontWeight: "800", color: colors.onInverse },
  linksRow: { flexDirection: "row", gap: 10 },
  link: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkText: { fontSize: 15, fontWeight: "700", color: colors.text },
  linkChevron: { fontSize: 20, color: colors.textMuted, marginTop: -2 },
});
