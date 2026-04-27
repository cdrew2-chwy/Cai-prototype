/**
 * Prototype: fetch a Chewy PDP in Node and read og:title + og:image so order cards can show
 * a real product name and image when the gather “product” field is a PDP link.
 * Production should use a catalog/BFF, not raw HTML scrape.
 */

const FETCH_TIMEOUT_MS = 12_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const CACHE = new Map();
const MAX_CACHE = 50;

const CHEWY_HOST = new Set(["chewy.com", "www.chewy.com"]);

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
 * @param {string} relOrAbs
 * @param {string} base
 * @returns {string}
 */
function absolutizeImage(relOrAbs, base) {
  const t = (relOrAbs || "").trim();
  if (!t) return t;
  try {
    if (t.startsWith("https://") || t.startsWith("http://")) {
      if (t.startsWith("https://www.chewy.com/") || t.startsWith("https://chewy.com/")) {
        return t;
      }
      if (t.startsWith("https://") && t.includes("chewy.com")) return t;
    }
    return new URL(t, base).toString();
  } catch {
    return t;
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

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  let html;
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ac.signal,
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return null;
    html = await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }

  let title = parseMetaByProperty(html, "og:title");
  if (!title) title = parseMetaByName(html, "twitter:title");
  if (!title) title = parseTitleTag(html);

  let imageUrl =
    parseMetaByProperty(html, "og:image:secure_url") ||
    parseMetaByProperty(html, "og:image") ||
    parseMetaByName(html, "twitter:image");
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

  const fetches = rows.map((row) => {
    const o = /** @type {Record<string, unknown>} */ (row);
    const summary = typeof o.summary === "string" ? o.summary : "";
    if (!needsPdpScrape(summary) || !isSafeChewyHttpsUrl(summary.trim())) {
      return Promise.resolve(null);
    }
    return scrapeChewyPdpPage(summary.trim());
  });

  const results = await Promise.all(fetches);
  for (let i = 0; i < rows.length; i += 1) {
    const enriched = results[i];
    if (!enriched) continue;
    const o = /** @type {Record<string, unknown>} */ (rows[i]);
    if (enriched.title) o.summary = enriched.title;
    if (enriched.imageUrl) o.imageUrl = enriched.imageUrl;
  }
  return rows;
}
