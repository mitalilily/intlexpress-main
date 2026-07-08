import { Outlet, useLocation } from "react-router-dom";
import Footer from "./Footer";
import Navbar from "./Navbar";

export default function AppShell() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  return (
    <div className={`app-shell ${isHome ? "app-shell--home" : ""}`.trim()}>
      <div className="app-background">
        <span className="app-background__orb app-background__orb--one" />
        <span className="app-background__orb app-background__orb--two" />
        <span className="app-background__orb app-background__orb--three" />
      </div>
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
