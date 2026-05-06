import addToCartIconButton from "./assets/cai-add-to-cart-icon-button.svg";
import type { CaiProductItem, CaiProductsBlock } from "./chatUtils";
import { useChewyRemoteImageSrc } from "./useChewyProductImageSrc";
import "./cai-product-cards.css";

function formatReviewCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`.replace(/\.0M$/, "M");
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`.replace(/\.0k$/, "k");
  return String(n);
}

/** Parse “$56.54” → dollars + two-digit cents for superscript (Figma product card). */
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

function ProductTitleInline({ brand, title }: { brand?: string; title: string }) {
  const b = brand?.trim();
  let rest = title;
  if (b) {
    if (title.toLowerCase().startsWith(b.toLowerCase())) {
      rest = title.slice(b.length).trim().replace(/^[-–—]\s*/, "");
    }
  }
  return (
    <h3 className="cai-product-card__title cai-product-card__title--recommend">
      {b ? (
        <>
          <span className="cai-product-card__title-brand">{b}</span>
          {rest ? <span className="cai-product-card__title-rest"> {rest}</span> : null}
        </>
      ) : (
        <span className="cai-product-card__title-rest cai-product-card__title-rest--solo">{title}</span>
      )}
    </h3>
  );
}

function CardMedia({ item }: { item: CaiProductItem }) {
  const remote = item.imageUrl?.trim();
  const { src, referrerPolicy, onError, failed } = useChewyRemoteImageSrc(remote);
  if (remote && !failed) {
    return (
      <div className="cai-product-card__media cai-product-card__media--recommend">
        <img
          className="cai-product-card__img"
          src={src}
          referrerPolicy={referrerPolicy}
          onError={onError}
          alt=""
          loading="lazy"
        />
      </div>
    );
  }
  const initial = item.title.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="cai-product-card__media cai-product-card__media--recommend cai-product-card__placeholder">
      <span>{initial}</span>
    </div>
  );
}

/**
 * Single recommendation card — Figma 3571:49534 (shared for top_pick and category_options).
 * https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=3571-49534
 */
function ProductCardRecommendation({ item, variant }: { item: CaiProductItem; variant: "stacked" | "carousel" }) {
  const dotCount = item.galleryCount ?? (item.imageUrl ? 5 : 1);
  const active = Math.min(item.galleryActiveIndex ?? 0, Math.max(0, dotCount - 1));
  const url = item.url?.trim();
  const rootClass =
    "cai-product-card cai-product-card--recommend" +
    (variant === "carousel" ? " cai-product-card--recommend-carousel" : "");

  return (
    <article className={rootClass} aria-label={item.title}>
      <div className="cai-product-card__recommend-top">
        <div className="cai-product-card__recommend-image-area">
          <CardMedia item={item} />
        </div>
        <div className="cai-product-card__dots cai-product-card__dots--recommend" aria-hidden>
          {Array.from({ length: dotCount }, (_, i) => (
            <span
              key={i}
              className={
                i === active ? "cai-product-card__dot cai-product-card__dot--recommend-active" : "cai-product-card__dot cai-product-card__dot--recommend"
              }
            />
          ))}
        </div>
        {item.sizeVariantLabel ? (
          <p className="cai-product-card__size-variant cai-product-card__size-variant--recommend">{item.sizeVariantLabel}</p>
        ) : null}
      </div>

      <div className="cai-product-card__recommend-body">
        <ProductTitleInline brand={item.brand} title={item.title} />

        {item.price || item.wasPrice ? (
          <div className="cai-product-card__commercial cai-product-card__commercial--recommend">
            <div className="cai-product-card__commercial-left cai-product-card__commercial-left--recommend">
              {item.wasPrice ? (
                <span className="cai-product-card__was-price cai-product-card__was-price--recommend">{item.wasPrice}</span>
              ) : null}
              <div className="cai-product-card__price-slot cai-product-card__price-slot--recommend">
                {item.price ? <PriceSuperscript price={item.price} /> : null}
                {item.unitPrice ? <span className="cai-product-card__unit-price">{item.unitPrice}</span> : null}
              </div>
            </div>
            {typeof item.rating === "number" ? (
              <div className="cai-product-card__commercial-rating cai-product-card__commercial-rating--recommend" aria-label="Average rating">
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

        <div className="cai-product-card__actions cai-product-card__actions--recommend">
          <button type="button" className="cai-product-card__btn-icon-cart" disabled aria-label="Add to cart">
            <img
              className="cai-product-card__cart-icon-img"
              src={addToCartIconButton}
              alt=""
              width={40}
              height={40}
              decoding="async"
            />
          </button>
          {url ? (
            <a className="cai-product-card__btn cai-product-card__btn--buy-recommend" href={url} target="_blank" rel="noopener noreferrer">
              Buy it now
            </a>
          ) : (
            <button type="button" className="cai-product-card__btn cai-product-card__btn--buy-recommend" disabled>
              Buy it now
            </button>
          )}
        </div>

        <p className="cai-product-card__fulfillment-v2">
          <span className="cai-product-card__fulfillment-strong">Free</span> 1-3 day delivery on this item
          <br />
          <span className="cai-product-card__fulfillment-strong">Free</span> 365-day returns
        </p>
      </div>
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
        <ProductCardRecommendation item={item} variant="stacked" />
      </div>
    );
  }

  return (
    <div className="cai-product-showcase">
      {headingEl}
      <div className="cai-product-carousel" role="region" aria-label="Product options">
        {block.items.map((item, i) => (
          <ProductCardRecommendation key={`${item.title}-${i}`} item={item} variant="carousel" />
        ))}
      </div>
    </div>
  );
}
