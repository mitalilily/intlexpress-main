import { Avatar, Chip, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useEffectEvent, useState } from "react";
import { motion } from "framer-motion";

export default function TestimonialCarousel({ items }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const advanceSlide = useEffectEvent(() => {
    setActiveIndex((current) => (current + 1) % items.length);
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      advanceSlide();
    }, 4500);

    return () => window.clearInterval(timer);
  }, [advanceSlide]);

  const activeItem = items[activeIndex];

  return (
    <div className="testimonial-carousel">
      <Paper className="glass-panel testimonial-carousel__card" component={motion.div} elevation={0} layout>
        <Chip className="testimonial-carousel__chip" label="Customer spotlight" />
        <Typography className="testimonial-carousel__quote" variant="h4">
          “{activeItem.quote}”
        </Typography>
        <Stack alignItems="center" direction="row" gap={1.5}>
          <Avatar className="testimonial-carousel__avatar">
            {activeItem.name
              .split(" ")
              .map((part) => part[0])
              .join("")}
          </Avatar>
          <div>
            <Typography className="testimonial-carousel__name" variant="subtitle1">
              {activeItem.name}
            </Typography>
            <Typography className="testimonial-carousel__role" variant="body2">
              {activeItem.role}
            </Typography>
          </div>
        </Stack>
      </Paper>

      <div className="testimonial-carousel__dots">
        {items.map((item, index) => (
          <button
            key={item.name}
            aria-label={`Show testimonial ${index + 1}`}
            className={`testimonial-carousel__dot ${
              index === activeIndex ? "testimonial-carousel__dot--active" : ""
            }`}
            onClick={() => setActiveIndex(index)}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}
