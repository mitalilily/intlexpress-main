import { Chip, Typography } from "@mui/material";
import MotionFade from "./MotionFade";

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  dark = false,
}) {
  const center = align === "center";

  return (
    <MotionFade className={center ? "section-heading section-heading--center" : "section-heading"}>
      <Chip
        label={eyebrow}
        sx={{
          alignSelf: center ? "center" : "flex-start",
          backgroundColor: dark ? "rgba(255,255,255,0.12)" : "rgba(33, 70, 255, 0.1)",
          border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(33,70,255,0.12)",
          color: dark ? "#eef5ff" : "#2146ff",
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      />
      <Typography className={`section-title ${dark ? "section-title--dark" : ""}`} variant="h2">
        {title}
      </Typography>
      {description ? (
        <Typography className={`section-copy ${dark ? "section-copy--dark" : ""}`} variant="body1">
          {description}
        </Typography>
      ) : null}
    </MotionFade>
  );
}
