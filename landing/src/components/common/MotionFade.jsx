import { motion, useReducedMotion } from "framer-motion";

export default function MotionFade({ children, className = "", delay = 0, y = 24 }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y }}
      transition={reduceMotion ? undefined : { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
