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
import { colors, font, radius } from "./theme";
import { NavIcon, type NavIconName } from "./icons";

export { colors, font, radius };

export function Screen({
  children,
  title,
  onBack,
  right,
  scroll = true,
  footer,
  fab,
}: {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
  fab?: React.ReactNode;
}) {
  return (
    <View style={styles.screen}>
      {title !== undefined ? (
        <View style={styles.header}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={14} style={styles.circleBtn}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          ) : (
            <View style={{ width: 44 }} />
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
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.scrollFill}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
      {fab ? (
        <View style={styles.fabWrap} pointerEvents="box-none">
          {fab}
        </View>
      ) : null}
    </View>
  );
}

export function Fab({
  label,
  icon,
  onPress,
  accessibilityLabel,
}: {
  label?: string;
  icon?: React.ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label ?? "Action"}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      {icon ?? <Text style={styles.fabText}>{label}</Text>}
    </Pressable>
  );
}

/** Camera-scan frame: four corner brackets with a line through the middle. */
export function ScanIcon({
  color = colors.onInverse,
  size = 28,
}: {
  color?: string;
  size?: number;
}) {
  const arm = size * 0.34;
  const stroke = Math.max(2, size * 0.09);
  const corner = (
    pos: "tl" | "tr" | "bl" | "br",
  ): ViewStyle => {
    const base: ViewStyle = {
      position: "absolute",
      width: arm,
      height: arm,
      borderColor: color,
    };
    if (pos === "tl") {
      return { ...base, top: 0, left: 0, borderTopWidth: stroke, borderLeftWidth: stroke, borderTopLeftRadius: 4 };
    }
    if (pos === "tr") {
      return { ...base, top: 0, right: 0, borderTopWidth: stroke, borderRightWidth: stroke, borderTopRightRadius: 4 };
    }
    if (pos === "bl") {
      return { ...base, bottom: 0, left: 0, borderBottomWidth: stroke, borderLeftWidth: stroke, borderBottomLeftRadius: 4 };
    }
    return { ...base, bottom: 0, right: 0, borderBottomWidth: stroke, borderRightWidth: stroke, borderBottomRightRadius: 4 };
  };

  return (
    <View style={{ width: size, height: size }}>
      <View style={corner("tl")} />
      <View style={corner("tr")} />
      <View style={corner("bl")} />
      <View style={corner("br")} />
      <View
        style={{
          position: "absolute",
          left: size * 0.16,
          right: size * 0.16,
          top: size / 2 - stroke / 2,
          height: stroke,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
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

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.seeAllPill}>
          <Text style={styles.seeAllText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function QuickActions({
  items,
}: {
  items: Array<{ icon: string; label: string; onPress: () => void; highlight?: boolean }>;
}) {
  return (
    <View style={styles.quickCard}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={item.onPress}
          style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]}
        >
          <View
            style={[
              styles.quickCircle,
              item.highlight && { backgroundColor: colors.brand },
            ]}
          >
            <Text
              style={[
                styles.quickIcon,
                item.highlight && { color: colors.onInverse },
              ]}
            >
              {item.icon}
            </Text>
          </View>
          <Text style={styles.quickLabel} numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ListRowCard({
  icon,
  title,
  subtitle,
  rightTop,
  rightBottom,
  onPress,
  highlight,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  rightTop?: string;
  rightBottom?: string;
  onPress?: () => void;
  highlight?: boolean;
}) {
  const inner = (
    <View style={[styles.listCard, highlight && styles.listCardHighlight]}>
      <View
        style={[
          styles.listIconCircle,
          highlight && { backgroundColor: colors.brand },
        ]}
      >
        <Text
          style={[
            styles.listIconText,
            highlight && { color: colors.onInverse },
          ]}
        >
          {icon}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.listTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.listSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightTop !== undefined || rightBottom !== undefined ? (
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          {rightTop !== undefined ? (
            <Text style={styles.listRightTop}>{rightTop}</Text>
          ) : null}
          {rightBottom !== undefined ? (
            <Text style={styles.listRightBottom}>{rightBottom}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}


export function SettingsGroup({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.settingsGroup}>
      {label ? <Text style={styles.settingsGroupLabel}>{label}</Text> : null}
      <View style={styles.settingsCard}>{children}</View>
    </View>
  );
}

export function SettingsRow({
  title,
  subtitle,
  value,
  onPress,
  last,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        !last && styles.settingsRowDivider,
        pressed && styles.pressed,
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.settingsRowTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.settingsRowSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={styles.settingsRowValue}>{value}</Text> : null}
      {onPress ? <Text style={styles.settingsChevron}>›</Text> : null}
    </Pressable>
  );
}

export function StatPair({
  label,
  value,
  hint,
  strong,
  last,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.statPair, !last && styles.settingsRowDivider]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.statPairLabel}>{label}</Text>
        {hint ? <Text style={styles.statPairHint}>{hint}</Text> : null}
      </View>
      <Text style={[styles.statPairValue, strong && styles.statPairValueStrong]}>
        {value}
      </Text>
    </View>
  );
}

export function PillTabBar<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: Array<{ key: T; label: string; icon: NavIconName }>;
  active: T;
  onSelect: (key: T) => void;
}) {
  return (
    <View style={styles.tabWrap}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onSelect(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              style={({ pressed }) => [
                styles.tabItem,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}
              >
                <NavIcon
                  name={tab.icon}
                  size={22}
                  color={isActive ? colors.brand : colors.textMuted}
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
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
  maxLength,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad" | "email-address";
  secureTextEntry?: boolean;
  multiline?: boolean;
  label?: string;
  autoCapitalize?: "none" | "sentences" | "words";
  maxLength?: number;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        maxLength={maxLength}
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
        {label}
      </Text>
    </View>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <View style={{ padding: 40, alignItems: "center", gap: 12 }}>
      <ActivityIndicator color={colors.brand} size="large" />
      <Text style={styles.subtitle}>{label}</Text>
    </View>
  );
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <View style={{ padding: 32, alignItems: "center", gap: 14 }}>
      <Text style={[styles.subtitle, { textAlign: "center" }]}>{text}</Text>
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
    paddingTop: 52,
    paddingBottom: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.bg,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
  },
  headerRight: { minWidth: 44, alignItems: "flex-end" },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: colors.text, fontSize: 28, fontWeight: "600", lineHeight: 30 },
  scroll: { paddingHorizontal: 20, paddingTop: 12, gap: 16, paddingBottom: 120 },
  scrollFill: { flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: colors.bg,
  },
  card: {
    borderRadius: radius.card,
    padding: 20,
    gap: 12,
    backgroundColor: colors.surface,
  },
  cardInvert: { backgroundColor: colors.brand },
  cardMuted: { backgroundColor: colors.surfaceAlt },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  seeAllPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  quickCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: 18,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  quickItem: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  quickCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  quickIcon: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  listCardHighlight: {
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  listIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  listIconText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  listSub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  listRightTop: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  listRightBottom: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  tabWrap: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
  },
  tabIconWrap: {
    width: 40,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: {
    backgroundColor: colors.brandSoft,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.brand,
    fontWeight: "700",
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
  },
  title: { fontSize: font.title, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  btn: {
    backgroundColor: colors.brand,
    minHeight: 56,
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  btnMd: { minHeight: 48, paddingVertical: 10 },
  btnSm: { minHeight: 40, paddingVertical: 8, paddingHorizontal: 16 },
  btnOutline: { backgroundColor: colors.surfaceAlt },
  btnGhost: { backgroundColor: "transparent" },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: colors.onInverse, fontSize: 16, fontWeight: "700" },
  btnTextMd: { fontSize: 15 },
  btnTextSm: { fontSize: 14 },
  btnTextOutline: { color: colors.text },
  btnTextGhost: { color: colors.textMuted },
  btnRow: { flexDirection: "row", gap: 10 },
  pressed: { opacity: 0.65 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  input: {
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },
  inputMultiline: { minHeight: 100, textAlignVertical: "top", fontSize: 15, fontWeight: "500" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  kv: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 4 },
  kvLabel: { fontSize: 15, color: colors.textMuted, fontWeight: "500" },
  kvValue: { fontSize: 16, color: colors.text, fontWeight: "700" },
  badge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  badgeInvert: { backgroundColor: colors.brand },
  badgeMuted: { backgroundColor: colors.surfaceAlt },
  badgeText: { fontSize: 12, fontWeight: "700", color: colors.text },
  badgeTextInvert: { color: colors.onInverse },
  badgeTextMuted: { color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 4 },
  fabWrap: {
    position: "absolute",
    right: 18,
    // Sits above the bottom bar with a comfortable gap.
    bottom: 96,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: {
    color: colors.onInverse,
    fontSize: 17,
    fontWeight: "800",
  },
  settingsGroup: {
    gap: 8,
  },
  settingsGroupLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
    paddingHorizontal: 6,
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  settingsRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  settingsRowTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  settingsRowSub: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  settingsRowValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textMuted,
  },
  settingsChevron: {
    fontSize: 24,
    color: colors.textMuted,
    marginTop: -2,
  },
  statPair: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  statPairLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  statPairHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statPairValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  statPairValueStrong: {
    fontSize: 22,
    color: colors.brand,
  },

});
