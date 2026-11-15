import React from "react";
import { Btn, Screen, SettingsGroup, SettingsRow } from "../../ui/kit";
import type { PermissionState } from "../../notifications/local";

/**
 * Settings: calm, scannable sections. No icons — title, plain description,
 * and a chevron only where there is something behind it.
 */
export function SettingsHomeScreen({
  onDayClose,
  onTemplates,
  onPaymentLimit,
  onInbox,
  onStaff,
  onStock,
  onReports,
  onSignOut,
  alerts,
  onEnableAlerts,
}: {
  onDayClose: () => void;
  onTemplates: () => void;
  onPaymentLimit: () => void;
  onInbox: () => void;
  onStaff: () => void;
  onStock: () => void;
  onReports: () => void;
  onSignOut: () => void;
  alerts: PermissionState;
  onEnableAlerts: () => void;
}) {
  return (
    <Screen
      title="Settings"
      footer={<Btn label="Sign out" variant="outline" onPress={onSignOut} />}
    >
      <SettingsGroup label="Today">
        <SettingsRow
          title="Day close"
          subtitle="Cash sales and bank transfers, consolidated"
          onPress={onDayClose}
          last
        />
      </SettingsGroup>

      <SettingsGroup label="Money">
        <SettingsRow
          title="Payment rules"
          subtitle="The SMS formats that create a payment"
          onPress={onTemplates}
        />
        <SettingsRow
          title="Auto-accept limit"
          subtitle="Ignore transfers larger than this"
          onPress={onPaymentLimit}
        />
        <SettingsRow
          title="Unmatched messages"
          subtitle="Bank SMS that could not be matched"
          onPress={onInbox}
          last
        />
      </SettingsGroup>

      <SettingsGroup label="App">
        <SettingsRow
          title="Payment alerts"
          subtitle={
            alerts === "granted"
              ? "Notifications are on for this phone"
              : alerts === "denied"
                ? "Blocked — allow notifications in system settings"
                : "Get an alert for every incoming transfer"
          }
          value={
            alerts === "granted" ? "On" : alerts === "denied" ? "Blocked" : "Enable"
          }
          onPress={alerts === "granted" ? undefined : onEnableAlerts}
          last
        />
      </SettingsGroup>

      <SettingsGroup label="Shop">
        <SettingsRow
          title="Stock"
          subtitle="Ingredients and quantities"
          onPress={onStock}
        />
        <SettingsRow
          title="Staff"
          subtitle="Add an employee with a QR code"
          onPress={onStaff}
        />
        <SettingsRow
          title="Reports"
          subtitle="Revenue, top drinks, stock value"
          onPress={onReports}
          last
        />
      </SettingsGroup>
    </Screen>
  );
}
