import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius } from "./theme";

export interface Option<T = string> {
  label: string;
  value: T;
  hint?: string;
}

export interface DropdownProps<T = string> {
  label?: string;
  options: Array<Option<T>>;
  value: T | null | undefined;
  onChange: (value: T) => void;
  placeholder?: string;
  title?: string;
}

export function Dropdown<T = string>({
  label,
  options,
  value,
  onChange,
  placeholder = "Select…",
  title,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={styles.triggerRow}>
          <Text style={selected ? styles.value : styles.placeholder}>
            {selected?.label ?? placeholder}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </View>
        {selected?.hint ? (
          <Text style={styles.hint}>{selected.hint}</Text>
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title ?? label ?? placeholder}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Text style={styles.close}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item, index) => `${String(item.value)}-${index}`}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    active && styles.optionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.optionLabel, active && styles.optionLabelActive]}
                    >
                      {item.label}
                    </Text>
                    {item.hint ? <Text style={styles.optionHint}>{item.hint}</Text> : null}
                  </View>
                  {active ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderRadius: radius.control,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 58,
    justifyContent: "center",
    backgroundColor: colors.surface,
    gap: 2,
  },
  triggerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  value: { fontSize: 17, fontWeight: "700", color: colors.text },
  placeholder: { fontSize: 17, fontWeight: "600", color: colors.textMuted },
  chevron: { fontSize: 18, fontWeight: "700", color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted },
  pressed: { opacity: 0.65 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "78%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingBottom: 20,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800", flex: 1 },
  close: { color: colors.text, fontSize: 15, fontWeight: "700" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  optionActive: { backgroundColor: colors.surfaceAlt },
  optionLabel: { fontSize: 17, fontWeight: "600", color: colors.text },
  optionLabelActive: { fontWeight: "800", color: colors.text },
  optionHint: { fontSize: 13, color: colors.textMuted },
  check: { fontSize: 18, fontWeight: "900", color: colors.text, paddingLeft: 12 },
});
