import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import {
  Badge,
  Card,
  Empty,
  Loading,
  Screen,
  SectionTitle,
  Subtitle,
} from "../../ui/kit";
import { useApp } from "../../state/AppContext";
import type { Staff } from "../../api/client";

export function StaffScreen({ onBack }: { onBack: () => void }) {
  const { api } = useApp();
  const [staff, setStaff] = useState<Staff[] | null>(null);

  useEffect(() => {
    api.staff().then(setStaff).catch(() => setStaff([]));
  }, [api]);

  return (
    <Screen title="Staff" onBack={onBack}>
      <Subtitle>
        Employees get activated by scanning their QR code from your phone.
      </Subtitle>

      {staff === null ? (
        <Loading />
      ) : staff.length === 0 ? (
        <Empty text="No staff yet." />
      ) : (
        staff.map((s) => (
          <Card key={s.id}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#000000", flex: 1 }}>
                {s.fullName}
              </Text>
              <Badge
                label={s.role}
                tone={s.role === "OWNER" ? "invert" : "outline"}
              />
            </View>
            <SectionTitle>Activation</SectionTitle>
            <Text style={{ fontSize: 15, color: "#6B6B6B" }}>
              {s.phone ?? s.employeeCode ?? "—"}
              {"  ·  "}
              {s.isActive ? "enabled" : "disabled"}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}