import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createApi, type Api } from "../api/client";
import { sessionStore, deviceStore, type Session } from "../lib/session";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { smsCapture } from "../sms/service";

interface AppContextValue {
  ready: boolean;
  session: Session | null;
  deviceKey: string | null;
  api: Api;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  setDeviceKey: (key: string | null) => Promise<void>;
  refreshDeviceKey: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [deviceKey, setDeviceKeyState] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const deviceRef = useRef<string | null>(null);

  const api = useMemo(
    () => createApi(() => tokenRef.current, () => deviceRef.current),
    [],
  );

  useEffect(() => {
    (async () => {
      const [s, d] = await Promise.all([sessionStore.get(), deviceStore.get()]);
      if (s) {
        tokenRef.current = s.accessToken;
        setSession(s);
        connectSocket(s.accessToken);
      }
      if (d) {
        deviceRef.current = d;
        setDeviceKeyState(d);
      }
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (next: Session) => {
    tokenRef.current = next.accessToken;
    await sessionStore.set(next);
    setSession(next);
    connectSocket(next.accessToken);
  }, []);

  const signOut = useCallback(async () => {
    smsCapture.stop();
    disconnectSocket();
    tokenRef.current = null;
    await sessionStore.clear();
    setSession(null);
  }, []);

  const setDeviceKey = useCallback(async (key: string | null) => {
    deviceRef.current = key;
    setDeviceKeyState(key);
    if (key) await deviceStore.set(key);
    else await deviceStore.clear();
  }, []);

  const refreshDeviceKey = useCallback(async () => {
    const d = await deviceStore.get();
    deviceRef.current = d;
    setDeviceKeyState(d);
  }, []);

  const value: AppContextValue = {
    ready,
    session,
    deviceKey,
    api,
    signIn,
    signOut,
    setDeviceKey,
    refreshDeviceKey,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
