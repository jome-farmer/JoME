import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SetUpPage from "./pages/setup";
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import './styles/theme.css';

import DashboardPage from "./pages/dashboard";

// Lazy, so the new design system CSS only loads on /ui and doesn't restyle the legacy prototype.
const UiGallery = lazy(() => import("./app/UiGallery"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<SetUpPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/ui" element={<Suspense><UiGallery /></Suspense>} />
        <Route path="/" element={<Navigate to="/setup" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
