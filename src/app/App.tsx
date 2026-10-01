import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "../ui/base.css";
import { Provider } from "react-redux";
import { DeviceLifecycle } from "../device/DeviceLifecycle";
import { store } from "../store";
import { applyTheme, loadTheme } from "../lib/theme";
import { FirstRunRedirect } from "./FirstRunRedirect";
import { Splash } from "./Splash";
import { TabLayout } from "./TabLayout";
import { HomeScreen } from "../features/home/HomeScreen";
import { ZonesScreen } from "../features/zones/ZonesScreen";
import { AssistantScreen } from "../features/assistant/AssistantScreen";
import { ScheduleScreen } from "../features/schedule/ScheduleScreen";
import { DeviceScreen } from "../features/device/DeviceScreen";
import { TerminalScreen } from "../features/terminal/TerminalScreen";
import { ProgramEditor } from "../features/schedule/ProgramEditor";
import { WelcomeScreen } from "../features/onboarding/WelcomeScreen";
import { ConnectScreen } from "../features/onboarding/ConnectScreen";
import { WifiScreen } from "../features/onboarding/WifiScreen";
import { NameScreen } from "../features/onboarding/NameScreen";
import { ClaimScreen } from "../features/onboarding/ClaimScreen";
import { UsageScreen } from "../features/usage/UsageScreen";
import { SignInScreen } from "../features/signin/SignInScreen";
import { CodeScreen } from "../features/signin/CodeScreen";

const UiGallery = lazy(() => import("./UiGallery"));

export function App() {
  // The Appearance choice from the Device tab; "system" until one is saved.
  useEffect(() => {
    void loadTheme().then(applyTheme);
  }, []);

  return (
    <Provider store={store}>
      <DeviceLifecycle />
      <BrowserRouter>
        <FirstRunRedirect />
        <Routes>
          <Route element={<TabLayout />}>
            <Route index element={<HomeScreen />} />
            <Route path="zones" element={<ZonesScreen />} />
            <Route path="assistant" element={<AssistantScreen />} />
            <Route path="schedule" element={<ScheduleScreen />} />
            <Route path="device" element={<DeviceScreen />} />
          </Route>
          <Route path="welcome" element={<WelcomeScreen />} />
          <Route path="signin" element={<SignInScreen />} />
          <Route path="signin/code" element={<CodeScreen />} />
          <Route path="connect" element={<ConnectScreen />} />
          <Route path="setup/wifi" element={<WifiScreen />} />
          <Route path="setup/claim" element={<ClaimScreen />} />
          <Route path="setup/name" element={<NameScreen />} />
          <Route path="device/terminal" element={<TerminalScreen />} />
          <Route path="device/wifi" element={<WifiScreen mode="settings" />} />
          <Route path="schedule/:id" element={<ProgramEditor />} />
          <Route path="usage" element={<UsageScreen />} />
          <Route
            path="ui"
            element={
              <Suspense>
                <UiGallery />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Splash />
    </Provider>
  );
}
