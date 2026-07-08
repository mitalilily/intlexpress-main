import {
  CalculateRounded,
  CurrencyRupeeRounded,
  HeadsetMicRounded,
  Inventory2Rounded,
  LocalShippingRounded,
  LocationOnRounded,
  RouteRounded,
  ScaleRounded,
} from "@mui/icons-material";

const visualConfig = {
  tracking: {
    Icon: RouteRounded,
    title: "Live Tracking",
    primary: "IXP78254019",
    secondary: "In transit",
    metric: "2-3 Days",
    footer: "Noida to Bengaluru",
  },
  rates: {
    Icon: CurrencyRupeeRounded,
    title: "Best Rate Found",
    primary: "Rs24.65",
    secondary: "via Blue Dart",
    metric: "Save Rs12.40",
    footer: "25+ courier partners",
  },
  weight: {
    Icon: ScaleRounded,
    title: "Billable Weight",
    primary: "2.80 kg",
    secondary: "Volumetric checked",
    metric: "5000 divisor",
    footer: "Length x breadth x height",
  },
  support: {
    Icon: HeadsetMicRounded,
    title: "Shipping Desk",
    primary: "24x7",
    secondary: "Courier support",
    metric: "India lanes",
    footer: "Connect. Compare. Deliver.",
  },
};

export default function LogisticsMapVisual({ variant = "support", compact = false }) {
  const config = visualConfig[variant] ?? visualConfig.support;
  const { Icon } = config;

  return (
    <div className={`logistics-visual logistics-visual--${variant} ${compact ? "logistics-visual--compact" : ""}`.trim()}>
      <div className="logistics-visual__map" aria-hidden="true" />
      <span className="logistics-visual__route logistics-visual__route--one" aria-hidden="true" />
      <span className="logistics-visual__route logistics-visual__route--two" aria-hidden="true" />
      <span className="logistics-visual__pin logistics-visual__pin--one" aria-hidden="true">
        <LocationOnRounded />
      </span>
      <span className="logistics-visual__pin logistics-visual__pin--two" aria-hidden="true">
        <LocationOnRounded />
      </span>
      <span className="logistics-visual__pin logistics-visual__pin--three" aria-hidden="true">
        <LocationOnRounded />
      </span>

      <div className="logistics-visual__vehicle" aria-hidden="true">
        <LocalShippingRounded />
      </div>

      <div className="logistics-visual__card logistics-visual__card--primary">
        <span className="logistics-visual__icon">
          <Icon />
        </span>
        <span className="logistics-visual__label">{config.title}</span>
        <strong>{config.primary}</strong>
        <small>{config.secondary}</small>
      </div>

      <div className="logistics-visual__card logistics-visual__card--metric">
        <span className="logistics-visual__icon logistics-visual__icon--soft">
          {variant === "rates" ? <CalculateRounded /> : <Inventory2Rounded />}
        </span>
        <span className="logistics-visual__label">{config.metric}</span>
        <small>{config.footer}</small>
      </div>
    </div>
  );
}
