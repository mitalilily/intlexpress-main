import { Button, Drawer, IconButton } from "@mui/material";
import { CloseRounded, MenuRounded, NorthEastRounded } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import LogoMark from "../brand/LogoMark";
import { navLinks } from "../../data/siteData";
import { getClientAuthUrl } from "../../utils/clientAuth";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const clientAuthUrl = getClientAuthUrl();

  useEffect(() => {
    const updateHeaderState = () => {
      setIsScrolled(window.scrollY > 12);
    };

    updateHeaderState();
    window.addEventListener("scroll", updateHeaderState, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateHeaderState);
    };
  }, []);

  return (
    <>
      <header className={`site-header ${isScrolled ? "site-header--scrolled" : ""}`.trim()}>
        <div className="container-shell site-header__inner">
          <Link className="brand-link" to="/">
            <LogoMark compact />
          </Link>

          <nav aria-label="Primary" className="site-nav">
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) => `site-nav__link ${isActive ? "site-nav__link--active" : ""}`}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="site-header__actions">
            <Button
              className="button-primary"
              component="a"
              endIcon={<NorthEastRounded />}
              href={clientAuthUrl}
              variant="contained"
            >
              Get Started
            </Button>
            <IconButton
              aria-label="Open navigation menu"
              className="site-header__menu"
              color="primary"
              onClick={() => setMobileOpen(true)}
            >
              <MenuRounded />
            </IconButton>
          </div>
        </div>
      </header>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{ className: "mobile-drawer" }}
      >
        <div className="mobile-drawer__header">
          <LogoMark compact />
          <IconButton onClick={() => setMobileOpen(false)}>
            <CloseRounded />
          </IconButton>
        </div>
        <div className="mobile-drawer__content">
          {navLinks.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) =>
                `mobile-drawer__link ${isActive ? "mobile-drawer__link--active" : ""}`
              }
              onClick={() => setMobileOpen(false)}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
          <Button
            className="button-primary mobile-drawer__cta"
            component="a"
            href={clientAuthUrl}
            onClick={() => setMobileOpen(false)}
            variant="contained"
          >
            Get Started
          </Button>
        </div>
      </Drawer>
    </>
  );
}
