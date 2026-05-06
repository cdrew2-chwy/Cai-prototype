import { formatStructuredOrderHistoryAppend, type PrototypeOrderRow } from "./orderHistoryFromShopping";

export const GATHER_ORDER_STATUS_OPTIONS = [
  "Processing",
  "In-transit",
  "Delayed",
  "Delivered",
  "Cancelled",
] as const;

/** Statuses that show the optional expected-delivery field (free-text date hint on cards). */
export const GATHER_ORDER_EXPECTED_DELIVERY_STATUSES: readonly (typeof GATHER_ORDER_STATUS_OPTIONS)[number][] = [
  "Processing",
  "In-transit",
  "Delayed",
];

const EXPECTED_DELIVERY_STATUS_SET = new Set<string>(GATHER_ORDER_EXPECTED_DELIVERY_STATUSES);

export function orderStatusShowsDeliveredDateField(status: string): boolean {
  return (status ?? "").trim() === "Delivered";
}

export function orderStatusShowsExpectedDeliveryField(status: string): boolean {
  return EXPECTED_DELIVERY_STATUS_SET.has((status ?? "").trim());
}

const LEGACY_TO_GATHER: Record<string, (typeof GATHER_ORDER_STATUS_OPTIONS)[number]> = {
  processing: "Processing",
  "in transit": "In-transit",
  "in-transit": "In-transit",
  in_transit: "In-transit",
  delayed: "Delayed",
  delivered: "Delivered",
  cancelled: "Cancelled",
  canceled: "Cancelled",
};

const OPTION_SET = new Set<string>(GATHER_ORDER_STATUS_OPTIONS);

/**
 * New gather form: up to 5 rows; `id` is stable for React keys when adding/removing.
 */
export type GatherOrderField = {
  id: string;
  /** Product title or a Chewy PDP URL. */
  productOrLink: string;
  /** `YYYY-MM-DD` from a date input, or empty. */
  placedDate: string;
  /** Optional delivery date for delivered orders (“Arrived …” on cards). */
  deliveredDate: string;
  status: string;
  expectedDelivery: string;
  /** This line item is an Autoship order. */
  autoship: boolean;
};

export function createEmptyGatherOrderField(): GatherOrderField {
  return {
    id: crypto.randomUUID(),
    productOrLink: "",
    placedDate: "",
    deliveredDate: "",
    status: "Processing",
    expectedDelivery: "",
    autoship: false,
  };
}

export function mapLegacyStatusToGather(legacy: string | undefined): string {
  const t = (legacy ?? "").trim();
  if (OPTION_SET.has(t)) return t;
  const byLower = LEGACY_TO_GATHER[t.toLowerCase()] ?? undefined;
  if (byLower) return byLower;
  return "Processing";
}

