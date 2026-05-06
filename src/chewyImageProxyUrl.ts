import { apiUrlForImages } from "./api";

/** Match server `isChewyProductImageProxyTarget` in `server/chewyImageProxy.js`. */
export function shouldProxyChewyProductImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
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
 * Use API proxy for Chewy / Scene7 image URLs so `<img src>` is same-origin or dev API host
 * and avoids CDN hotlink blocks in the browser.
 */
export function proxiedChewyProductImageUrl(url: string | undefined | null): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes("/api/chewy-product-image")) return trimmed;
  if (!shouldProxyChewyProductImageUrl(trimmed)) return trimmed;
  return `${apiUrlForImages("/api/chewy-product-image")}?url=${encodeURIComponent(trimmed)}`;
}
