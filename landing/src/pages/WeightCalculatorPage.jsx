import { useDeferredValue, useMemo, useState } from "react";
import { Alert, Paper, Slider, Stack, TextField, Typography } from "@mui/material";
import MotionFade from "../components/common/MotionFade";
import PageHero from "../components/common/PageHero";
import SectionHeading from "../components/common/SectionHeading";
import LogisticsMapVisual from "../components/common/LogisticsMapVisual";
import WeightVisualizer from "../components/weight/WeightVisualizer";
import { defaultWeightForm, pageArtwork, weightGuideSteps } from "../data/siteData";
import { calculateVolumetricWeight, formatWeight, getBillableWeight } from "../utils/calculators";

export default function WeightCalculatorPage() {
  const [formValues, setFormValues] = useState(defaultWeightForm);
  const deferredValues = useDeferredValue(formValues);

  const volumetricWeight = useMemo(
    () =>
      calculateVolumetricWeight(
        deferredValues.length,
        deferredValues.breadth,
        deferredValues.height
      ),
    [deferredValues]
  );

  const billableWeight = useMemo(
    () => getBillableWeight(deferredValues.actualWeight, volumetricWeight),
    [deferredValues.actualWeight, volumetricWeight]
  );

  const oversize = volumetricWeight > deferredValues.actualWeight;

  const handleSliderChange = (key) => (_, value) => {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleInputChange = (key) => (event) => {
    setFormValues((current) => ({
      ...current,
      [key]: Number(event.target.value || 0),
    }));
  };

  return (
    <div className="inner-page">
      <PageHero
        artwork={pageArtwork.weightHero}
        badge="Weight calculator"
        caption="Volumetric billing"
        description="Measure parcels quickly and see how actual weight compares with volumetric weight before you lock courier pricing."
        title="Calculate billable parcel weight."
      />

      <section className="landing-section">
        <div className="container-shell guide-layout">
          <MotionFade className="guide-layout__visual" delay={0.06}>
            <div className="illustration-panel">
              <LogisticsMapVisual compact variant="weight" />
            </div>
          </MotionFade>

          <MotionFade delay={0.16}>
            <Paper className="glass-panel user-guide-card" elevation={0}>
              <SectionHeading
                eyebrow="How it works"
                title="Use the same logic couriers apply to price shipments"
                description="A clear workflow for understanding package dimensions, volumetric weight, and the number that will actually be billed."
              />
              <Stack gap={2.2} mt={3}>
                {weightGuideSteps.map((step) => (
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
              </Stack>
            </Paper>
          </MotionFade>
        </div>
      </section>

      <section className="landing-section landing-section--muted">
        <div className="container-shell weight-layout">
          <MotionFade>
            <Paper className="glass-panel weight-controls" elevation={0}>
              <Typography variant="h5">Parcel dimensions</Typography>
              <Typography className="weight-controls__copy" variant="body2">
                Intlexpress uses the standard divisor of 5000 for volumetric courier billing.
              </Typography>

              <div className="weight-slider-group">
                <label>
                  <span>Length</span>
                  <Slider max={80} min={10} onChange={handleSliderChange("length")} value={formValues.length} />
                </label>
                <label>
                  <span>Breadth</span>
                  <Slider max={80} min={10} onChange={handleSliderChange("breadth")} value={formValues.breadth} />
                </label>
                <label>
                  <span>Height</span>
                  <Slider max={80} min={8} onChange={handleSliderChange("height")} value={formValues.height} />
                </label>
              </div>

              <div className="form-grid form-grid--three">
                <TextField label="Length (cm)" onChange={handleInputChange("length")} value={formValues.length} />
                <TextField label="Breadth (cm)" onChange={handleInputChange("breadth")} value={formValues.breadth} />
                <TextField label="Height (cm)" onChange={handleInputChange("height")} value={formValues.height} />
              </div>
              <TextField
                label="Actual weight (kg)"
                onChange={handleInputChange("actualWeight")}
                value={formValues.actualWeight}
              />
            </Paper>
          </MotionFade>

          <MotionFade delay={0.08}>
            <Paper className="glass-panel weight-results" elevation={0}>
              <WeightVisualizer
                breadth={deferredValues.breadth}
                height={deferredValues.height}
                length={deferredValues.length}
              />
              <div className="weight-results__summary">
                <div>
                  <span>Volumetric weight</span>
                  <strong>{formatWeight(volumetricWeight)}</strong>
                </div>
                <div>
                  <span>Actual weight</span>
                  <strong>{formatWeight(deferredValues.actualWeight)}</strong>
                </div>
                <div>
                  <span>Billable weight</span>
                  <strong>{formatWeight(billableWeight)}</strong>
                </div>
              </div>
              <Alert severity={oversize ? "warning" : "success"}>
                {oversize
                  ? "Volumetric weight is higher than actual weight, so courier pricing will likely use the volumetric figure."
                  : "Actual weight is currently higher, so you are in a healthy packaging range for this parcel."}
              </Alert>
            </Paper>
          </MotionFade>
        </div>
      </section>
    </div>
  );
}
