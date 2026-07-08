import {
  CheckCircleRounded,
  Inventory2Rounded,
  LocalShippingRounded,
  PlaceRounded,
  ReceiptLongRounded,
} from "@mui/icons-material";
import { Paper, Typography } from "@mui/material";
import { motion } from "framer-motion";

const iconMap = {
  placed: <ReceiptLongRounded />,
  dispatched: <Inventory2Rounded />,
  transit: <LocalShippingRounded />,
  ofd: <PlaceRounded />,
  delivered: <CheckCircleRounded />,
};

export default function TrackingTimeline({ timeline, activeStep = 0 }) {
  return (
    <div className="tracking-timeline">
      {timeline.map((item, index) => {
        const completed = index <= activeStep;

        return (
          <motion.div
            key={item.key}
            className="tracking-timeline__row"
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.45, delay: index * 0.08 }}
            viewport={{ once: true, amount: 0.3 }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div className={`tracking-timeline__marker ${completed ? "tracking-timeline__marker--active" : ""}`}>
              {iconMap[item.key]}
            </div>
            <Paper className="glass-panel tracking-timeline__card" elevation={0}>
              <div className="tracking-timeline__header">
                <Typography variant="h6">{item.title}</Typography>
                <span className={`timeline-badge ${completed ? "timeline-badge--active" : ""}`}>
                  {completed ? "Completed" : "Upcoming"}
                </span>
              </div>
              <Typography className="tracking-timeline__note" variant="body2">
                {item.note}
              </Typography>
              <div className="tracking-timeline__meta">
                <span>{item.location}</span>
                <span>{item.time}</span>
              </div>
            </Paper>
          </motion.div>
        );
      })}
    </div>
  );
}
