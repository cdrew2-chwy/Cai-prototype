/**
 * Prototype: fetch a Chewy PDP in Node and read og:title + og:image so order cards can show
 * a real product name and image when the gather “product” field is a PDP link.
 * Production should use a catalog/BFF, not raw HTML scrape.
 *
 * Chewy often returns **429** / bot challenges for datacenter or script-like requests. Optional
 * `CHEWY_PDP_COOKIE` (browser Cookie header value while logged in or after passing a challenge)
 * can unblock scraping in local dev — see `.env.example`.
 *
 * When **multiple** order rows use Chewy PDP URLs, enrichment runs **one PDP fetch at a time**
 * (not `Promise.all`) with an optional pause between requests (`CHEWY_PDP_STAGGER_MS`, default 600).
 */

import { applyStaticPdpFallbacks } from "./chewyStaticCatalog.js";

const FETCH_TIMEOUT_MS = 15_000;
/** When several orders include PDP URLs, pause between server-side fetches to reduce 429 / bot signals vs. parallel bursts. */
const PDP_STAGGER_BETWEEN_MS = Math.max(
  0,
  Number.parseInt(String(process.env.CHEWY_PDP_STAGGER_MS ?? "600"), 10) || 0
);
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SEC_CH_UA = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';

const CACHE = new Map();
const MAX_CACHE = 50;

const CHEWY_HOST = new Set(["chewy.com", "www.chewy.com"]);

/**
 * @returns {string | undefined}
 */
function chewyCookieHeader() {
  const c = (process.env.CHEWY_PDP_COOKIE || process.env.CHEWY_SESSION_COOKIE || "").trim();
  return c || undefined;
}

/**
 * Browser-like headers reduce empty / 429 responses from Chewy’s edge.
 * @returns {Record<string, string>}
 */
