import React, { useEffect, useState } from "react";
import {
  Card,
  KeyValue,
  Loading,
  Screen,
  SectionTitle,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { ReportInventory, ReportSummary } from "../../api/client";

export function ReportsScreen({ onBack }: { onBack: () => void }) {
  const { api } = useApp();
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [top, setTop] = useState<Array<{ name: string; quantity: number; revenue: number }>>([]);
  const [inventory, setInventory] = useState<ReportInventory | null>(null);

  useEffect(() => {
    api.reportSummary().then(setSummary).catch(() => {});
    api.reportTopProducts().then(setTop).catch(() => {});
    api.reportInventory().then(setInventory).catch(() => {});
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