import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
  /** Renders a compact value; default shows label or placeholder. */
  title?: string;
}

/**
 * Big, thumb-friendly dropdown. Tapping opens a full-screen black sheet with
 * large options. Prefer this over free-text forms wherever the value set is
 * known.
 */
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
              <Text style={styles.close}>Close</Text>
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
    borderWidth: 2,
    borderColor: "#000000",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 60,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    gap: 2,
  },
  triggerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 12, fontWeight: "800", color: "#000000", letterSpacing: 1.2 },
  value: { fontSize: 20, fontWeight: "800", color: "#000000" },
  placeholder: { fontSize: 20, fontWeight: "700", color: "#999999" },
  chevron: { fontSize: 20, fontWeight: "800", color: "#000000" },
  hint: { fontSize: 12, color: "#666666" },
  pressed: { opacity: 0.6 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "82%",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 3,
    borderColor: "#000000",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 2,
    borderColor: "#000000",
    backgroundColor: "#000000",
  },
  sheetTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", flex: 1 },
  close: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderColor: "#E5E5E5",
  },
  optionActive: { backgroundColor: "#000000" },
  optionLabel: { fontSize: 20, fontWeight: "700", color: "#000000" },
  optionLabelActive: { color: "#FFFFFF" },
  optionHint: { fontSize: 13, color: "#666666" },
  check: { fontSize: 22, fontWeight: "900", color: "#000000", paddingLeft: 12 },
});