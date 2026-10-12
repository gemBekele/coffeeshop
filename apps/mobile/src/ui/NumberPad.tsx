import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export interface NumberPadProps {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  /** Optional custom key rendered bottom-left (e.g. "00", "+", "."). */
  leftKey?: { label: string; onPress: () => void };
  /** Hide the leading-zero logic (use raw string). */
  allowDecimal?: boolean;
  /** Right accent key, usually "Done" / "Next". */
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
  /** Renders the value big; tap opens nothing (pad is inline). */
  suffix?: string;
}

/**
 * A field that is always edited with the custom NumberPad below it.
 */
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
    <View style={{ gap: 6 }}>
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
  grid: { flexDirection: "row", flexWrap: "wrap" },
  key: {
    width: "33.333%",
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    borderWidth: 2,
    borderColor: "#000000",
    margin: -1,
  },
  keySpecial: { backgroundColor: "#FFFFFF" },
  keyPressed: { opacity: 0.55 },
  keyText: { color: "#FFFFFF", fontSize: 26, fontWeight: "700" },
  keySpecialText: { color: "#000000" },
  done: {
    height: 60,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000000",
  },
  doneText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#000000", letterSpacing: 1 },
  fieldBox: {
    borderWidth: 2,
    borderColor: "#000000",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 62,
  },
  fieldValue: { fontSize: 30, fontWeight: "800", color: "#000000" },
  fieldPlaceholder: { color: "#AAAAAA" },
  fieldSuffix: { fontSize: 16, fontWeight: "700", color: "#000000" },
});