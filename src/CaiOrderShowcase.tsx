import { useState } from "react";
import type { CaiOrderItem, CaiOrdersBlock } from "./chatUtils";
import "./cai-order-cards.css";

type Props = { block: CaiOrdersBlock };

/**
 * Figma: order row in list — 3279:29189 (card layout / tap target).
 * https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=3279-29189
 */

/** "Order # 1234566789" style per Figma (one space after #, bold title line). */
function formatOrderNumberLabel(raw: string): string {
  const t = raw.trim();
  if (/^order\s*#/i.test(t)) {
    const m = t.match(/^order\s*#\s*(.*)$/i);
    const n = m?.[1]?.trim() ?? "";
    return n ? `Order # ${n}` : t;
  }
  if (t.startsWith("#")) {
    return `Order # ${t.replace(/^#+\s*/, "").trim()}`;
  }
  return `Order # ${t}`;
}

const WEEK3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * Figma: 3-char weekday, 3-char month, 1–2 digit day of month (e.g. "Wed, Apr 5") — no year.
 * Uses the local calendar date of the `placedAt` instant.
 */
function formatFigmaOrderDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const w = WEEK3[d.getDay()] ?? "—";
  const m = MONTH3[d.getMonth()] ?? "—";
  const day = d.getDate();
  return `${w}, ${m} ${day}`;
}

type StatusKind = "delivered" | "in_transit" | "closed" | "other";

function getStatusKindFromString(status: string | undefined): StatusKind {
  const t = status?.toLowerCase() ?? "";
  if (/\b(cancel|refund)\b/.test(t) || t.includes("canceled") || t.includes("cancelled")) {
    return "closed";
  }
  if (/\b(deliver|arriv|complet)\b/.test(t) || t === "delivered") {
    return "delivered";
  }
  if (
    /\b(ship|transit|in transit|in-transit|process|processing|out for|pack|pending|shipped)\b/.test(t)
  ) {
    return "in_transit";
  }
  return "other";
}

function getStatusKind(o: CaiOrderItem): StatusKind {
  return getStatusKindFromString(o.status);
}

/**
 * Figma: delivered → "Delivered on Wed, Apr 5"; in transit → "Arrives by Wed, Apr 5".
 * Does not render `meta` (no Autoship / one-time copy on the card).
 */
function getStatusDateCaption(o: CaiOrderItem): string {
  if (!o.placedAt?.trim()) return "";
  const d = formatFigmaOrderDate(o.placedAt);
  if (!d) return "";
  const kind = getStatusKind(o);
  if (kind === "delivered") return `Delivered on ${d}`;
  if (kind === "in_transit") return `Arrives by ${d}`;
  if (kind === "closed") return `Canceled on ${d}`;
  return `Placed on ${d}`;
}

/**
 * Consistent short labels on the status pill.
 */
function normalizePillStatus(status: string | undefined): string {
  const t = (status ?? "").trim();
  if (!t) return "Status";
  const kind = getStatusKindFromString(status);
  if (kind === "delivered") return "Delivered";
  if (kind === "in_transit") return "In transit";
  if (kind === "closed") return "Canceled";
  return t;
}

/**
 * Figma: neutral grey pill, black type — tints for delivered / in-transit / closed.
 */
function orderStatusPillClassKind(o: CaiOrderItem): string {
  const k = getStatusKind(o);
  if (k === "delivered") return "cai-order-card__pill cai-order-card__pill--delivered";
  if (k === "closed") return "cai-order-card__pill cai-order-card__pill--closed";
  if (k === "in_transit") return "cai-order-card__pill cai-order-card__pill--in_transit";
  return "cai-order-card__pill cai-order-card__pill--default";
}

function OrderTileIcon() {
  return (
    <svg
      className="cai-order-card__icon-svg"
      viewBox="0 0 24 24"
      width={28}
      height={28}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M3 9.5 12 4.5l9 5v1.5H3V9.5Z"
        fill="var(--cai-order-icon-1, #0d5f6a)"
        fillOpacity={0.22}
      />
      <path
        d="M3 11h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9Z"
        stroke="var(--cai-order-icon-1, #0d5f6a)"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path
        d="M3 11V9.5L12 4.5l9 5V11"
        stroke="var(--cai-order-icon-1, #0d5f6a)"
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M12 4.5V15"
        stroke="var(--cai-order-icon-1, #0d5f6a)"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeOpacity={0.45}
      />
    </svg>
  );
}

function OrderCardRow({ o }: { o: CaiOrderItem }) {
  const dateCaption = getStatusDateCaption(o);
  const hasStatusPill = Boolean(o.status?.trim());
  const pillText = hasStatusPill ? normalizePillStatus(o.status) : "";

  return (
    <li className="cai-order-card" data-order-id={o.id}>
      <div className="cai-order-card__inner">
        <div className="cai-order-card__thumb">
          {o.imageUrl ? (
            <img
              className="cai-order-card__thumb-img"
              src={o.imageUrl}
              alt=""
              width={64}
              height={64}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="cai-order-card__thumb-fallback" aria-hidden>
              <OrderTileIcon />
            </div>
          )}
        </div>
        <div className="cai-order-card__content">
          <p className="cai-order-card__title">{formatOrderNumberLabel(o.orderNumber)}</p>
          {dateCaption || hasStatusPill ? (
            <div className="cai-order-card__status-line">
              {hasStatusPill ? <span className={orderStatusPillClassKind(o)}>{pillText}</span> : null}
              {dateCaption ? <span className="cai-order-card__date-line">{dateCaption}</span> : null}
            </div>
          ) : null}
          {o.summary?.trim() ? <p className="cai-order-card__line-items">{o.summary}</p> : null}
        </div>
      </div>
    </li>
  );
}

/**
 * Renders ```cai-orders``` as tappable list rows; collapses to 3 when `showLoadMore` until expanded.
 */
export function CaiOrderShowcase({ block }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { orders, showLoadMore } = block;
  const limit = showLoadMore && !expanded ? 3 : orders.length;
  const visible = orders.slice(0, limit);
  const canLoadMore = Boolean(showLoadMore && !expanded && orders.length > 3);

  return (
    <div className="cai-order-showcase">
      <ul className="cai-order-card-list" aria-label="Order list">
        {visible.map((o) => (
          <OrderCardRow key={o.id} o={o} />
        ))}
      </ul>
      {canLoadMore ? (
        <button type="button" className="cai-order-load-more" onClick={() => setExpanded(true)}>
          Load more orders
        </button>
      ) : null}
    </div>
  );
}
