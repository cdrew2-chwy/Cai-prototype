/**
 * Prototype: when the parent asks for order help and the client sends `orderHistory` (from gather),
 * the API may have enriched `summary` + `imageUrl` from Chewy PDPs (`chewyPdpEnrich.js`) when `summary` was
 * a `https://www.chewy.com/...` link. This module ensures the reply includes a ```cai-orders``` fence the UI
 * can render (Figma CAI Phase 3 order cards). No rows are invented server-side.
 */

const SIX_MS = 180 * 24 * 60 * 60 * 1000;

/** True for the welcome chip label or typical vague order-help phrasing. */
export function wantsOrderHelp(userText) {
  const raw = (userText || "").trim();
  if (!raw) return false;
  const t = raw.toLowerCase();
  if (t === "get help with an order") return true;
  if (/\b(return|refund|replace|damag|missing|track|shipment|deliver|wrong item|cancel)\b/.test(t) && /\border\b/.test(t)) return true;
  if (/\b(order help|help with (my |an |the )?order|my order|order status|where('?s| is) my order)\b/.test(t)) return true;
  if (/\b(i'?d like to|i want to|need to)\s+(return|cancel|track)\b/.test(t)) return true;
  return false;
}

function parseOrderDate(iso) {
  const n = Date.parse(iso);
  return Number.isNaN(n) ? 0 : n;
}

/** Keep orders in the last 6 months, newest first. */
export function ordersInLastSixMonths(orderHistory) {
  const now = Date.now();
  const cutoff = now - SIX_MS;
  return [...(orderHistory || [])]
    .filter((o) => o && typeof o.placedAt === "string" && parseOrderDate(o.placedAt) >= cutoff)
    .sort((a, b) => parseOrderDate(b.placedAt) - parseOrderDate(a.placedAt));
}

/**
 * @param {Array<{ id?: string, orderNumber: string, summary: string, meta?: string, status?: string, placedAt: string }>} orderHistory
 */
export function buildCaiOrdersFenceJson(orderHistory) {
  const filtered = ordersInLastSixMonths(orderHistory);
  const showLoadMore = filtered.length > 3;
  const payload = {
    orders: filtered,
    showLoadMore,
  };
  return `\`\`\`cai-orders\n${JSON.stringify(payload, null, 0)}\n\`\`\``;
}

/**
 * @param {string} reply
 * @param {string} latestUserText
 * @param {unknown} orderHistory
 * @returns {string}
 */
export function ensureOrderCardsInReply(reply, latestUserText, orderHistory) {
  const raw = reply ?? "";
  if (!wantsOrderHelp(latestUserText)) return raw;
  if (!Array.isArray(orderHistory) || orderHistory.length === 0) return raw;

  const filtered = ordersInLastSixMonths(orderHistory);
  if (filtered.length === 0) return raw;

  const fence = buildCaiOrdersFenceJson(orderHistory);
  const reFence = /```\s*cai-orders\s*\n[\s\S]*?```/i;

  if (reFence.test(raw)) {
    return raw.replace(reFence, fence.trim());
  }

  const trimmed = raw.trimEnd();
  const lines = trimmed.split("\n");
  const lastLine = lines[lines.length - 1] ?? "";
  if (/^CHIPS:\s*/i.test(lastLine.trim())) {
    const body = lines.slice(0, -1).join("\n").trimEnd();
    return `${body}\n\n${fence}\n${lastLine}`;
  }
  return `${trimmed}\n\n${fence}\n\nCHIPS: Track an order | Return or replace | Something else`;
}