function chewyPdpRequestHeaders() {
  const h = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent": UA,
    "Sec-Ch-Ua": SEC_CH_UA,
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    Referer: "https://www.chewy.com/",
  };
  const cookie = chewyCookieHeader();
  if (cookie) h.Cookie = cookie;
  return h;
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
function isSafeChewyHttpsUrl(raw) {
  if (typeof raw !== "string") return false;
  const t = raw.trim();
  if (!t.startsWith("https://")) return false;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return false;
    return CHEWY_HOST.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * @param {string} s
 * @returns {boolean}
 */
function needsPdpScrape(s) {
  if (typeof s !== "string") return false;
  return isSafeChewyHttpsUrl(s.trim());
}

/**
 * @param {string} html
 * @param {string} property
 * @returns {string | null}
 */
function parseMetaByProperty(html, property) {
  const esc = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const p1 = new RegExp(
    `<meta\\s+[^>]*property=["']${esc}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const p2 = new RegExp(
    `<meta\\s+[^>]*content=["']([^"']*)["'][^>]*property=["']${esc}["']`,
    "i"
  );
  let m = html.match(p1);
  if (m?.[1]) return decodeBasicEntities(m[1].trim());
  m = html.match(p2);
  if (m?.[1]) return decodeBasicEntities(m[1].trim());
  return null;
}

/**
 * @param {string} html
 * @param {string} name
 * @returns {string | null}
 */
function parseMetaByName(html, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const p1 = new RegExp(
    `<meta\\s+[^>]*name=["']${esc}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const p2 = new RegExp(
    `<meta\\s+[^>]*content=["']([^"']*)["'][^>]*name=["']${esc}["']`,
    "i"
  );
  let m = html.match(p1);
  if (m?.[1]) return decodeBasicEntities(m[1].trim());
  m = html.match(p2);
  if (m?.[1]) return decodeBasicEntities(m[1].trim());
  return null;
}

/**
 * @param {string} t
 * @returns {string}
 */
function decodeBasicEntities(t) {
  return t
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * @param {string} html
 * @returns {string | null}
 */
function parseTitleTag(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!m?.[1]) return null;
  let t = decodeBasicEntities(m[1].replace(/\s+/g, " ").trim());
  t = t.replace(/\s*\|\s*Chewy\.?com?\s*$/i, "").replace(/\s*\|\s*Chewy\s*$/i, "").trim();
  return t || null;
}

/**
 * Pull image URLs from JSON-LD (Product / @graph, etc.).
 * @param {string} html
 * @returns {string[]}
 */
function collectImagesFromJsonLd(html) {
  const out = [];
  const seen = new Set();
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let block;
  while ((block = re.exec(html)) !== null) {
    const inner = block[1]?.trim();
    if (!inner) continue;
    try {
      const data = JSON.parse(inner);
      walkJsonLdForChewyImages(data, out, seen);
    } catch {
      /* ignore */
    }
  }
  return out;
}

const CHEWY_IMAGE_URL_RE = /^https?:\/\/[^"'\s]+\.(jpe?g|png|webp)(\?[^"'\s]*)?$/i;

/**
 * @param {unknown} node
 * @param {string[]} acc
 * @param {Set<string>} seen
 */
function walkJsonLdForChewyImages(node, acc, seen) {
  if (!node) return;
  if (typeof node === "string") {
    const t = node.trim();
    if (!t.includes("chewy") || !/^https?:\/\//i.test(t)) return;
    if (CHEWY_IMAGE_URL_RE.test(t) || /image\.chewy|img\.chewy|\/is\/image\//i.test(t)) {
      if (!seen.has(t)) {
        seen.add(t);
        acc.push(t);
      }
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const x of node) walkJsonLdForChewyImages(x, acc, seen);
    return;
  }
  if (typeof node !== "object") return;
  for (const k of Object.keys(/** @type {Record<string, unknown>} */ (node))) {
    walkJsonLdForChewyImages(/** @type {Record<string, unknown>} */ (node)[k], acc, seen);
  }
}

/**
 * @param {string} relOrAbs
 * @param {string} base
 * @returns {string}
 */
function absolutizeImage(relOrAbs, base) {
  let t = (relOrAbs || "").trim();
  if (!t) return t;
  if (t.startsWith("//")) t = `https:${t}`;
  try {
    if (t.startsWith("https://") || t.startsWith("http://")) {
      if (t.includes("chewy.com")) return t;
      if (t.startsWith("https://www.chewy.com/") || t.startsWith("https://chewy.com/")) return t;
    }
    return new URL(t, base).toString();
  } catch {
    return t;
  }
}

/**
 * @param {string} url
 * @param {boolean} isRetry
 * @returns {Promise<string | null>}
 */
async function fetchChewyPdpHtml(url, isRetry) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ac.signal,
      headers: chewyPdpRequestHeaders(),
      redirect: "follow",
    });
    if ((res.status === 429 || res.status === 403) && !isRetry) {
      await new Promise((r) => setTimeout(r, 1600));
      return fetchChewyPdpHtml(url, true);
    }
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} url
 * @returns {Promise<{ title: string, imageUrl: string } | null>}
 */
export async function scrapeChewyPdpPage(url) {
  const cacheKey = url.trim();
  const hit = CACHE.get(cacheKey);
  if (hit) return hit;

  const html = await fetchChewyPdpHtml(url, false);
  if (!html) return null;

  let title = parseMetaByProperty(html, "og:title");
  if (!title) title = parseMetaByName(html, "twitter:title");
  if (!title) title = parseTitleTag(html);

  let imageUrl =
    parseMetaByProperty(html, "og:image:secure_url") ||
    parseMetaByProperty(html, "og:image") ||
    parseMetaByName(html, "twitter:image");

  if (!imageUrl) {
    const fromLd = collectImagesFromJsonLd(html);
    imageUrl = fromLd.find((u) => /\.(jpe?g|png|webp)(\?|$)/i.test(u) || u.includes("image.chewy")) || fromLd[0] || null;
  }

  if (imageUrl) {
    const abs = absolutizeImage(imageUrl, url);
    if (abs.startsWith("https://") || (abs.startsWith("http://") && abs.includes("chewy.com"))) {
      imageUrl = abs;
    } else {
      try {
        const u2 = new URL(imageUrl, url);
        imageUrl = u2.protocol === "http:" || u2.protocol === "https:" ? u2.href : abs;
      } catch {
        imageUrl = null;
      }
    }
  }

  if (title) {
    title = title
      .replace(/\s*[-–—]\s*Chewy\.com\s*$/i, "")
      .replace(/\s*\|\s*Chewy\.com\s*$/i, "")
      .trim();
  }
  const out = {
    title: (title && title.trim()) || null,
    imageUrl: (imageUrl && String(imageUrl).trim()) || null,
  };
  if (!out.title && !out.imageUrl) {
    return null;
  }
  if (CACHE.size > MAX_CACHE) {
    const first = CACHE.keys().next().value;
    CACHE.delete(first);
  }
  CACHE.set(cacheKey, out);
  return out;
}

/**
 * @param {unknown} orderHistory
 * @returns {Promise<unknown[]>}
 */
export async function enrichOrderHistoryWithPdpData(orderHistory) {
  if (!Array.isArray(orderHistory) || orderHistory.length === 0) {
    return Array.isArray(orderHistory) ? orderHistory : [];
  }
  const rows = orderHistory
    .map((o) => (o && typeof o === "object" ? { ...o } : o))
    .filter((o) => o && typeof o === "object");
  if (rows.length === 0) return orderHistory;

  const summariesBefore = rows.map((row) => {
    const o = /** @type {Record<string, unknown>} */ (row);
    return typeof o.summary === "string" ? o.summary : "";
  });

  const pdpIndices = [];
  for (let i = 0; i < rows.length; i += 1) {
    const o = /** @type {Record<string, unknown>} */ (rows[i]);
    const summary = typeof o.summary === "string" ? o.summary : "";
    if (needsPdpScrape(summary) && isSafeChewyHttpsUrl(summary.trim())) {
      pdpIndices.push(i);
    }
  }

  const results = new Array(rows.length).fill(null);
  for (let j = 0; j < pdpIndices.length; j += 1) {
    const i = pdpIndices[j];
    const o = /** @type {Record<string, unknown>} */ (rows[i]);
    const summary = typeof o.summary === "string" ? o.summary : "";
    const url = summary.trim();
    if (pdpIndices.length > 1 && j > 0 && PDP_STAGGER_BETWEEN_MS > 0) {
      await new Promise((r) => setTimeout(r, PDP_STAGGER_BETWEEN_MS));
    }
    results[i] = await scrapeChewyPdpPage(url);
  }

  let missed = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const enriched = results[i];
    const before = summariesBefore[i] ?? "";
    const o = /** @type {Record<string, unknown>} */ (rows[i]);
    if (!enriched) {
      missed += 1;
      continue;
    }
    if (enriched.title) o.summary = enriched.title;
    if (enriched.imageUrl) o.imageUrl = enriched.imageUrl;
    if (enriched.title && !enriched.imageUrl && before && needsPdpScrape(before)) {
      o.productPageUrl = before.trim();
    }
  }
  if (missed > 0 && process.env.NODE_ENV !== "production") {
    const hint = chewyCookieHeader()
      ? ""
      : " Set CHEWY_PDP_COOKIE in .env with a browser Cookie header if Chewy returns 429.";
    console.warn(`[chewyPdpEnrich] ${missed} PDP scrape(s) returned no title/image (often HTTP 429).${hint}`);
  }
  return applyStaticPdpFallbacks(rows, summariesBefore);
}
