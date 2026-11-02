import React, { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Card,
  KeyValue,
  Loading,
  Screen,
  SectionTitle,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import { ContributionChart } from "../../ui/ContributionChart";
import type {
  CalendarData,
  CalendarDay,
  ReportInventory,
  ReportSummary,
} from "../../api/client";

const money = (n: number) =>
  `ETB ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export function ReportsScreen({ onBack }: { onBack: () => void }) {
  const { api } = useApp();
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [top, setTop] = useState<Array<{ name: string; quantity: number; revenue: number }>>([]);
  const [inventory, setInventory] = useState<ReportInventory | null>(null);
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  useEffect(() => {
    api.reportSummary().then(setSummary).catch(() => {});
    api.reportTopProducts().then(setTop).catch(() => {});
    api.reportInventory().then(setInventory).catch(() => {});
    api.calendar(12).then(setCalendar).catch(() => {});
  }, [api]);

  if (!summary) {
    return (
      <Screen title="Reports" onBack={onBack}>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen title="Reports" onBack={onBack}>
      <Card>
        <SectionTitle>Daily performance · 12 weeks</SectionTitle>
        {calendar ? (
          <>
            <ContributionChart
              days={calendar.days}
              selected={selectedDay?.date ?? null}
              onSelect={setSelectedDay}
            />
            {selectedDay ? (
              <View style={{ gap: 2 }}>
                <KeyValue label="Day" value={dayLabel(selectedDay.date)} />
                <KeyValue label="Sales" value={money(selectedDay.sales)} />
                <KeyValue label="Orders" value={String(selectedDay.orders)} />
                <KeyValue label="Bank" value={money(selectedDay.bank)} />
                <KeyValue
                  label="Cash (calculated)"
                  value={money(selectedDay.cash)}
                />
              </View>
            ) : (
              <Subtitle>Tap a day to see its numbers.</Subtitle>
            )}
          </>
        ) : (
          <Subtitle>Loading chart…</Subtitle>
        )}
      </Card>

      <Card>
        <SectionTitle>Sales · last 30 days</SectionTitle>
        <KeyValue label="Gross" value={summary.orders.grossSales.toFixed(2)} />
        <KeyValue label="Paid orders" value={String(summary.orders.paidCount)} />
        <KeyValue label="Average" value={summary.orders.averageOrderValue.toFixed(2)} />
        <KeyValue label="Open orders" value={String(summary.orders.openCount)} />
      </Card>

      <Card>
        <SectionTitle>Payments</SectionTitle>
        {summary.payments.length === 0 ? (
          <Subtitle>No payments yet.</Subtitle>
        ) : (
          summary.payments.map((p) => (
            <KeyValue
              key={p.status}
              label={p.status}
              value={`${p.count} · ${p.amount.toFixed(2)}`}
            />
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>Top products</SectionTitle>
        {top.length === 0 ? (
          <Subtitle>No sales yet.</Subtitle>
        ) : (
          top.map((t) => (
            <KeyValue
              key={t.name}
              label={`${t.name} ×${t.quantity}`}
              value={t.revenue.toFixed(2)}
            />
          ))
        )}
      </Card>

      {inventory ? (
        <Card>
          <SectionTitle>Inventory</SectionTitle>
          <KeyValue label="Stock value" value={inventory.totalValue.toFixed(2)} />
          <KeyValue label="Low stock" value={String(inventory.lowStockCount)} />
        </Card>
      ) : null}
    </Screen>
  );
}