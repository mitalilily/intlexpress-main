import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import PageLoader from "./components/common/PageLoader";

const ClientAuthRedirectPage = lazy(() => import("./pages/ClientAuthRedirectPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const RateCalculatorPage = lazy(() => import("./pages/RateCalculatorPage"));
const TrackingPage = lazy(() => import("./pages/TrackingPage"));
const WeightCalculatorPage = lazy(() => import("./pages/WeightCalculatorPage"));

function ScrollRestoration() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");

      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

  return null;
}

function App() {
  return (
    <>
      <ScrollRestoration />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<AppShell />} path="/">
            <Route element={<HomePage />} index />
            <Route element={<TrackingPage />} path="tracking" />
            <Route element={<RateCalculatorPage />} path="rate-calculator" />
            <Route element={<WeightCalculatorPage />} path="weight-calculator" />
            <Route element={<ClientAuthRedirectPage />} path="login" />
            <Route element={<ContactPage />} path="contact" />
          </Route>
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
