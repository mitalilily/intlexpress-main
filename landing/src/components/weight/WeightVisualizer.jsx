import { motion } from "framer-motion";

export default function WeightVisualizer({ length, breadth, height }) {
  const widthScale = Math.min(1, breadth / 40);
  const depthScale = Math.min(1, length / 50);
  const heightScale = Math.min(1, height / 40);

  return (
    <div className="weight-visualizer">
      <motion.div
        animate={{ rotateX: [55, 51, 55], rotateZ: [-18, -14, -18] }}
        className="weight-visualizer__cube"
        transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
      >
        <div className="weight-visualizer__face weight-visualizer__face--front" style={{ transform: `scale(${widthScale}, ${heightScale})` }} />
        <div className="weight-visualizer__face weight-visualizer__face--top" style={{ transform: `rotateX(90deg) scale(${widthScale}, ${depthScale})` }} />
        <div className="weight-visualizer__face weight-visualizer__face--side" style={{ transform: `rotateY(90deg) scale(${depthScale}, ${heightScale})` }} />
      </motion.div>
    </div>
  );
}
