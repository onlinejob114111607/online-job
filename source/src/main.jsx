import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import "./styles.css";

// لوحة التحكم بتتحمّل لحالها، فزوار صفحة التسجيل ما بينزلوا كودها
const AdminApp = lazy(() => import("./admin/AdminApp"));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="center-screen"><div className="loader" /></div>}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route path="*" element={<Landing />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
