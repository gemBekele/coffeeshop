import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { ApiError, apiRequest, createApi, type Api } from "../api/client";
import { sessionStore, deviceStore, type Session } from "../lib/session";
import { connectSocket, disconnectSocket, setSocketTokenGetter } from "../lib/socket";
import { smsCapture } from "../sms/service";
import { notificationCapture } from "../notifications/service";

interface AppContextValue {
  ready: boolean;
  session: Session | null;
  deviceKey: string | null;
  captureActive: boolean;
  api: Api;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  setDeviceKey: (key: string | null) => Promise<void>;
  refreshDeviceKey: () => Promise<void>;
  syncCapture: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Expiry (ms) of a JWT, or null when it cannot be read. */
function tokenExpiry(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(
      decodeURIComponent(
        atob(part.replace(/-/g, "+").replace(/_/g, "/"))
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      ),
    ) as { exp?: number };
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Refresh a little before expiry so requests rarely see a 401. */
const REFRESH_AHEAD_MS = 3 * 60 * 1000;
const REFRESH_CHECK_MS = 60 * 1000;
/** Let the first frame paint before heavy background bootstrapping. */
const CAPTURE_BOOT_DELAY_MS = 600;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [deviceKey, setDeviceKeyState] = useState<string | null>(null);
  const [captureActive, setCaptureActive] = useState(false);

  const tokenRef = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const deviceRef = useRef<string | null>(null);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    // Dedupe concurrent refreshes: only one rotation may run at a time.
    if (refreshInFlight.current) return refreshInFlight.current;
    const run = async (): Promise<string | null> => {
      const current = sessionRef.current ?? (await sessionStore.get());
      if (!current?.refreshToken) return null;
      try {
        const rotated = await apiRequest<{
          accessToken: string;
          refreshToken: string;
        }>("/api/auth/refresh", {
          method: "POST",
          body: { refreshToken: current.refreshToken },
        });
        const updated: Session = {
          ...current,
          accessToken: rotated.accessToken,
          refreshToken: rotated.refreshToken,
        };
        tokenRef.current = updated.accessToken;
        sessionRef.current = updated;
        await sessionStore.set(updated);
        setSession(updated);
        return updated.accessToken;
      } catch (err) {
        // Only a real rejection (401) signs the user out. Network hiccups,
        // rate limits (429) and 5xx must never destroy a valid session.
        if (err instanceof ApiError && err.status === 401) {
          tokenRef.current = null;
          sessionRef.current = null;
          await sessionStore.clear();
          setSession(null);
        }
        return null;
      }
    };
    const promise = run().finally(() => {
      refreshInFlight.current = null;
    });
    refreshInFlight.current = promise;
    return promise;
  }, []);

  const api = useMemo(
    () => createApi(() => tokenRef.current, () => deviceRef.current, refreshSession),
    [refreshSession],
  );

  // The socket must always reconnect with the newest access token.
  useEffect(() => {
    setSocketTokenGetter(() => tokenRef.current);
  }, []);

  const setDeviceKey = useCallback(async (key: string | null) => {
    deviceRef.current = key;
    setDeviceKeyState(key);
    if (key) await deviceStore.set(key);
    else await deviceStore.clear();
  }, []);

  const ensureCapture = useCallback(
    async (currentSession: Session | null) => {
      if (!currentSession) return;

      // Every signed-in phone listens: whichever phone receives the SMS posts
      // it, and the server de-duplicates by transaction id. This removes the
      // "shows on one phone but not the other" gaps.
      notificationCapture.watch();

      let key = deviceRef.current;
      if (key) {
        try {
          await api.deviceConfig(key);
        } catch {
          key = null;
        }
      }
      if (!key) {
        try {
          const res = await api.registerDevice({
            label: `${Platform.OS} ${currentSession.staff.role.toLowerCase()} phone`,
            role: currentSession.staff.role,
            platform: Platform.OS === "ios" ? "ios" : "android",
          });
          key = res.apiKey;
          await setDeviceKey(key);
        } catch {
          return;
        }
      }

      try {
        const list = await api.templates();
        const activeCount = list.filter((t) => t.status === "ACTIVE").length;
        if (activeCount === 0) {
          const drafts = list.filter((t) => t.status === "DRAFT");
          await Promise.all(
            drafts.map((t) => api.activateTemplate(t.id).catch(() => {})),
          );
        }
      } catch {}

      try {
        if (notificationCapture.isPermissionGranted()) {
          if (notificationCapture.isRunning()) {
            await notificationCapture.loadTemplates(key, api);
          } else {
            await notificationCapture.start(key, api);
          }
        }
      } catch {}

      try {
        if (smsCapture.isRunning()) {
          await smsCapture.loadTemplates(key, api);
        } else {
          await smsCapture.start(key, api);
        }
      } catch {}

      setCaptureActive(
        notificationCapture.isRunning() || smsCapture.isRunning(),
      );
    },
    [api, setDeviceKey],
  );

  /** Bootstrap capture after the UI is interactive, never blocking it. */
  const bootCaptureLater = useCallback(
    (currentSession: Session | null) => {
      setTimeout(() => {
        void ensureCapture(currentSession);
      }, CAPTURE_BOOT_DELAY_MS);
    },
    [ensureCapture],
  );

  useEffect(() => {
    (async () => {
      const [s, d] = await Promise.all([sessionStore.get(), deviceStore.get()]);
      if (d) {
        deviceRef.current = d;
        setDeviceKeyState(d);
      }
      if (s) {
        tokenRef.current = s.accessToken;
        sessionRef.current = s;
        setSession(s);
        setReady(true);
        // Network work starts after the first paint.
        setTimeout(() => {
          connectSocket();
          bootCaptureLater(s);
        }, CAPTURE_BOOT_DELAY_MS);
      } else {
        setReady(true);
      }
    })();
  }, [bootCaptureLater]);

  // Keep the access token fresh in the background (no 401 round-trips).
  useEffect(() => {
    if (!session) return;
    let stopped = false;
    const check = () => {
      if (stopped) return;
      const token = tokenRef.current;
      if (!token) return;
      const exp = tokenExpiry(token);
      if (exp !== null && exp - Date.now() < REFRESH_AHEAD_MS) {
        void refreshSession();
      }
    };
    check();
    const timer = setInterval(check, REFRESH_CHECK_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [session, refreshSession]);

  const signIn = useCallback(
    async (next: Session) => {
      tokenRef.current = next.accessToken;
      sessionRef.current = next;
      await sessionStore.set(next);
      setSession(next);
      connectSocket();
      bootCaptureLater(next);
    },
    [bootCaptureLater],
  );

  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    smsCapture.stop();
    notificationCapture.stop();
    setCaptureActive(false);
    disconnectSocket();
    tokenRef.current = null;
    sessionRef.current = null;
    setSession(null);
    await sessionStore.clear();
    if (current?.refreshToken) {
      // Best effort revocation; local logout happens regardless.
      void apiRequest("/api/auth/logout", {
        method: "POST",
        body: { refreshToken: current.refreshToken },
      }).catch(() => {});
    }
  }, []);

  const refreshDeviceKey = useCallback(async () => {
    const d = await deviceStore.get();
    deviceRef.current = d;
    setDeviceKeyState(d);
  }, []);

  const syncCapture = useCallback(async () => {
    await ensureCapture(session);
  }, [ensureCapture, session]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      session,
      deviceKey,
      captureActive,
      api,
      signIn,
      signOut,
      setDeviceKey,
      refreshDeviceKey,
      syncCapture,
    }),
    [
      ready,
      session,
      deviceKey,
      captureActive,
      api,
      signIn,
      signOut,
      setDeviceKey,
      refreshDeviceKey,
      syncCapture,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
