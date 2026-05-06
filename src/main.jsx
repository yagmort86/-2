import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

const AdminApp = lazy(() => import("./admin/AdminApp.jsx"));
const LandingApp = lazy(() => import("./App.jsx"));
const ClientModelApp = lazy(() => import("./ClientModelApp.jsx"));

function RootApp() {
  const path = window.location.pathname;
  let App = LandingApp;

  if (path.startsWith("/admin")) {
    App = AdminApp;
  } else if (path.startsWith("/client/") || path.startsWith("/viewer/") || path.startsWith("/tg") || path.startsWith("/telegram")) {
    App = ClientModelApp;
  }

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
