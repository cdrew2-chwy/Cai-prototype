/**
 * Chewy product catalog (CSV from Merch / catalog export). Keys by PRODUCT_ID, which matches
 * PDP paths `.../dp/{PRODUCT_ID}`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {Map<string, { name: string, price: number | undefined, partNumber: string | undefined }> | null} */
let catalogByProductId = null;
/** @type {boolean} */
let catalogTried = false;

/**
 * @returns {string}
 */
function resolveCatalogPath() {
  const env = (process.env.CHEWY_PRODUCT_CATALOG_PATH || "").trim();
  if (env) return path.resolve(env);
  return path.join(__dirname, "..", "data", "product-catalog.csv");
}

function loadCatalog() {
  if (catalogTried) return;
  catalogTried = true;
  const csvPath = resolveCatalogPath();
  if (!fs.existsSync(csvPath)) {
    console.warn(
      `[productCatalog] No file at ${csvPath}. Set CHEWY_PRODUCT_CATALOG_PATH or add data/product-catalog.csv (e.g. copy "Product Catalog - Active.csv").`
    );
    catalogByProductId = new Map();
    return;
  }
  const t0 = Date.now();
  const raw = fs.readFileSync(csvPath, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });
  const m = new Map();
  for (const row of rows) {
    const id = row.PRODUCT_ID != null ? String(row.PRODUCT_ID).trim() : "";
    const name = row.PRODUCT_NAME != null ? String(row.PRODUCT_NAME).trim() : "";
    if (!id || !name) continue;
    const pr = row.PRODUCT_PRICE;
    const n = pr === "" || pr == null ? NaN : Number(pr);
    const part = row.PRODUCT_PART_NUMBER != null ? String(row.PRODUCT_PART_NUMBER).trim() : undefined;
    m.set(id, {
      name,
      price: Number.isFinite(n) ? n : undefined,
      partNumber: part || undefined,
    });
  }
  catalogByProductId = m;
  if (process.env.NODE_ENV !== "production") {
    console.info(`[productCatalog] Loaded ${m.size} rows from ${path.basename(csvPath)} in ${Date.now() - t0}ms`);
  }
}

/**
 * @param {string | undefined} productId
 * @returns {({ name: string, price: number | undefined, partNumber: string | undefined }) | null}
 */
export function getCatalogEntry(productId) {
  loadCatalog();
  if (!productId || !catalogByProductId) return null;
  return catalogByProductId.get(String(productId).trim()) ?? null;
}
