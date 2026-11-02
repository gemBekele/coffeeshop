import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "./theme";
import type { CalendarDay } from "../api/client";

/** Five tones from empty to busiest (brand greens). */
const LEVELS = ["#E9EEF3", "#D8EFE1", "#A9D6BC", "#5C9776", "#1B4332"];

const dayOf = (date: string) => new Date(`${date}T00:00:00Z`);

/**
 * GitHub-style contribution grid: 7 rows (Mon–Sun) × N week columns, one cell
 * per day. Tap a cell to inspect that day.
 */
export function ContributionChart({
  days,
  selected,
  onSelect,
}: {
  days: CalendarDay[];
  selected: string | null;
  onSelect: (day: CalendarDay) => void;
}) {
  if (days.length === 0) return null;

  // Monday-first layout.
  const lead = (dayOf(days[0].date).getUTCDay() + 6) % 7;
  const cols = Math.ceil((lead + days.length) / 7);
  const grid: Array<Array<CalendarDay | null>> = Array.from({ length: 7 }, () =>
    Array<CalendarDay | null>(cols).fill(null),
  );
  days.forEach((day, index) => {
    const pos = lead + index;
    grid[pos % 7][Math.floor(pos / 7)] = day;
  });

  const max = Math.max(1, ...days.map((d) => d.sales));
  const level = (sales: number) => {
    if (sales <= 0) return 0;
    const ratio = sales / max;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  const monthFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const today = days[days.length - 1].date;
  const firstOfColumn = (col: number) => {
    for (let row = 0; row < 7; row++) {
      const day = grid[row][col];
      if (day) return day;
    }
    return null;
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.monthRow}>
        {Array.from({ length: cols }).map((_, col) => {
          const first = firstOfColumn(col);
          if (!first) return null;
          const prev = col > 0 ? firstOfColumn(col - 1) : null;
          const changed =
            !prev ||
            dayOf(prev.date).getUTCMonth() !== dayOf(first.date).getUTCMonth();
          if (!changed) return null;
          return (
            <Text
              key={col}
              numberOfLines={1}
              style={[
                styles.monthText,
                { left: col * (CELL + GAP) },
              ]}
            >
              {monthFmt.format(dayOf(first.date))}
            </Text>
          );
        })}
      </View>

      <View style={styles.gridRow}>
        {Array.from({ length: cols }).map((_, col) => (
          <View key={col} style={styles.col}>
            {Array.from({ length: 7 }).map((__, row) => {
              const day = grid[row][col];
              if (!day) return <View key={row} style={styles.cellEmpty} />;
              const isSelected = selected === day.date;
              return (
                <Pressable
                  key={row}
                  onPress={() => onSelect(day)}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.date}: ETB ${day.sales.toFixed(
                    2,
                  )} from ${day.orders} sales`}
                  style={[
                    styles.cell,
                    { backgroundColor: LEVELS[level(day.sales)] },
                    day.date === today && styles.today,
                    isSelected && styles.selected,
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.legendRow}>
        <Text style={styles.legendText}>Less</Text>
        {LEVELS.map((color, index) => (
          <View
            key={index}
            style={[styles.legendCell, { backgroundColor: color }]}
          />
        ))}
        <Text style={styles.legendText}>More</Text>
      </View>
    </View>
  );
}

const CELL = 16;
const GAP = 3;

const styles = StyleSheet.create({
  monthRow: { height: 13, position: "relative" },
  monthText: {
    position: "absolute",
    top: 0,
    width: 30,
    fontSize: 9,
    lineHeight: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  gridRow: { flexDirection: "row", gap: GAP },
  col: { gap: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  cellEmpty: { width: CELL, height: CELL, borderRadius: 3, backgroundColor: "transparent" },
  today: { borderWidth: 1, borderColor: colors.brand },
  selected: { borderWidth: 1.5, borderColor: colors.text },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "flex-end",
  },
  legendText: { fontSize: 10, color: colors.textMuted },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
});
