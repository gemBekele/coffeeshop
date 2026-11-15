import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CHANNEL_ID = "payments";

export type PermissionState = "granted" | "denied" | "unknown";

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Payments",
    description: "Incoming bank transfers",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 250, 180, 250],
    lightColor: "#1B4332",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function getPermissionState(): Promise<PermissionState> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return "granted";
    return current.canAskAgain ? "unknown" : "denied";
  } catch {
    return "unknown";
  }
}

export async function enableNotifications(): Promise<PermissionState> {
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (granted) await ensureChannel();
    return granted ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

/** Immediate local notification for a newly received transfer. */
export async function notifyPayment(input: {
  amount: number;
  sender?: string | null;
  txnId?: string | null;
}): Promise<void> {
  try {
    await ensureChannel();
    const who = input.sender ? ` from ${input.sender}` : "";
    const ref = input.txnId ? ` · Ref ${input.txnId}` : "";
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Payment received",
        body: `ETB ${input.amount.toFixed(2)}${who}${ref}`,
        sound: "default",
        data: { type: "payment" },
      },
      trigger: null,
    });
  } catch {
    // Never let a notification failure affect capture.
  }
}

/** Fires when the user taps a notification. Returns an unsubscribe. */
export function onNotificationTap(listener: () => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(() => {
    listener();
  });
  return () => sub.remove();
}

/** True when the app was launched by tapping a notification. */
export async function consumedLaunchNotification(): Promise<boolean> {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return !!response;
  } catch {
    return false;
  }
}
