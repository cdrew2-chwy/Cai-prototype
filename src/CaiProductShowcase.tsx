import type { CaiProductItem, CaiProductsBlock } from "./chatUtils";
import "./cai-product-cards.css";

function formatReviewCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`.replace(/\.0M$/, "M");
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`.replace(/\.0k$/, "k");
  return String(n);
}

/** Parse “$56.54” → dollars + two-digit cents for superscript (matches PDP reference screenshot). */
function parsePriceParts(raw: string): { dollars: string; cents: string | null } {
  const t = raw.replace(/,/g, "").trim();
  const m = t.match(/^\$(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return { dollars: raw, cents: null };
  const intPart = m[1]!;
  const dec = m[2];
  return { dollars: `$${intPart}`, cents: dec ? dec.padEnd(2, "0").slice(0, 2) : null };
}

function PriceSuperscript({ price }: { price: string }) {
  const { dollars, cents } = parsePriceParts(price);
  if (!cents) {
    return <span className="cai-product-card__price-main">{dollars}</span>;
  }
  return (
    <span className="cai-product-card__price-main">
      {dollars}
      <sup className="cai-product-card__price-cents">{cents}</sup>
    </span>
  );
}

function StarRating({ rating, reviewCount }: { rating: number; reviewCount?: number }) {
  const rounded = Math.min(5, Math.max(0, Math.round(rating)));
  const label =
    typeof reviewCount === "number" && reviewCount > 0
      ? `${rounded} out of 5 stars, ${reviewCount} reviews`
      : `${rounded} out of 5 stars`;
  return (
    <div className="cai-product-card__rating-row" aria-label={label}>
      <span className="cai-product-card__stars" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < rounded ? "cai-product-card__star cai-product-card__star--on" : "cai-product-card__star"}>
            ★
          </span>
        ))}
      </span>
      {typeof reviewCount === "number" && reviewCount > 0 ? (
        <span className="cai-product-card__reviews">({formatReviewCount(reviewCount)})</span>
      ) : null}
    </div>
  );
}

/** Medium / simple cards — compact star row + optional deal. */
function ProductCardDetails({ item }: { item: CaiProductItem }) {
  return (
    <>
      {item.categoryLabel ? <p className="cai-product-card__eyebrow">{item.categoryLabel}</p> : null}
      {item.badge ? <span className="cai-product-card__badge">{item.badge}</span> : null}
      {item.brand ? <p className="cai-product-card__brand">{item.brand}</p> : null}
      <h3 className="cai-product-card__title">{item.title}</h3>
      {item.subtitle ? <p className="cai-product-card__subtitle">{item.subtitle}</p> : null}
      {typeof item.rating === "number" ? (
        <StarRating rating={item.rating} reviewCount={item.reviewCount} />
      ) : null}
      {item.price || item.wasPrice ? (
        <div className="cai-product-card__price-row">
          {item.wasPrice ? <span className="cai-product-card__was-price">{item.wasPrice}</span> : null}
          {item.price ? <span className="cai-product-card__price">{item.price}</span> : null}
        </div>
      ) : null}
      {item.dealLabel ? <p className="cai-product-card__deal">{item.dealLabel}</p> : null}
      <span className="cai-product-card__cta" aria-hidden={Boolean(item.url)}>
        View
      </span>
    </>
  );
}

function CardMedia({ item, variant }: { item: CaiProductItem; variant?: "pdp" | "default" }) {
  const mediaClass =
    variant === "pdp" ? "cai-product-card__media cai-product-card__media--pdp" : "cai-product-card__media";
  if (item.imageUrl) {
    return (
      <div className={mediaClass}>
        <img className="cai-product-card__img" src={item.imageUrl} alt="" loading="lazy" />
      </div>
    );
  }
  const initial = item.title.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className={`${mediaClass} cai-product-card__placeholder`}>
      <span>{initial}</span>
    </div>
  );
}

/**
 * Large “top pick” — PDP layout from reference `src/assets/cai-product-card-reference.png`
 * (gallery → dots → sizes line → brand → title → At a glance → price row → CTAs → fulfillment).
 */
