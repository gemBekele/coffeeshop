import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";

export const colors = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceAlt: "#F2F2F2",
  text: "#000000",
  textMuted: "#6B6B6B",
  border: "#000000",
  borderSoft: "#DDDDDD",
  onInverse: "#FFFFFF",
};

export const font = {
  title: 30,
  section: 22,
  body: 18,
  small: 14,
};

export function Screen({
  children,
  title,
  onBack,
  right,
  scroll = true,
  footer,
}: {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <View style={styles.screen}>
      {title !== undefined ? (
        <View style={styles.header}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={14} style={styles.backBtn}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerRight}>{right}</View>
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.scrollFill}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

export function Card({
  children,
  style,
  tone = "plain",
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  tone?: "plain" | "invert" | "muted";
}) {
  return (
    <View
      style={[
        styles.card,
        tone === "invert" && styles.cardInvert,
        tone === "muted" && styles.cardMuted,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={styles.sectionTitle}>
      {String(children).toUpperCase()}
    </Text>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Btn({
  label,
  onPress,
  variant = "primary",
  disabled,
  size = "lg",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "ghost";
  disabled?: boolean;
  size?: "lg" | "md" | "sm";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        size === "md" && styles.btnMd,
        size === "sm" && styles.btnSm,
        variant === "outline" && styles.btnOutline,
        variant === "ghost" && styles.btnGhost,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          size === "md" && styles.btnTextMd,
          size === "sm" && styles.btnTextSm,
          variant === "outline" && styles.btnTextOutline,
          variant === "ghost" && styles.btnTextGhost,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Row of equally-weighted big buttons (for yes/no, confirm/cancel). */
export function BtnRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.btnRow}>{children}</View>;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  multiline,
  label,
  autoCapitalize = "none",
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad" | "email-address";
  secureTextEntry?: boolean;
  multiline?: boolean;
  label?: string;
  autoCapitalize?: "none" | "sentences" | "words";
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999999"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

export function Row({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        <View style={styles.row}>{children}</View>
      </Pressable>
    );
  }
  return <View style={styles.row}>{children}</View>;
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

export function Badge({
  label,
  tone = "outline",
}: {
  label: string;
  tone?: "outline" | "invert" | "muted";
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === "invert" && styles.badgeInvert,
        tone === "muted" && styles.badgeMuted,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          tone === "invert" && styles.badgeTextInvert,
          tone === "muted" && styles.badgeTextMuted,
        ]}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <View style={{ padding: 40, alignItems: "center", gap: 12 }}>
      <ActivityIndicator color="#000000" size="large" />
      <Text style={styles.subtitle}>{label}</Text>
    </View>
  );
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <View style={{ padding: 32, alignItems: "center", gap: 16 }}>
      <Text style={styles.subtitle}>{text}</Text>
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export * from "./Dropdown";
export * from "./NumberPad";

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 54,
    paddingBottom: 14,
    paddingHorizontal: 12,
    backgroundColor: "#000000",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  headerRight: { minWidth: 56, alignItems: "flex-end" },
  backBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  backText: { color: "#FFFFFF", fontSize: 34, fontWeight: "700", lineHeight: 36 },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  scrollFill: { flex: 1, padding: 16, gap: 14 },
  footer: { padding: 16, gap: 10, borderTopWidth: 2, borderColor: "#000000", backgroundColor: "#FFFFFF" },
  card: {
    borderWidth: 2,
    borderColor: "#000000",
    padding: 16,
    gap: 10,
    backgroundColor: "#FFFFFF",
  },
  cardInvert: { backgroundColor: "#000000" },
  cardMuted: { backgroundColor: colors.surfaceAlt, borderColor: colors.borderSoft },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: "#000000",
    marginTop: 6,
  },
  title: { fontSize: 30, fontWeight: "900", color: "#000000", letterSpacing: -0.5 },
  subtitle: { fontSize: 17, color: colors.textMuted, lineHeight: 24 },
  btn: {
    backgroundColor: "#000000",
    minHeight: 62,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000000",
  },
  btnMd: { minHeight: 54, paddingVertical: 12 },
  btnSm: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 14 },
  btnOutline: { backgroundColor: "#FFFFFF" },
  btnGhost: { backgroundColor: "#FFFFFF", borderColor: colors.borderSoft },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  btnTextMd: { fontSize: 18 },
  btnTextSm: { fontSize: 16 },
  btnTextOutline: { color: "#000000" },
  btnTextGhost: { color: "#000000" },
  btnRow: { flexDirection: "row", gap: 10 },
  pressed: { opacity: 0.55 },
  fieldLabel: { fontSize: 12, fontWeight: "800", color: "#000000", letterSpacing: 1.2 },
  input: {
    borderWidth: 2,
    borderColor: "#000000",
    backgroundColor: "#FFFFFF",
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
  },
  inputMultiline: { minHeight: 120, textAlignVertical: "top", fontSize: 16, fontWeight: "400" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  kv: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 4 },
  kvLabel: { fontSize: 16, color: colors.textMuted, fontWeight: "600" },
  kvValue: { fontSize: 18, color: "#000000", fontWeight: "800" },
  badge: {
    borderWidth: 2,
    borderColor: "#000000",
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  badgeInvert: { backgroundColor: "#000000" },
  badgeMuted: { borderColor: colors.borderSoft },
  badgeText: { fontSize: 12, fontWeight: "900", color: "#000000", letterSpacing: 0.8 },
  badgeTextInvert: { color: "#FFFFFF" },
  badgeTextMuted: { color: colors.textMuted },
  divider: { height: 2, backgroundColor: "#000000", marginVertical: 4 },
});