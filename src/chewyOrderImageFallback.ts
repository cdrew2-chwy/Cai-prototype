import type { CaiOrderItem } from "./chatUtils";
import { proxiedChewyProductImageUrl } from "./chewyImageProxyUrl";

/**
 * When Chewy PDP scraping does not set `imageUrl` (e.g. HTTP 429), show a saved thumbnail from
 * `/public/order-fallbacks/` keyed by PDP product id (`/dp/{id}`).
 */
const ORDER_THUMB_FALLBACK_BY_DP_ID: Record<string, string> = {
  "3730174": "dp-3730174.png",
  "168308": "dp-168308.png",
  "183796": "dp-183796.png",
  "348131": "dp-348131.png",
  "46729": "dp-46729.png",
  "851790": "dp-851790.png",
  "2277670": "dp-2277670.png",
  /** Bug persona — Meow Mix treats (no dp-986838 asset; reuse cat-food thumb) */
  "986838": "dp-3730174.png",
};

function publicOrderFallbackUrl(file: string): string {
  const base = import.meta.env.BASE_URL;
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}order-fallbacks/${file}`;
}

function dpIdFromOrder(o: CaiOrderItem): string | undefined {
  const candidates = [o.productPageUrl, o.summary];
  for (const s of candidates) {
    const t = s?.trim();
    if (!t) continue;
    const m = t.match(/\/dp\/(\d+)/);
    if (m?.[1]) return m[1];
  }
  return undefined;
}

/** Local `/order-fallbacks/dp-*.png` when we have a mapped PDP id (used after remote load errors). */
export function orderCardLocalFallbackSrc(o: CaiOrderItem): string | undefined {
  const id = dpIdFromOrder(o);
  if (!id) return undefined;
  const file = ORDER_THUMB_FALLBACK_BY_DP_ID[id];
  return file ? publicOrderFallbackUrl(file) : undefined;
}

/**
 * Remote catalog image when enrichment succeeds; otherwise a known local fallback for that PDP id.
 */
export function orderCardThumbSrc(o: CaiOrderItem): string | undefined {
  const remote = o.imageUrl?.trim();
  if (remote) return proxiedChewyProductImageUrl(remote) ?? remote;
  return orderCardLocalFallbackSrc(o);
}
