import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "../ui/base.css";
import { DeviceProvider } from "../device/DeviceProvider";
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

const UiGallery = lazy(() => import("./UiGallery"));

export function App() {
  return (
    <DeviceProvider>
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
          <Route path="connect" element={<ConnectScreen />} />
          <Route path="setup/wifi" element={<WifiScreen />} />
          <Route path="setup/name" element={<NameScreen />} />
          <Route path="device/terminal" element={<TerminalScreen />} />
          <Route path="schedule/:id" element={<ProgramEditor />} />
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
    </DeviceProvider>
  );
}
