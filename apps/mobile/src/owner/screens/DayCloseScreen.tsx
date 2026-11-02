import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Btn,
  colors,
  Loading,
  radius,
  Screen,
  SettingsGroup,
  SettingsRow,
  StatPair,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import { useLive } from "../../lib/live";
import type { DayClose } from "../../api/client";

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * End-of-day consolidation: cash sales plus bank transfers in one number,
 * with the close recorded so the day is signed off.
 */
export function DayCloseScreen({
  onBack,
  onOpenPending,
}: {
  onBack: () => void;
  onOpenPending?: () => void;
}) {
  const { api } = useApp();
  const [data, setData] = useState<DayClose | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .dayClose()
      .then(setData)
      .catch((err) => setError((err as Error).message));
  }, [api]);

  useLive(load);

  const close = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setData(await api.closeDay());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <Screen title="Day close" onBack={onBack}>
        {error ? <Subtitle>{error}</Subtitle> : <Loading />}
      </Screen>
    );
  }

  const payments = data.bank.count;

  return (
    <Screen title="Day close" onBack={onBack}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Total today</Text>
        <Text style={styles.heroValue}>ETB {money(data.total)}</Text>
        <Text style={styles.heroHint}>
          {data.sales.count} {data.sales.count === 1 ? "sale" : "sales"} ·{" "}
          {payments} bank transfer{payments === 1 ? "" : "s"}
        </Text>
      </View>

      <SettingsGroup label="Where the money came from">
        <StatPair
          label="Total sales"
          hint={`${data.sales.count} ${data.sales.count === 1 ? "sale" : "sales"}`}
          value={`ETB ${money(data.sales.amount)}`}
        />
        <StatPair
          label="Bank received"
          hint={`${data.bank.count} confirmed`}
          value={`ETB ${money(data.bank.amount)}`}
        />
        <StatPair
          label="Cash (calculated)"
          hint="Sales minus confirmed bank"
          value={`ETB ${money(data.cash.amount)}`}
          strong
          last
        />
      </SettingsGroup>

      {data.surplus > 0 ? (
        <SettingsGroup label="Check">
          <SettingsRow
            title={`ETB ${money(data.surplus)} bank above sales`}
            subtitle="More transfer money than recorded sales — verify amounts."
            last
          />
        </SettingsGroup>
      ) : null}

      {data.pending.count > 0 ? (
        <SettingsGroup label="Needs a look">
          <SettingsRow
            title={`${data.pending.count} transfer${
              data.pending.count === 1 ? "" : "s"
            } not verified`}
            subtitle={`ETB ${money(data.pending.amount)} waiting to be matched`}
            value="Review"
            onPress={onOpenPending}
            last
          />
        </SettingsGroup>
      ) : null}

      {data.closedAt ? (
        <View style={styles.closed}>
          <Text style={styles.closedTitle}>Day closed</Text>
          <Text style={styles.closedTime}>at {clock(data.closedAt)}</Text>
          <Text style={styles.closedHint}>
            Cash and transfers are consolidated for {data.date}. New sales will
            be added if they come in before midnight.
          </Text>
        </View>
      ) : (
        <Btn
          label={busy ? "Closing…" : "Close day"}
          onPress={close}
          disabled={busy}
        />
      )}

      {error ? <Subtitle>{error}</Subtitle> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.brand,
    borderRadius: radius.card,
    padding: 24,
    gap: 2,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroValue: {
    fontSize: 38,
    fontWeight: "800",
    color: colors.onInverse,
    letterSpacing: -0.5,
  },
  heroHint: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  closed: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 18,
    gap: 2,
  },
  closedTitle: { fontSize: 17, fontWeight: "800", color: colors.brand },
  closedTime: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  closedHint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
});
