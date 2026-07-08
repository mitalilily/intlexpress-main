import {
  CallRounded,
  EmailRounded,
  FacebookRounded,
  Instagram,
  LinkedIn,
  LocationOnRounded,
} from "@mui/icons-material";
import { IconButton, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import LogoMark from "../brand/LogoMark";
import { brand, footerGroups, socialLinks } from "../../data/siteData";
import { getClientAuthUrl } from "../../utils/clientAuth";

const socialIconMap = {
  LinkedIn: <LinkedIn fontSize="small" />,
  Instagram: <Instagram fontSize="small" />,
  Facebook: <FacebookRounded fontSize="small" />,
};

export default function Footer() {
  const clientAuthUrl = getClientAuthUrl();

  return (
    <footer className="site-footer">
      <div className="container-shell site-footer__grid">
        <div className="site-footer__brand">
          <LogoMark />
          <Typography className="site-footer__copy" variant="body2">
            {brand.subheadline}
          </Typography>
          {brand.gstin || brand.founder ? (
            <div className="site-footer__meta">
              {brand.gstin ? <span>GSTIN: {brand.gstin}</span> : null}
              {brand.founder ? <span>Founder: {brand.founder}</span> : null}
            </div>
          ) : null}
          <div className="site-footer__socials">
            {socialLinks.map((item) => (
              <IconButton
                key={item.label}
                className="site-footer__social"
                component="a"
                href={item.href}
                rel="noreferrer"
                target="_blank"
              >
                {socialIconMap[item.label]}
              </IconButton>
            ))}
          </div>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title} className="site-footer__column">
            <Typography className="site-footer__title" variant="subtitle1">
              {group.title}
            </Typography>
              <div className="site-footer__links">
                {group.links.map((linkItem) => (
                  linkItem.external ? (
                    <a
                      key={linkItem.label}
                      className="site-footer__link"
                      href={linkItem.to === "/login" ? clientAuthUrl : linkItem.to}
                    >
                      {linkItem.label}
                    </a>
                  ) : (
                    <Link key={linkItem.label} className="site-footer__link" to={linkItem.to}>
                      {linkItem.label}
                    </Link>
                  )
                ))}
              </div>
            </div>
        ))}

        <div className="site-footer__column">
          <Typography className="site-footer__title" variant="subtitle1">
            Contact
          </Typography>
          <div className="site-footer__contact-grid">
            <a className="site-footer__info" href={`tel:${brand.phone}`}>
              <CallRounded fontSize="small" />
              <span>{brand.phone}</span>
            </a>
            <a className="site-footer__info" href={`mailto:${brand.email}`}>
              <EmailRounded fontSize="small" />
              <span>{brand.email}</span>
            </a>
            <a className="site-footer__info" href={`tel:${brand.supportPhone}`}>
              <CallRounded fontSize="small" />
              <span>{brand.supportPhone}</span>
            </a>
            <a className="site-footer__info" href={`mailto:${brand.bookingEmail}`}>
              <EmailRounded fontSize="small" />
              <span>{brand.bookingEmail}</span>
            </a>
            <div className="site-footer__info site-footer__info--address">
              <LocationOnRounded fontSize="small" />
              <span>{brand.address}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container-shell site-footer__bottom">
        <Typography variant="body2">
          &copy; {new Date().getFullYear()} {brand.name}. Premium logistics software for smarter shipping across India.
        </Typography>
      </div>
    </footer>
  );
}
