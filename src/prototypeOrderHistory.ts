/**
 * Example order rows: paste (with `### Structured order history (prototype)`) into
 * **Order history** in gather, or use the `formatStructuredOrderHistoryAppend` helper
 * in session personas. The app only sends `orderHistory` to `/api/chat` from that field, parsed by
 * `orderHistoryFromShopping.ts`. Server applies last-6-months in `orderHelpGuard.js`.
 */

export type { PrototypeOrderRow } from "./orderHistoryFromShopping";
export { STRUCTURED_ORDER_HISTORY_MARKER, formatStructuredOrderHistoryAppend } from "./orderHistoryFromShopping";

/** Example: five in-window rows (paste after the `###` marker) to test “3 + load more.” */
export const PROTOTYPE_ORDER_HISTORY: PrototypeOrderRow[] = [
  {
    id: "o1",
    orderNumber: "#5839471026",
    summary: "Iams Proactive Health Senior Large Breed, 30-lb bag × 2",
    status: "Delivered",
    placedAt: "2026-03-18T12:00:00.000Z",
  },
  {
    id: "o2",
    orderNumber: "#2948173650",
    summary: "Greenies Aging Care Dental Treats, 17 ct",
    status: "Shipped",
    placedAt: "2026-03-04T09:30:00.000Z",
  },
  {
    id: "o3",
    orderNumber: "#7365920481",
    summary: "Playology dental chew ball, medium",
    status: "Delivered",
    placedAt: "2026-02-21T16:00:00.000Z",
  },
  {
    id: "o4",
    orderNumber: "#4492837165",
    summary: "Frisco step-in harness, large",
    status: "Delivered",
    placedAt: "2026-02-02T11:00:00.000Z",
  },
  {
    id: "o5",
    orderNumber: "#8650392741",
    summary: "Taste of the Wild Pacific Stream, 28-lb bag",
    status: "Delivered",
    placedAt: "2026-01-12T08:00:00.000Z",
  },
];

export const PROTOTYPE_ORDER_HISTORY_SMALL: PrototypeOrderRow[] = PROTOTYPE_ORDER_HISTORY.slice(0, 3);
