/**
 * Proxy Chewy product images through this API so the browser does not hit Chewy CDNs directly
 * (they often 403 hotlinked requests from localhost / non-Chewy referrers).
 * Optional CHEWY_PDP_COOKIE / CHEWY_SESSION_COOKIE is sent on upstream fetches when set.
 */

const FETCH_TIMEOUT_MS = 12_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * @returns {string | undefined}
 */
function chewyCookieHeader() {
  const c = (process.env.CHEWY_PDP_COOKIE || process.env.CHEWY_SESSION_COOKIE || "").trim();
  return c || undefined;
}

/**
 * @returns {Record<string, string>}
 */
function chewyImageProxyHeaders() {
  const h = {
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": UA,
    Referer: "https://www.chewy.com/",
    Origin: "https://www.chewy.com",
  };
  const cookie = chewyCookieHeader();
  if (cookie) h.Cookie = cookie;
  return h;
}

/**
 * @param {string} urlString
 * @returns {boolean}
 */
export function isChewyProductImageProxyTarget(urlString) {
  try {
    const u = new URL(urlString);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    const pathq = `${u.pathname}${u.search}`.toLowerCase();
    if (host === "chewy.com" || host.endsWith(".chewy.com")) return true;
    if (host.includes("scene7")) return true;
    if (host.endsWith(".imgix.net") || host === "imgix.net") return true;
    if (host.endsWith(".akamaihd.net") || host.endsWith(".akamaized.net")) return true;
    if (
      (host.endsWith(".cloudfront.net") || host.endsWith(".amazonaws.com")) &&
      (pathq.includes("chewy") || pathq.includes("/is/image/") || pathq.includes("scene7"))
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * @param {string} href
 * @param {AbortSignal} signal
 */
async function fetchChewyProductImageOnce(href, signal) {
  return fetch(href, {
    method: "GET",
    redirect: "follow",
    signal,
    headers: chewyImageProxyHeaders(),
  });
}

/**
 * GET /api/chewy-product-image?url=https%3A%2F%2F...
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function handleChewyProductImageRequest(req, res) {
  const raw = req.query.url;
  if (typeof raw !== "string" || !raw.trim()) {
    res.status(400).type("text/plain").send("Missing url query parameter");
    return;
  }
  let target;
  try {
    target = new URL(raw.trim());
  } catch {
    res.status(400).type("text/plain").send("Invalid url");
    return;
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    res.status(400).type("text/plain").send("Only http(s) URLs are allowed");
    return;
  }
  if (!isChewyProductImageProxyTarget(target.href)) {
    res.status(403).type("text/plain").send("URL host not allowed");
    return;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    let upstream = await fetchChewyProductImageOnce(target.href, ac.signal);
    if (upstream.status === 403 || upstream.status === 429) {
      await new Promise((r) => setTimeout(r, 900 + Math.floor(Math.random() * 400)));
      upstream = await fetchChewyProductImageOnce(target.href, ac.signal);
    }
    if (!upstream.ok) {
      res.status(502).type("text/plain").send(`Upstream HTTP ${upstream.status}`);
      return;
    }
    const ctRaw = upstream.headers.get("content-type") || "";
    if (/text\/html/i.test(ctRaw)) {
      res.status(502).type("text/plain").send("Upstream returned HTML, not an image");
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) {
      res.status(502).type("text/plain").send("Image too large");
      return;
    }
    const ct = ctRaw.split(";")[0].trim() || "application/octet-stream";
    res.set("Content-Type", ct);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buf);
  } catch {
    res.status(502).type("text/plain").send("Image fetch failed");
  } finally {
    clearTimeout(timer);
  }
}
