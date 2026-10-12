import { PermissionsAndroid, Platform } from "react-native";

export interface RawSms {
  id: string;
  address: string;
  body: string;
  date: number;
}

/**
 * Reads recent SMS messages using the optional native module
 * react-native-get-sms-android. Returns [] when the module is unavailable
 * (iOS, Expo Go, or permission not granted).
 */
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function readSms(limit = 20): Promise<RawSms[]> {
  if (Platform.OS !== "android") return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SmsAndroid = require("react-native-get-sms-android").default;
    return await new Promise<RawSms[]>((resolve) => {
      const filter = { box: "inbox", maxCount: limit, indexFrom: 0 };
      SmsAndroid.list(
        JSON.stringify(filter),
        () => resolve([]),
        (_count: number, smsList: string) => {
          try {
            const parsed = JSON.parse(smsList) as Array<{
              _id: string;
              address: string;
              body: string;
              date: number;
            }>;
            resolve(
              parsed.map((s) => ({
                id: String(s._id),
                address: s.address,
                body: s.body,
                date: Number(s.date),
              })),
            );
          } catch {
            resolve([]);
          }
        },
      );
    });
  } catch {
    return [];
  }
}

export function isSmsModuleAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("react-native-get-sms-android");
    return true;
  } catch {
    return false;
  }
}
