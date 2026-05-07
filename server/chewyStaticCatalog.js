/**
 * After live PDP scrape: apply Chewy product catalog (CSV) for title + list price, and local
 * `/public/order-fallbacks/dp-*.png` when remote `imageUrl` is missing.
 */

import { getCatalogEntry } from "./productCatalog.js";

/** Bundled thumbnails when catalog scrape returns no image (HTTP 429). Keys match `public/order-fallbacks/`. */
/** @type {Record<string, string>} */
export const PDP_IMAGE_FALLBACK_BY_DP_ID = {
  "3730174": "/order-fallbacks/dp-3730174.png",
  "168308": "/order-fallbacks/dp-168308.png",
  "851790": "/order-fallbacks/dp-851790.png",
  "2277670": "/order-fallbacks/dp-2277670.png",
  "46729": "/order-fallbacks/dp-46729.png",
  "183796": "/order-fallbacks/dp-183796.png",
  "348131": "/order-fallbacks/dp-348131.png",
  /** Bug persona treat row — no dedicated asset yet; reuse Purina-adjacent thumb for prototype */
  "986838": "/order-fallbacks/dp-3730174.png",
};

/** If CSV has no row, fall back to these titles only when summary is still a PDP URL. */
/** @type {Record<string, string>} */
export const TITLE_FALLBACK_BY_DP_ID = {
  "986838": "Meow Mix Irresistibles Soft Cat Treats With White Meat Chicken & Turkey, 3-oz bag",
  "2277670": "Potaroma Crinkle Fish Cat Toys With Catnip, Multi-Color, 7.8-in, 3 count",
};

/**
 * @param {string | undefined} text
 * @returns {string | null}
 */
export function extractChewyDpId(text) {
  const m = (text ?? "").trim().match(/\/dp\/(\d+)/);
  return m?.[1] ?? null;
}

/**
 * @param {string | undefined} summary
 * @returns {boolean}
 */
function summaryStillLooksLikeChewyPdpUrl(summary) {
  const s = (summary ?? "").trim();
  return s.startsWith("https://www.chewy.com") && s.includes("/dp/");
}

/**
 * @param {unknown[]} rows
 * @param {string[]} [summariesBefore] — summary strings before PDP scrape (often still URLs).
 * @returns {unknown[]}
 */
export function applyStaticPdpFallbacks(rows, summariesBefore) {
  if (!Array.isArray(rows)) return rows;
  const beforeList = Array.isArray(summariesBefore) ? summariesBefore : [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== "object") continue;
    const o = /** @type {Record<string, unknown>} */ (row);
    const summary = typeof o.summary === "string" ? o.summary : "";
    const productPageUrl = typeof o.productPageUrl === "string" ? o.productPageUrl : "";
    const before = typeof beforeList[i] === "string" ? beforeList[i] : "";
    const id =
      extractChewyDpId(productPageUrl) || extractChewyDpId(summary) || extractChewyDpId(before);
    if (!id) continue;

    const cat = getCatalogEntry(id);
    if (cat?.name) {
      o.summary = cat.name;
      if (cat.price != null) o.listPrice = cat.price;
    } else if (summaryStillLooksLikeChewyPdpUrl(summary)) {
      const fbTitle = TITLE_FALLBACK_BY_DP_ID[id];
      if (fbTitle) o.summary = fbTitle;
    }

    if (!o.imageUrl) {
      const img = PDP_IMAGE_FALLBACK_BY_DP_ID[id];
      if (img) o.imageUrl = img;
    }
  }
  return rows;
}
