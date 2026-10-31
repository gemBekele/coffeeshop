import { PermissionsAndroid, Platform } from "react-native";
import { NotificationListener } from "../../modules/notification-listener";

export interface RawSms {
  id: string;
  address: string;
  body: string;
  date: number;
  /** How this message was obtained: device inbox or a captured SMS notification. */
  source: "SMS" | "NOTIFICATION";
}

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  if (NotificationListener.hasSmsPermission()) return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export function hasSmsPermission(): boolean {
  return NotificationListener.hasSmsPermission();
}

export async function readSms(limit = 50): Promise<RawSms[]> {
  if (Platform.OS !== "android") return [];
  const messages = await NotificationListener.readSmsInbox(limit);
  return messages.map((s) => ({
    id: s.id,
    address: s.address,
    body: s.body,
    date: s.date,
    source: "SMS" as const,
  }));
}

export function isSmsModuleAvailable(): boolean {
  return NotificationListener.isAvailable();
}
