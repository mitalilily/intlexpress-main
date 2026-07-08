import { Accordion, AccordionDetails, AccordionSummary } from "@mui/material";
import {
  AutoAwesomeRounded,
  CurrencyRupeeRounded,
  ExpandMoreRounded,
  TuneRounded,
  VerifiedRounded,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import MotionFade from "../components/common/MotionFade";
import ReferenceHero from "../components/home/ReferenceHero";
import { getClientAuthUrl } from "../utils/clientAuth";
import {
  featureCards,
  faqItems,
  howItWorks,
  partnerLogos,
  testimonials,
} from "../data/siteData";

const whyChooseItems = [
  {
    Icon: CurrencyRupeeRounded,
    title: "Affordable",
    description:
      "Intlexpress gives growing brands courier tools and shipping rates that stay efficient without compromising reliability.",
  },
  {
    Icon: TuneRounded,
    title: "Customized Filters",
    description:
      "Fine-tune courier selection, payment modes, serviceability, and operational preferences based on your business logic.",
  },
  {
    Icon: AutoAwesomeRounded,
    title: "Smart Courier Allocation",
    description:
      "Use smart allocation logic to route shipments faster, lower delivery costs, and improve success rate across lanes.",
  },
  {
    Icon: VerifiedRounded,
    title: "Branded Tracking Page",
    description:
      "Deliver a polished branded tracking experience that keeps customers informed and reinforces trust after purchase.",
  },
];

export default function HomePage() {
  const clientAuthUrl = getClientAuthUrl();

  return (
    <div className="landing-page">
      <ReferenceHero />

      <section className="landing-section landing-section--muted">
        <div className="container-shell">
          <div className="trusted-brands-panel trusted-brands-panel--static">
            <div className="trusted-brands-panel__copy trusted-brands-panel__copy--center">
              <span className="trusted-brands-panel__eyebrow">Trusted by Leading Brands</span>
              <h2>Trusted by Leading Brands</h2>
              <p>
                Discover why modern ecommerce teams trust Intlexpress for courier comparison, branded tracking, fast dispatch, and dependable shipping operations.
              </p>
              <div className="trusted-brands-panel__cta">
                <a className="landing-button landing-button--primary" href={clientAuthUrl}>
                  Start Shipping
                </a>
              </div>
            </div>
            <div className="trusted-brands-panel__logo-grid">
              {partnerLogos.map((partner) => (
                <div key={partner.name} className="trusted-brands-panel__logo-card">
                  <img alt={`${partner.name} logo`} src={partner.src} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="container-shell">
          <div className="simple-section-heading">
            <h2>How Intlexpress Works</h2>
            <p>Understand the shipping workflow in one clean sequence before you start dispatching at scale.</p>
          </div>

          <div className="process-grid process-grid--four">
            {howItWorks.map((step, index) => (
              <MotionFade key={step.title} delay={index * 0.06}>
                <article className="process-card">
                  <span className="process-card__index">0{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              </MotionFade>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--muted">
        <div className="container-shell">
          <div className="simple-section-heading">
            <h2>Our Prominent Features</h2>
            <p>Feature communication is now standardized into one symmetric two-column visual rhythm.</p>
          </div>

          <div className="feature-poster-grid">
            {featureCards.slice(0, 4).map((item, index) => (
              <MotionFade key={item.title} delay={index * 0.04}>
                <Link className="feature-card feature-card--link" to="/rate-calculator">
                  <span className="feature-card__badge">{item.badge}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </Link>
              </MotionFade>
            ))}
          </div>

          <div className="section-cta-row">
            <a className="landing-button landing-button--primary" href={clientAuthUrl}>
              Get Started
            </a>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="container-shell why-choose-block">
          <div className="simple-section-heading">
            <h2>Why Choose Us?</h2>
          </div>
          <div className="why-choose-block__panel">
            <div className="why-choose-block__grid">
              {whyChooseItems.map((item, index) => (
                <MotionFade key={item.title} delay={index * 0.05}>
                  <article className="why-choose-block__item">
                    <span className="why-choose-block__icon">
                      <item.Icon />
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                </MotionFade>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--muted">
        <div className="container-shell testimonial-layout testimonial-layout--single">
          <MotionFade className="simple-section-heading">
            <h2>Let's See What Our Clients Say</h2>
            <p>Social proof now sits later in the funnel, right before FAQ and final conversion actions.</p>
          </MotionFade>
          <div className="testimonial-grid">
            {testimonials.map((item, index) => (
              <MotionFade key={item.name} delay={index * 0.05}>
                <article className="testimonial-card">
                  <p>"{item.quote}"</p>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.role}</span>
                  </div>
                </article>
              </MotionFade>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="container-shell faq-layout">
          <div className="simple-section-heading">
            <h2>Frequently Asked Questions</h2>
            <p>Answer key objections clearly before the final CTA.</p>
          </div>
          <div className="faq-list">
            {faqItems.map((item, index) => (
              <MotionFade key={item.question} delay={index * 0.04}>
                <Accordion className="faq-item" defaultExpanded={index === 0} disableGutters elevation={0}>
                  <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                    {item.question}
                  </AccordionSummary>
                  <AccordionDetails>{item.answer}</AccordionDetails>
                </Accordion>
              </MotionFade>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--cta">
        <div className="container-shell">
          <div className="cta-band">
            <div>
              <span className="cta-band__eyebrow">Ready to ship smarter?</span>
              <h2>Give every order a premium delivery experience with one clear shipping workflow.</h2>
              <p>
                Start with Intlexpress today to compare courier rates, automate dispatch, and scale your logistics with more confidence.
              </p>
            </div>
            <div className="landing-hero__actions">
              <a className="landing-button landing-button--light" href={clientAuthUrl}>
                Get Started
              </a>
              <Link className="landing-button landing-button--outline-light" to="/contact">
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
