/**
 * JSON API base URL. In dev, call the Express server directly so a broken Vite proxy
 * cannot silently return index.html (which causes "Unexpected token '<'" on res.json()).
 * Override with VITE_API_ORIGIN in .env (e.g. http://127.0.0.1:3001).
 */
const devBase =
  (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, "") || "http://127.0.0.1:3001";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (import.meta.env.DEV) {
    return `${devBase}${p}`;
  }
  return p;
}

/**
 * Image and other GET `/api/...` assets. In dev, use same-origin `/api` so Vite proxies to Express
 * (avoids localhost vs 127.0.0.1 and some embedded-preview quirks for `<img src>`).
 * If `VITE_API_ORIGIN` is set, use that origin for consistency with a custom API host.
 */
export function apiUrlForImages(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (import.meta.env.DEV) {
    const origin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim();
    if (origin) {
      return `${origin.replace(/\/$/, "")}${p}`;
    }
    return p;
  }
  return p;
}

/** Parse JSON response; if the server returned HTML, throw a helpful error. */
export async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<")) {
    throw new Error(
      "The app received HTML instead of JSON from the API. Usually the API is not running on port 3001, or only the web dev server was started. From the project folder run: npm run dev (starts both Vite and the API).",
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 200) || "Invalid JSON from API");
  }
}
