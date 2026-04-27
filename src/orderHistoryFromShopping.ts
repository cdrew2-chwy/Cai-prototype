/**
 * Prototype: structured order rows are embedded in the **Order history** bundle (gather form, optional Autoship per order).
 * The BFF is simulated by a `### Structured order history (prototype)` block; the app never invents rows.
 */

export type PrototypeOrderRow = {
  id: string;
  orderNumber: string;
  summary: string;
  meta?: string;
  status?: string;
  /** ISO date (server applies last-6-months rule). */
  placedAt: string;
  imageUrl?: string;
  /** When true, this order is on Autoship (from gather; copied into `meta` for the model). */
  autoship?: boolean;
};

/** Shown in gather; only this block (or a whole-JSON array) is parsed for `/api/chat` `orderHistory`. */
export const STRUCTURED_ORDER_HISTORY_MARKER = "### Structured order history (prototype)";

function tryParseOrderArray(data: unknown): PrototypeOrderRow[] {
  if (!Array.isArray(data)) return [];
  const out: PrototypeOrderRow[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const orderNumber = typeof o.orderNumber === "string" ? o.orderNumber.trim() : "";
    const summary = typeof o.summary === "string" ? o.summary.trim() : "";
    const placedAt = typeof o.placedAt === "string" ? o.placedAt.trim() : "";
    if (!orderNumber || !summary || !placedAt) continue;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : orderNumber;
    const meta = typeof o.meta === "string" && o.meta.trim() ? o.meta.trim() : undefined;
    const status = typeof o.status === "string" && o.status.trim() ? o.status.trim() : undefined;
    const imageUrl = typeof o.imageUrl === "string" && o.imageUrl.trim() ? o.imageUrl.trim() : undefined;
    const base: PrototypeOrderRow = { id, orderNumber, summary, meta, status, placedAt, imageUrl };
    if (o.autoship === true) base.autoship = true;
    out.push(base);
  }
  return out;
}

/**
 * If `s[startIdx]` is `[`, returns the index of the `]` that closes that array, respecting JSON strings and escapes.
 */
function findArraySpanEnd(s: string, startIdx: number): number {
  if (s[startIdx] !== "[") return -1;
  let depth = 0;
  let inString = false;
  for (let i = startIdx; i < s.length; i += 1) {
    const c = s[i]!;
    if (inString) {
      if (c === "\\") {
        i += 1; // next char is escaped; skip
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Strips the structured order block (marker + following JSON array) for the model context bundle.
 * Free-text above the block (in **Order history**) is kept in model context (after strip).
 */
export function stripStructuredOrderBlockFromShoppingText(text: string): string {
  const raw = text ?? "";
  const m = raw.indexOf(STRUCTURED_ORDER_HISTORY_MARKER);
  if (m < 0) return raw;
  return raw.slice(0, m).replace(/\n+$/, "");
}

/**
 * Parses `orderHistory` for `/api/chat` from the same field. Does not guess or complete rows.
 */
export function parseOrderHistoryFromShoppingText(text: string): PrototypeOrderRow[] {
  const raw = text ?? "";
  const markerAt = raw.indexOf(STRUCTURED_ORDER_HISTORY_MARKER);
  if (markerAt >= 0) {
    const after = raw.slice(markerAt + STRUCTURED_ORDER_HISTORY_MARKER.length);
    const b = after.indexOf("[");
    if (b < 0) return [];
    const end = findArraySpanEnd(after, b);
    if (end < 0) return [];
    const slice = after.slice(b, end + 1);
    try {
      return tryParseOrderArray(JSON.parse(slice) as unknown);
    } catch {
      return [];
    }
  }

  const t = raw.trim();
  if (t.startsWith("[")) {
    const end = findArraySpanEnd(t, 0);
    if (end < 0) return [];
    const slice = t.slice(0, end + 1);
    try {
      return tryParseOrderArray(JSON.parse(slice) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

/** For preset personas: append a parseable block after free-text story (prototype BFF). */
export function formatStructuredOrderHistoryAppend(rows: PrototypeOrderRow[]): string {
  if (rows.length === 0) return "";
  return `\n\n${STRUCTURED_ORDER_HISTORY_MARKER}\n\n${JSON.stringify(rows, null, 2)}`;
}
