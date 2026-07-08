import { Paper, Skeleton, Stack } from "@mui/material";

export default function LoadingCard({ lines = 4, className = "" }) {
  return (
    <Paper className={`glass-panel ${className}`} elevation={0}>
      <Stack spacing={1.2}>
        <Skeleton animation="wave" height={28} variant="rounded" width="40%" />
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={`loading-line-${index}`}
            animation="wave"
            height={18}
            variant="rounded"
            width={index === lines - 1 ? "55%" : "100%"}
          />
        ))}
      </Stack>
    </Paper>
  );
}
