import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "./theme";

export interface NumberPadProps {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  leftKey?: { label: string; onPress: () => void };
  allowDecimal?: boolean;
  rightKey?: { label: string; onPress: () => void; disabled?: boolean };
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function NumberPad({
  value,
  onChange,
  maxLength = 12,
  leftKey,
  rightKey,
  allowDecimal = false,
}: NumberPadProps) {
  const handleDigit = (d: string) => {
    if (value.length >= maxLength) return;
    if (!allowDecimal && value.includes(".") && d === ".") return;
    if (d === "." && value.endsWith(".")) return;
    if (value === "0" && d !== ".") onChange(d);
    else onChange(value + d);
  };

  const backspace = () => onChange(value.slice(0, -1));
  const clear = () => onChange("");

  const cells = useMemo(() => {
    const base: Array<string | "back" | "0" | "clear"> = [
      ...KEYS,
      leftKey ? "__left" : "clear",
      "0",
      allowDecimal ? "." : "back",
    ];
    return base;
  }, [allowDecimal, leftKey]);

  return (
    <View style={styles.pad}>
      <View style={styles.grid}>
        {cells.map((k, i) => {
          const isLeft = k === "__left";
          const isSpecial = k === "back" || k === "clear" || isLeft;
          return (
            <Pressable
              key={i}
              onPress={() => {
                if (k === "back") backspace();
                else if (k === "clear") clear();
                else if (isLeft) leftKey?.onPress();
                else handleDigit(k as string);
              }}
              style={({ pressed }) => [
                styles.key,
                isSpecial && styles.keySpecial,
                pressed && styles.keyPressed,
              ]}
            >
              <Text style={[styles.keyText, isSpecial && styles.keySpecialText]}>
                {isLeft ? leftKey?.label : k === "back" ? "⌫" : k === "clear" ? "C" : k}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {rightKey ? (
        <Pressable
          onPress={rightKey.onPress}
          disabled={rightKey.disabled}
          style={({ pressed }) => [
            styles.done,
            rightKey.disabled && styles.keyPressed,
            pressed && !rightKey.disabled && styles.keyPressed,
          ]}
        >
          <Text style={styles.doneText}>{rightKey.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export interface NumberFieldProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  allowDecimal?: boolean;
  suffix?: string;
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  allowDecimal,
  suffix,
}: NumberFieldProps) {
  return (
    <View style={{ gap: 8 }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.fieldBox}>
        <Text style={[styles.fieldValue, !value && styles.fieldPlaceholder]}>
          {value || placeholder || "0"}
        </Text>
        {suffix ? <Text style={styles.fieldSuffix}>{suffix}</Text> : null}
      </View>
      <NumberPad
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        allowDecimal={allowDecimal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  key: {
    width: "30%",
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
  },
  keySpecial: { backgroundColor: "transparent" },
  keyPressed: { opacity: 0.55 },
  keyText: { color: colors.text, fontSize: 24, fontWeight: "700" },
  keySpecialText: { color: colors.textMuted, fontSize: 20 },
  done: {
    height: 56,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  doneText: { color: colors.onInverse, fontSize: 17, fontWeight: "700" },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  fieldBox: {
    borderRadius: radius.control,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 60,
    backgroundColor: colors.surfaceAlt,
  },
  fieldValue: { fontSize: 28, fontWeight: "800", color: colors.text },
  fieldPlaceholder: { color: colors.textMuted },
  fieldSuffix: { fontSize: 15, fontWeight: "700", color: colors.textMuted },
});
