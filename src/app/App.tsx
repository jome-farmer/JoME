import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "../ui/base.css";
import { DeviceProvider } from "../device/DeviceProvider";
import { TabLayout } from "./TabLayout";
import { HomeScreen } from "../features/home/HomeScreen";
import { ZonesScreen } from "../features/zones/ZonesScreen";
import { AssistantScreen } from "../features/assistant/AssistantScreen";
import { ScheduleScreen } from "../features/schedule/ScheduleScreen";
import { DeviceScreen } from "../features/device/DeviceScreen";

const UiGallery = lazy(() => import("./UiGallery"));

export function App() {
  return (
    <DeviceProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<TabLayout />}>
            <Route index element={<HomeScreen />} />
            <Route path="zones" element={<ZonesScreen />} />
            <Route path="assistant" element={<AssistantScreen />} />
            <Route path="schedule" element={<ScheduleScreen />} />
            <Route path="device" element={<DeviceScreen />} />
          </Route>
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
    </DeviceProvider>
  );
}
