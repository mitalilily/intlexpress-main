import {
  Inventory2Rounded,
  LocalShippingRounded,
  LocationOnRounded,
  RouteRounded,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import LogoMark from "../brand/LogoMark";

const floatingTransition = {
  duration: 4.5,
  ease: "easeInOut",
  repeat: Infinity,
  repeatType: "mirror",
};

export default function HeroScene() {
  return (
    <div className="hero-scene">
      <motion.div
        animate={{ y: [-8, 8, -8] }}
        className="hero-scene__store"
        transition={floatingTransition}
      >
        <div className="hero-scene__store-top">
          <LogoMark className="hero-scene__brandmark" compact />
        </div>
        <div className="hero-scene__store-body">
          <div className="hero-scene__door" />
          <div className="hero-scene__window" />
          <div className="hero-scene__window" />
        </div>
      </motion.div>

      <motion.div
        animate={{ x: [-150, 120], opacity: [0, 1, 1, 0] }}
        className="hero-scene__truck"
        transition={{ duration: 6, ease: "linear", repeat: Infinity }}
      >
        <LocalShippingRounded />
      </motion.div>

      <motion.div
        animate={{ x: [-150, 110], opacity: [0, 1, 1, 0], scale: [0.95, 1, 1, 0.95] }}
        className="hero-scene__truck hero-scene__truck--secondary"
        transition={{ delay: 2.1, duration: 6, ease: "linear", repeat: Infinity }}
      >
        <LocalShippingRounded />
      </motion.div>

      {[0, 1, 2].map((index) => (
        <motion.div
          key={`parcel-${index}`}
          animate={{ y: [-10, 10, -10], rotate: [-3, 2, -3] }}
          className={`hero-scene__parcel hero-scene__parcel--${index + 1}`}
          transition={{ ...floatingTransition, delay: index * 0.35 }}
        >
          <Inventory2Rounded />
        </motion.div>
      ))}

      <div className="hero-scene__map">
        <div className="hero-scene__map-header">
          <RouteRounded />
          <span>Dynamic route intelligence</span>
        </div>
        <div className="hero-scene__route">
          <span className="hero-scene__route-pin hero-scene__route-pin--start">
            <LocationOnRounded fontSize="small" />
          </span>
          <motion.span
            animate={{ opacity: [0.55, 1, 0.55], scaleX: [0.35, 1, 0.35] }}
            className="hero-scene__route-line"
            transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
          />
          <span className="hero-scene__route-pin hero-scene__route-pin--end">
            <LocationOnRounded fontSize="small" />
          </span>
        </div>
        <div className="hero-scene__delivery-card">
          <strong>Delivered faster</strong>
          <span>Avg route ETA improved by 22%</span>
        </div>
      </div>

      <motion.div
        animate={{ y: [0, -12, 0], x: [0, 4, 0] }}
        className="hero-scene__hud hero-scene__hud--left"
        transition={{ ...floatingTransition, delay: 0.6 }}
      >
        <span className="hero-scene__hud-label">Orders synced</span>
        <strong>1,284</strong>
      </motion.div>

      <motion.div
        animate={{ y: [0, 10, 0], x: [0, -4, 0] }}
        className="hero-scene__hud hero-scene__hud--right"
        transition={{ ...floatingTransition, delay: 1.2 }}
      >
        <span className="hero-scene__hud-label">Live delivery status</span>
        <strong>Out for delivery</strong>
      </motion.div>
    </div>
  );
}
