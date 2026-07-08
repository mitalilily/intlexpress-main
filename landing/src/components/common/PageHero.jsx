import MotionFade from "./MotionFade";
import LogisticsMapVisual from "./LogisticsMapVisual";

export default function PageHero({ badge, title, description, caption, artwork }) {
  const hasArtwork = Boolean(artwork?.src);
  const visualVariant = artwork?.variant ?? (!hasArtwork ? "support" : "");
  const hasVisual = Boolean(visualVariant);
  const plainArtwork = Boolean(artwork?.plain);
  const mediaCardClassName = [
    "page-hero__media-card",
    plainArtwork ? "page-hero__media-card--plain" : "",
    hasVisual ? "page-hero__media-card--visual" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="page-hero">
      <div className="container-shell page-hero__grid">
        <MotionFade className="page-hero__content">
          <div className="page-hero__badges">
            {badge ? <span className="page-hero__badge">{badge}</span> : null}
            {caption ? <span className="page-hero__badge page-hero__badge--soft">{caption}</span> : null}
          </div>
          <h1 className="page-hero__title">{title}</h1>
          <p className="page-hero__description">{description}</p>
        </MotionFade>

        {hasVisual || hasArtwork ? (
          <MotionFade className="page-hero__media" delay={0.08}>
            <div className={mediaCardClassName}>
              {hasVisual ? (
                <LogisticsMapVisual variant={visualVariant} />
              ) : (
                <img
                  alt={artwork.alt}
                  className={`page-hero__image ${artwork.className ?? ""}`.trim()}
                  src={artwork.src}
                />
              )}
            </div>
          </MotionFade>
        ) : null}
      </div>
    </section>
  );
}
