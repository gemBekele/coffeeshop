import Constants from "expo-constants";

const configured =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "http://localhost:4000";

// Android resolves "localhost" to IPv6 ::1 first, but `adb reverse` only binds
// IPv4 127.0.0.1. Use the literal IPv4 loopback so dev requests reach the host.
export const API_URL: string = configured.replace("//localhost", "//127.0.0.1");

