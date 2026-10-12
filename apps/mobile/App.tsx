import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaView } from "react-native";
import { AppProvider, useApp } from "./src/state/AppContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ActivateScreen } from "./src/employee/screens/ActivateScreen";
import { OwnerApp } from "./src/owner/OwnerApp";
import { EmployeeApp } from "./src/employee/EmployeeApp";
import { Loading } from "./src/ui/kit";

function Root() {
  const { ready, session } = useApp();
  const [mode, setMode] = useState<"login" | "activate">("login");

  if (!ready) return <Loading label="Starting" />;

  if (!session) {
    return mode === "login" ? (
      <LoginScreen onActivate={() => setMode("activate")} />
    ) : (
      <ActivateScreen onDone={() => setMode("login")} />
    );
  }

  const isOwner = session.staff.role === "OWNER" || session.staff.role === "MANAGER";
  return isOwner ? <OwnerApp /> : <EmployeeApp />;
}

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaView>
  );
}