import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

const AdminApp = lazy(() => import("./admin/AdminApp.jsx"));
const LandingApp = lazy(() => import("./App.jsx"));

function RootApp() {
  const App = window.location.pathname.startsWith("/admin") ? AdminApp : LandingApp;

  return (
    <Suspense fallback={<div />}>
      <App />
    </Suspense>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
