import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { AppProvider, useApp } from "./src/state/AppContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RegisterScreen } from "./src/screens/RegisterScreen";
import { ActivateScreen } from "./src/employee/screens/ActivateScreen";
import { OwnerApp } from "./src/owner/OwnerApp";
import { EmployeeApp } from "./src/employee/EmployeeApp";
import { colors } from "./src/ui/kit";

// Keep the branded splash until the saved session is known, so there is no
// white flash or spinner before the app opens.
void SplashScreen.preventAutoHideAsync().catch(() => {});

type Mode = "login" | "activate" | "register";

function Root() {
  const { ready, session } = useApp();
  const [mode, setMode] = useState<Mode>("login");

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  if (!session) {
    if (mode === "activate") return <ActivateScreen onDone={() => setMode("login")} />;
    if (mode === "register") return <RegisterScreen onBack={() => setMode("login")} />;
    return (
      <LoginScreen
        onActivate={() => setMode("activate")}
        onRegister={() => setMode("register")}
      />
    );
  }

  const isOwner =
    session.staff.role === "OWNER" || session.staff.role === "MANAGER";
  return isOwner ? <OwnerApp /> : <EmployeeApp />;
}

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaView>
  );
}