function isoInstantOrDateToDateInputValue(iso: string): string {
  const t = (iso ?? "").trim();
  if (!t) return "";
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[Tt ].*)?/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (y >= 1900 && y <= 2200 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${m[1]}-${m[2]}-${m[3]}`;
    }
  }
  const dt = new Date(t);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function buildOrderRowMeta(
  opts: { autoship: boolean; expectedDelivery: string }
): string | undefined {
  const exp = (opts.expectedDelivery ?? "").trim();
  const parts: string[] = [];
  if (opts.autoship) parts.push("On Autoship");
  if (exp) parts.push(`Expected delivery: ${exp}`);
  if (parts.length === 0) return undefined;
  return parts.join(" — ");
}

function extractExpectedFromMeta(meta: string | undefined): string {
  const m = (meta ?? "").trim();
  if (!m) return "";
  const match = m.match(/expected delivery:\s*(.+)/i);
  if (!match?.[1]) return "";
  return (match[1]!.split(/\s*—\s*/)[0] ?? "").trim();
}

function autoshipFromOrderMeta(meta: string | undefined, fromRow: boolean | undefined): boolean {
  if (fromRow === true) return true;
  return /\bon\s+autoship\b/i.test((meta ?? "").trim());
}

export function prototypeRowsToFormEntries(rows: PrototypeOrderRow[], max: number = 5): GatherOrderField[] {
  const slice = rows.filter(Boolean).slice(0, max);
  if (slice.length === 0) return [createEmptyGatherOrderField()];
  return slice.map((r) => {
    const explicitStatus = (r.status ?? "").trim();
    const hasDeliveredAt = Boolean((r.deliveredAt ?? "").trim());
    const status =
      !explicitStatus && hasDeliveredAt ? "Delivered" : mapLegacyStatusToGather(r.status);
    return {
      id: crypto.randomUUID(),
      productOrLink: (r.summary ?? "").trim(),
      placedDate: isoInstantOrDateToDateInputValue(r.placedAt),
      deliveredDate: isoInstantOrDateToDateInputValue(r.deliveredAt ?? ""),
      status,
      expectedDelivery: extractExpectedFromMeta(r.meta),
      autoship: autoshipFromOrderMeta(r.meta, r.autoship),
    };
  });
}

function dateInputToPlacedAtIso(placedDate: string): string {
  const t = (placedDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return "";
  const n = Date.parse(`${t}T12:00:00`);
  if (Number.isNaN(n)) return "";
  return new Date(n).toISOString();
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * True when at least one gather row has both a product/URL and a placed date within the last `n` days
 * (rolling window from “now” in the browser).
 */
export function hasOrderPlacedInLastNDays(entries: GatherOrderField[], nDays: number): boolean {
  if (!Number.isFinite(nDays) || nDays <= 0) return false;
  const windowMs = nDays * MS_PER_DAY;
  const cutoff = Date.now() - windowMs;
  for (const e of entries) {
    const d = (e.placedDate ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (!(e.productOrLink ?? "").trim()) continue;
    const placedMs = Date.parse(`${d}T12:00:00`);
    if (Number.isNaN(placedMs)) continue;
    if (placedMs >= cutoff) return true;
  }
  return false;
}

/** Ten-digit Chewy-style order id, unique within `used` (e.g. one gather submission). */
function nextUniqueTenDigitOrderNumber(used: Set<string>): string {
  for (let attempt = 0; attempt < 400; attempt++) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const digits = String(1_000_000_000 + (buf[0]! % 9_000_000_000));
    if (!used.has(digits)) {
      used.add(digits);
      return `#${digits}`;
    }
  }
  for (let n = 1_000_000_000; n < 10_000_000_000; n++) {
    const digits = String(n);
    if (!used.has(digits)) {
      used.add(digits);
      return `#${digits}`;
    }
  }
  throw new Error("Unable to allocate a unique 10-digit prototype order number");
}

/**
 * Rows the prototype server treats as BFF data for ```cai-orders```. Skips rows missing product or
 * placed date (both required for a card).
 */
export function formEntriesToPrototypeRows(entries: GatherOrderField[]): PrototypeOrderRow[] {
  const out: PrototypeOrderRow[] = [];
  const usedOrderDigits = new Set<string>();
  for (const e of entries) {
    const summary = (e.productOrLink ?? "").trim();
    const placedAt = dateInputToPlacedAtIso(e.placedDate);
    const deliveredAtIso = dateInputToPlacedAtIso((e.deliveredDate ?? "").trim());
    if (!summary || !placedAt) continue;
    const orderNumber = nextUniqueTenDigitOrderNumber(usedOrderDigits);
    const row: PrototypeOrderRow = {
      id: `gather-row-${e.id}`,
      orderNumber,
      summary,
      status: (e.status ?? "Processing").trim() || "Processing",
      placedAt,
      meta: buildOrderRowMeta({ autoship: e.autoship, expectedDelivery: (e.expectedDelivery ?? "").trim() }),
    };
    if (e.autoship) row.autoship = true;
    if (deliveredAtIso) row.deliveredAt = deliveredAtIso;
    out.push(row);
  }
  return out;
}

/**
 * Structured `###` block + JSON only. Order line items are **not** duplicated in prose here—the
 * chat U.I. uses `orderHistory` in the request + ```cai-orders```; see `mergeSessionContext` in App.
 */
export function buildOrderHistoryString(entries: GatherOrderField[]): string {
  const rows = formEntriesToPrototypeRows(entries);
  if (rows.length === 0) return "";
  return formatStructuredOrderHistoryAppend(rows).replace(/^\n+/, "");
}
