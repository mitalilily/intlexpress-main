import { useCallback, useEffect, useState, startTransition } from "react";
import { Alert, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import LoadingCard from "../components/common/LoadingCard";
import MotionFade from "../components/common/MotionFade";
import PageHero from "../components/common/PageHero";
import TrackingTimeline from "../components/tracking/TrackingTimeline";
import SectionHeading from "../components/common/SectionHeading";
import LogisticsMapVisual from "../components/common/LogisticsMapVisual";
import { pageArtwork, trackingSamples } from "../data/siteData";
import { searchTracking } from "../services/api";

export default function TrackingPage() {
  const [trackingId, setTrackingId] = useState(trackingSamples[0].trackingId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const runTracking = useCallback(async (id) => {
    setLoading(true);
    setError("");

    try {
      const response = await searchTracking(id);
      startTransition(() => {
        setResult(response);
      });
    } catch (trackingError) {
      startTransition(() => {
        setResult(null);
        setError(trackingError.message);
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runTracking(trackingSamples[0].trackingId);
  }, [runTracking]);

  return (
    <div className="inner-page">
      <PageHero
        artwork={pageArtwork.trackingHero}
        badge="Live tracking"
        caption="Real-time delivery visibility"
        description="Follow every parcel from booking to doorstep delivery with a clean, modern tracking experience your team and customers can both trust."
        title="Track shipments with premium visibility."
      />

      <section className="landing-section landing-section--muted">
        <div className="container-shell tracking-layout">
          <MotionFade>
            <Paper className="glass-panel calculator-form-card" elevation={0}>
              <Typography variant="h5">Search a tracking ID</Typography>
              <Typography className="calculator-form-card__copy" variant="body2">
                Use the demo IDs below or connect this UI to the production shipment lookup endpoint.
              </Typography>
              <form
                className="calculator-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  runTracking(trackingId);
                }}
              >
                <TextField
                  fullWidth
                  label="Tracking ID"
                  onChange={(event) => setTrackingId(event.target.value)}
                  value={trackingId}
                />
                <Button className="button-primary" disabled={loading} type="submit" variant="contained">
                  {loading ? "Tracking..." : "Track shipment"}
                </Button>
              </form>
              <Stack direction="row" flexWrap="wrap" gap={1.2} mt={2}>
                {trackingSamples.map((sample) => (
                  <Chip
                    key={sample.trackingId}
                    label={sample.trackingId}
                    onClick={() => {
                      setTrackingId(sample.trackingId);
                      runTracking(sample.trackingId);
                    }}
                  />
                ))}
              </Stack>
              {error ? <Alert severity="error">{error}</Alert> : null}
            </Paper>
          </MotionFade>

          <MotionFade delay={0.08}>
            <div className="tracking-page__art">
              <LogisticsMapVisual compact variant="tracking" />
            </div>
          </MotionFade>
        </div>
      </section>

      <section className="landing-section">
        <div className="container-shell">
          <SectionHeading
            eyebrow="Shipment timeline"
            title="Every milestone, surface-level simple and operationally useful"
            description="Track allocation, transit, delivery attempts, and final confirmation with one structured timeline."
          />

          {loading ? (
            <div className="tracking-loading-grid">
              <LoadingCard lines={5} />
              <LoadingCard lines={6} />
            </div>
          ) : result ? (
            <>
              <MotionFade delay={0.12}>
                <Paper className="glass-panel tracking-spotlight" elevation={0}>
                  <div>
                    <Typography variant="overline">Shipment spotlight</Typography>
                    <Typography variant="h4">
                      {result.trackingId} - {result.orderId}
                    </Typography>
                    <Typography className="tracking-spotlight__copy" variant="body2">
                      {result.customer} - {result.courier} - {result.paymentType}
                    </Typography>
                  </div>
                  <Chip className="tracking-spotlight__chip" label={result.status} />
                </Paper>
              </MotionFade>

              <TrackingTimeline activeStep={result.activeStep} timeline={result.timeline} />
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
