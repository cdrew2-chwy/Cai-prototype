/**
 * Aligned with `ORDER_HISTORY_CARDS_ONLY_HINT` in `src/App.tsx` — model must not echo order line items; cards + ```cai-orders``` do.
 */
export const STRUCTURED_ORDER_HISTORY_MARKER = "### Structured order history (prototype)";

export const ORDER_HISTORY_CARDS_ONLY_FOR_MODEL = `The parent's recent order row(s) are shown as interactive order cards in this app when you include a \`cai-orders\` block. Do not list, bullet, number, or repeat individual orders, product names, URLs, or order dates in your replies—the cards and that fence are the only place for that detail.`;

/**
 * @param {string} orderBlock
 * @returns {string}
 */
export function orderBlockForLlmBundle(orderBlock) {
  const t = (orderBlock ?? "").trim();
  if (!t || t === "(none provided)") return t || "(none provided)";
  if (t.includes(STRUCTURED_ORDER_HISTORY_MARKER)) {
    return ORDER_HISTORY_CARDS_ONLY_FOR_MODEL;
  }
  return t;
}
