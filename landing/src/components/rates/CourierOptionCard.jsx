import { BoltRounded, CheckCircleRounded, SpeedRounded } from "@mui/icons-material";
import { Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { formatCurrency, formatWeight } from "../../utils/calculators";

export default function CourierOptionCard({ option }) {
  return (
    <Paper className="glass-panel courier-card" elevation={0}>
      <div className="courier-card__top">
        <div>
          <Typography className="courier-card__title" variant="h6">
            {option.name}
          </Typography>
          <Typography className="courier-card__accent" variant="body2">
            {option.accent}
          </Typography>
        </div>
        <Chip className="courier-card__zone" label={option.zone} />
      </div>

      <div className="courier-card__price-row">
        <Typography className="courier-card__price" variant="h4">
          {formatCurrency(option.price)}
        </Typography>
        <Typography className="courier-card__eta" variant="body2">
          ETA {option.eta}
        </Typography>
      </div>

      <Stack className="courier-card__meta" direction="row" flexWrap="wrap" gap={1.2}>
        <span>
          <BoltRounded fontSize="small" />
          Service score {option.serviceScore}
        </span>
        <span>
          <SpeedRounded fontSize="small" />
          Billable {formatWeight(option.billableWeight)}
        </span>
        <span>
          <CheckCircleRounded fontSize="small" />
          Ready to dispatch
        </span>
      </Stack>

      <LinearProgress
        className="courier-card__progress"
        value={option.serviceScore}
        variant="determinate"
      />

      <div className="courier-card__badges">
        {option.badges.map((badge) => (
          <Chip key={badge} className="courier-card__badge" label={badge} />
        ))}
      </div>
    </Paper>
  );
}
