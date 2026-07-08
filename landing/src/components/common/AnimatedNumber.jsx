import { Typography } from "@mui/material";
import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

export default function AnimatedNumber({ value, suffix = "", prefix = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest).toLocaleString("en-IN"));

  useEffect(() => {
    if (!inView) {
      return undefined;
    }

    const controls = animate(motionValue, value, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
    });

    return () => controls.stop();
  }, [inView, motionValue, value]);

  return (
    <Typography className="stat-card__value" component={motion.span} ref={ref}>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </Typography>
  );
}
