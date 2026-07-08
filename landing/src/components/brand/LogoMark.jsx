import { brand } from "../../data/siteData";

export default function LogoMark({ className = "", compact = false }) {
  return (
    <div className={`logo-lockup ${compact ? "logo-lockup--compact" : ""} ${className}`.trim()}>
      <img alt={brand.logoAlt} className="logo-lockup__image" decoding="async" src={brand.logoSrc} />
    </div>
  );
}
