import * as SecureStore from "expo-secure-store";
import type { StaffRole } from "../api/client";

const KEY_SESSION = "coffeeshop.session";
const KEY_DEVICE = "coffeeshop.deviceKey";

export interface Session {
  accessToken: string;
  refreshToken: string;
  staff: { id: string; fullName: string; role: StaffRole; shopId: string };
}

export const sessionStore = {
  async get(): Promise<Session | null> {
    const raw = await SecureStore.getItemAsync(KEY_SESSION);
    return raw ? (JSON.parse(raw) as Session) : null;
  },
  async set(session: Session): Promise<void> {
    await SecureStore.setItemAsync(KEY_SESSION, JSON.stringify(session));
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY_SESSION);
  },
};

export const deviceStore = {
  async get(): Promise<string | null> {
    return SecureStore.getItemAsync(KEY_DEVICE);
  },
  async set(key: string): Promise<void> {
    await SecureStore.setItemAsync(KEY_DEVICE, key);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY_DEVICE);
  },
};
