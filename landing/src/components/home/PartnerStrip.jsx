import { motion } from "framer-motion";

export default function PartnerStrip({ partners }) {
  const repeatedPartners = [...partners, ...partners];

  return (
    <div className="partner-strip">
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        className="partner-strip__track"
        transition={{ duration: 20, ease: "linear", repeat: Infinity }}
      >
        {repeatedPartners.map((partner, index) => (
          <div key={`${partner}-${index}`} className="partner-strip__item">
            <span>{partner}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
