import { useDeferredValue, useMemo, useState, startTransition } from "react";
import { Alert, Button, MenuItem, Paper, Typography } from "@mui/material";
import LoadingCard from "../components/common/LoadingCard";
import MotionFade from "../components/common/MotionFade";
import PageHero from "../components/common/PageHero";
import SectionHeading from "../components/common/SectionHeading";
import LogisticsMapVisual from "../components/common/LogisticsMapVisual";
import CourierOptionCard from "../components/rates/CourierOptionCard";
import { defaultRateForm, pageArtwork, paymentModes, rateGuideSteps } from "../data/siteData";
import { requestRateQuote } from "../services/api";
import { buildRateSummary, formatCurrency, formatWeight } from "../utils/calculators";

export default function RateCalculatorPage() {
  const [formValues, setFormValues] = useState(defaultRateForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const deferredForm = useDeferredValue(formValues);

  const previewSummary = useMemo(() => buildRateSummary(deferredForm), [deferredForm]);

  const handleChange = (key) => (event) => {
    setFormValues((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await requestRateQuote(formValues);
      startTransition(() => {
        setResult(response);
      });
    } catch (rateError) {
      startTransition(() => {
        setResult(null);
        setError(rateError.message);
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inner-page">
      <PageHero
        artwork={pageArtwork.rateHero}
        badge="Rate calculator"
        caption="Courier comparison engine"
        description="Add pickup, delivery, weight, and package dimensions to compare courier rates in one polished decision screen."
        title="Compare courier rates instantly."
      />

      <section className="landing-section landing-section--muted">
        <div className="container-shell calculator-layout">
          <MotionFade>
            <Paper className="glass-panel calculator-form-card" elevation={0}>
              <Typography variant="h5">Lane and package details</Typography>
              <Typography className="calculator-form-card__copy" variant="body2">
                Built for prepaid and COD shipments with billable-weight logic and production-ready API behavior.
              </Typography>

              <form className="calculator-form" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <input
                    className="field-input"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={handleChange("originPincode")}
                    placeholder="Origin pincode"
                    value={formValues.originPincode}
                  />
                  <input
                    className="field-input"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={handleChange("destinationPincode")}
                    placeholder="Destination pincode"
                    value={formValues.destinationPincode}
                  />
                </div>
                <div className="form-grid form-grid--three">
                  <input className="field-input" onChange={handleChange("weight")} placeholder="Weight (kg)" value={formValues.weight} />
                  <input className="field-input" onChange={handleChange("length")} placeholder="Length (cm)" value={formValues.length} />
                  <input className="field-input" onChange={handleChange("breadth")} placeholder="Breadth (cm)" value={formValues.breadth} />
                </div>
                <div className="form-grid">
                  <input className="field-input" onChange={handleChange("height")} placeholder="Height (cm)" value={formValues.height} />
                  <select className="field-input" onChange={handleChange("paymentType")} value={formValues.paymentType}>
                    {paymentModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </div>

                <Button className="button-primary" disabled={loading} type="submit" variant="contained">
                  {loading ? "Calculating..." : "Calculate rates"}
                </Button>
              </form>

              {error ? <Alert severity="error">{error}</Alert> : null}
            </Paper>
          </MotionFade>

          <MotionFade delay={0.08}>
            <Paper className="glass-panel live-summary-card" elevation={0}>
              <Typography variant="h5">Live billable preview</Typography>
              <div className="live-summary-card__grid">
                <div>
                  <span>Zone</span>
                  <strong>{previewSummary.zone.label}</strong>
                </div>
                <div>
                  <span>Actual weight</span>
                  <strong>{formatWeight(previewSummary.actualWeight)}</strong>
                </div>
                <div>
                  <span>Volumetric weight</span>
                  <strong>{formatWeight(previewSummary.volumetricWeight)}</strong>
                </div>
                <div>
                  <span>Billable weight</span>
                  <strong>{formatWeight(previewSummary.billableWeight)}</strong>
                </div>
                <div>
                  <span>Payment surcharge</span>
                  <strong>{formatCurrency(previewSummary.paymentSurcharge)}</strong>
                </div>
                <div>
                  <span>Lane SLA</span>
                  <strong>{previewSummary.zone.sla}</strong>
                </div>
              </div>
            </Paper>
          </MotionFade>
        </div>
      </section>

      <section className="landing-section">
        <div className="container-shell guide-layout">
          <MotionFade className="guide-layout__visual" delay={0.06}>
            <div className="illustration-panel">
              <LogisticsMapVisual compact variant="rates" />
            </div>
          </MotionFade>

          <MotionFade delay={0.16}>
            <Paper className="glass-panel user-guide-card" elevation={0}>
              <SectionHeading
                eyebrow="How to use it"
                title="A fast, guided workflow for courier cost discovery"
                description="Enter shipment details once, verify the billable preview, and then compare the best dispatch options."
              />
              <div className="guide-list">
                {rateGuideSteps.map((step) => (
                  <div className="guide-item" key={step.label}>
                    <span className="guide-item__badge">{step.label}</span>
                    <Typography className="guide-item__title" variant="subtitle1">
                      {step.title}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {step.description}
                    </Typography>
                  </div>
                ))}
              </div>
            </Paper>
          </MotionFade>
        </div>
      </section>

      <section className="landing-section landing-section--muted">
        <div className="container-shell">
          <SectionHeading
            eyebrow="Courier options"
            title="Shortlist the right partner before you book"
            description="Every option is scored for speed, billable weight, and booking readiness so your team can decide faster."
          />
          <div className="courier-results-grid">
            {loading
              ? [0, 1, 2].map((index) => <LoadingCard key={index} className="courier-loading-card" lines={6} />)
              : result?.options?.map((option) => <CourierOptionCard key={option.id} option={option} />)}
          </div>
        </div>
      </section>
    </div>
  );
}