function ProductCardLarge({ item }: { item: CaiProductItem }) {
  const dotCount = item.galleryCount ?? (item.imageUrl ? 5 : 1);
  const active = Math.min(item.galleryActiveIndex ?? 0, Math.max(0, dotCount - 1));
  const url = item.url?.trim();

  return (
    <article className="cai-product-card cai-product-card--large cai-product-card--pdp" aria-label={item.title}>
      <div className="cai-product-card__pdp-top">
        <CardMedia item={item} variant="pdp" />
        <div className="cai-product-card__dots" aria-hidden>
          {Array.from({ length: dotCount }, (_, i) => (
            <span key={i} className={`cai-product-card__dot${i === active ? " cai-product-card__dot--active" : ""}`} />
          ))}
        </div>
        {item.sizeVariantLabel ? <p className="cai-product-card__size-variant">{item.sizeVariantLabel}</p> : null}
      </div>

      <div className="cai-product-card__body cai-product-card__body--pdp">
        {item.badge ? <span className="cai-product-card__badge cai-product-card__badge--pdp">{item.badge}</span> : null}
        {item.brand ? <p className="cai-product-card__brand cai-product-card__brand--pdp">{item.brand}</p> : null}
        <h3 className="cai-product-card__title cai-product-card__title--pdp">{item.title}</h3>
        {item.subtitle ? <p className="cai-product-card__subtitle cai-product-card__subtitle--pdp">{item.subtitle}</p> : null}

        {item.atAGlance && item.atAGlance.length > 0 ? (
          <div className="cai-product-card__glance">
            <p className="cai-product-card__glance-heading">At a glance</p>
            <div className="cai-product-card__glance-scroll" role="list">
              {item.atAGlance.map((label) => (
                <span key={label} className="cai-product-card__glance-chip" role="listitem">
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {item.price || item.wasPrice ? (
          <div className="cai-product-card__commercial">
            <div className="cai-product-card__commercial-left">
              {item.wasPrice ? <span className="cai-product-card__was-price cai-product-card__was-price--pdp">{item.wasPrice}</span> : null}
              <span className="cai-product-card__price-slot">
                {item.price ? <PriceSuperscript price={item.price} /> : null}
                {item.unitPrice ? <span className="cai-product-card__unit-price">{item.unitPrice}</span> : null}
              </span>
            </div>
            {typeof item.rating === "number" ? (
              <div className="cai-product-card__commercial-rating" aria-label="Average rating">
                <span className="cai-product-card__rating-value">{item.rating.toFixed(1)}</span>
                <span className="cai-product-card__rating-singleton" aria-hidden>
                  ★
                </span>
                {typeof item.reviewCount === "number" && item.reviewCount > 0 ? (
                  <span className="cai-product-card__rating-reviews">{formatReviewCount(item.reviewCount)}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="cai-product-card__actions">
          <button type="button" className="cai-product-card__btn cai-product-card__btn--cart" disabled>
            Add to cart
          </button>
          {url ? (
            <a className="cai-product-card__btn cai-product-card__btn--buy" href={url} target="_blank" rel="noopener noreferrer">
              Buy it now
            </a>
          ) : (
            <button type="button" className="cai-product-card__btn cai-product-card__btn--buy" disabled>
              Buy it now
            </button>
          )}
        </div>

        <p className="cai-product-card__fulfillment">Free 1-3 day delivery on this item • Free 365-day returns</p>
      </div>
    </article>
  );
}

function ProductCardMedium({ item }: { item: CaiProductItem }) {
  const inner = (
    <>
      <CardMedia item={item} />
      <div className="cai-product-card__body">
        <ProductCardDetails item={item} />
      </div>
    </>
  );

  if (item.url) {
    return (
      <a
        className="cai-product-card cai-product-card--medium cai-product-card--link"
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${item.title} — view product`}
      >
        {inner}
      </a>
    );
  }
  return (
    <article className="cai-product-card cai-product-card--medium" aria-label={item.title}>
      {inner}
    </article>
  );
}

type ShowcaseProps = {
  block: CaiProductsBlock;
  /** When the parent renders {@link CaiProductsBlock.heading} as the section title (Figma 3211:111809). */
  suppressHeading?: boolean;
};

/** Renders Figma-aligned product cards from a parsed ```cai-products``` block. */
export function CaiProductShowcase({ block, suppressHeading = false }: ShowcaseProps) {
  const headingEl =
    !suppressHeading && block.heading ? (
      <p className="cai-product-showcase__heading">{block.heading}</p>
    ) : null;

  if (block.layout === "top_pick") {
    const item = block.items[0];
    if (!item) return null;
    return (
      <div className="cai-product-showcase">
        {headingEl}
        <ProductCardLarge item={item} />
      </div>
    );
  }

  return (
    <div className="cai-product-showcase">
      {headingEl}
      <div className="cai-product-carousel" role="region" aria-label="Product options">
        {block.items.map((item, i) => (
          <ProductCardMedium key={`${item.title}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
