import { useState } from "react";
import { Alert, Button, Paper, Typography } from "@mui/material";
import PageHero from "../components/common/PageHero";
import MotionFade from "../components/common/MotionFade";
import { brand } from "../data/siteData";
import { submitContact } from "../services/api";

const initialForm = {
  name: "",
  email: "",
  phone: brand.phone,
  company: "",
  message: "",
};

export default function ContactPage() {
  const [formValues, setFormValues] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const handleChange = (key) => (event) => {
    setFormValues((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const response = await submitContact(formValues);
      setStatus({ type: "success", message: response.message });
      setFormValues(initialForm);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inner-page">
      <PageHero
        badge="Contact"
        caption="Premium logistics support"
        description="Talk to the Intlexpress team about shipping setup, courier onboarding, pricing logic, branded tracking, or dispatch automation."
        title="Let's design your smarter shipping workflow."
      />

      <section className="landing-section landing-section--muted">
        <div className="container-shell contact-grid">
          <MotionFade>
            <Paper className="glass-panel contact-card" elevation={0}>
              <Typography className="contact-card__title" variant="h5">
                Reach Intlexpress directly
              </Typography>
              <div className="contact-card__stack">
                {brand.founder ? (
                  <div>
                    <Typography className="contact-card__label" variant="body2">
                      Founder
                    </Typography>
                    <Typography variant="body1">{brand.founder}</Typography>
                  </div>
                ) : null}
                <div>
                  <Typography className="contact-card__label" variant="body2">
                    Phone
                  </Typography>
                  <a className="contact-card__link" href={`tel:${brand.phone}`}>
                    {brand.phone}
                  </a>
                </div>
                <div>
                  <Typography className="contact-card__label" variant="body2">
                    Support Phone
                  </Typography>
                  <a className="contact-card__link" href={`tel:${brand.supportPhone}`}>
                    {brand.supportPhone}
                  </a>
                </div>
                <div>
                  <Typography className="contact-card__label" variant="body2">
                    Email
                  </Typography>
                  <a className="contact-card__link" href={`mailto:${brand.email}`}>
                    {brand.email}
                  </a>
                </div>
                {brand.bookingEmail ? (
                  <div>
                    <Typography className="contact-card__label" variant="body2">
                      Booking Email
                    </Typography>
                    <a className="contact-card__link" href={`mailto:${brand.bookingEmail}`}>
                      {brand.bookingEmail}
                    </a>
                  </div>
                ) : null}
                <div>
                  <Typography className="contact-card__label" variant="body2">
                    Address
                  </Typography>
                  <Typography variant="body1">{brand.address}</Typography>
                </div>
                {brand.gstin ? (
                  <div>
                    <Typography className="contact-card__label" variant="body2">
                      GSTIN
                    </Typography>
                    <Typography variant="body1">{brand.gstin}</Typography>
                  </div>
                ) : null}
              </div>
            </Paper>
          </MotionFade>

          <MotionFade delay={0.08}>
            <Paper className="glass-panel contact-form" elevation={0}>
              <Typography className="contact-card__title" variant="h5">
                Send an inquiry
              </Typography>
              <Typography className="contact-card__subcopy" variant="body2">
                The UI is refreshed, while the underlying form behavior and API integration path remain unchanged.
              </Typography>

              <form className="contact-form__fields" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <input className="field-input" onChange={handleChange("name")} placeholder="Name" required value={formValues.name} />
                  <input className="field-input" onChange={handleChange("email")} placeholder="Email" required type="email" value={formValues.email} />
                </div>
                <div className="form-grid">
                  <input className="field-input" onChange={handleChange("phone")} placeholder="Phone" value={formValues.phone} />
                  <input className="field-input" onChange={handleChange("company")} placeholder="Company" value={formValues.company} />
                </div>
                <textarea
                  className="field-input field-input--textarea"
                  onChange={handleChange("message")}
                  placeholder="Tell us about your shipping volume, courier pain points, or integration needs"
                  required
                  value={formValues.message}
                />

                {status.message ? <Alert severity={status.type}>{status.message}</Alert> : null}

                <Button className="button-primary" disabled={loading} type="submit" variant="contained">
                  {loading ? "Sending..." : "Send inquiry"}
                </Button>
              </form>
            </Paper>
          </MotionFade>
        </div>
      </section>
    </div>
  );
}
