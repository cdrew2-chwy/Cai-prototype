import type { ReactNode } from "react";
import { CaiOrderSelectedDetailCard, formatOrderNumberLabel, formatOrderSelectedCaption } from "./CaiOrderShowcase";
import type { CaiOrderItem } from "./chatUtils";
import { formatChatTimestamp, START_RETURN_OR_EXCHANGE_CHIP } from "./chatUtils";
import "./cai-order-pick-flow.css";

export const SELECT_DIFFERENT_ORDER_LABEL = "Select a different order";

const DEFAULT_INTENT_ISSUE = "Report an issue (Damaged, missing, etc.)";
/** Figma 3087:42971 — third prompt in order-help intent stack */
const DEFAULT_INTENT_VIEW_PRODUCT = "View product details";

/**
 * Google Material Symbols — icon names must match fonts.google.com/icons.
 * Return/exchange uses Outlined `package_2` (delivery box); other intents use Rounded.
 */
function MaterialSymbolOutlined({ name }: { name: "package_2" }) {
  return (
    <span className="material-symbols-outlined cai-order-pick-intent__material" aria-hidden>
      {name}
    </span>
  );
}

function MaterialSymbolRounded({ name }: { name: "warning" | "frame_inspect" }) {
  return (
    <span className="material-symbols-rounded cai-order-pick-intent__material" aria-hidden>
      {name}
    </span>
  );
}

export type CaiOrderPickFollowupProps = {
  variant: "phone" | "panel";
  order: CaiOrderItem;
  petParentName: string;
  petProfile: string;
  pickedAt: number;
  chatLoading: boolean;
  /** After “Start a return or exchange”, keep order history visible without repeating intent chips. */
  hideIntentChips?: boolean;
  onDifferentOrder: () => void;
  onIntentChip: (label: string) => void;
};

/**
 * Figma 3288:29321 — after parent taps an order card (order help, intent not chosen yet).
 * Intent chips: Figma 3087:42971 (Promp collection).
 * https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=3288-29321
 */
export function CaiOrderPickFollowup({
  variant,
  order,
  petParentName,
  petProfile: _petProfile,
  pickedAt,
  chatLoading,
  hideIntentChips = false,
  onDifferentOrder,
  onIntentChip,
}: CaiOrderPickFollowupProps) {
  const rootClass = `cai-order-pick-flow${variant === "panel" ? " cai-order-pick-flow--panel" : ""}`;
  const intents: { label: string; icon: ReactNode }[] = [
    { label: START_RETURN_OR_EXCHANGE_CHIP, icon: <MaterialSymbolOutlined name="package_2" /> },
    { label: DEFAULT_INTENT_ISSUE, icon: <MaterialSymbolRounded name="warning" /> },
    { label: DEFAULT_INTENT_VIEW_PRODUCT, icon: <MaterialSymbolRounded name="frame_inspect" /> },
  ];

  const userBubbleText = formatOrderNumberLabel(order.orderNumber);

  if (variant === "phone") {
    return (
      <div className={rootClass}>
        <div className="cai-msg-user cai-order-pick-flow__confirm">
          <div className="cai-msg-user-meta">
            <span className="cai-msg-user-name">{petParentName}</span>
            <span className="cai-msg-user-time">{formatChatTimestamp(pickedAt)}</span>
          </div>
          <div className="cai-msg-user-bubble">
            <p className="cai-msg-user-text">{userBubbleText}</p>
          </div>
        </div>

        <div className="cai-order-pick-flow__selectedBlock">
          <p className="cai-order-pick-flow__selectedLabel">{formatOrderSelectedCaption(order)}</p>
          <CaiOrderSelectedDetailCard o={order} />
        <button
          type="button"
          className="cai-order-pick-flow__changeOrder"
          disabled={chatLoading}
          onClick={onDifferentOrder}
        >
          {SELECT_DIFFERENT_ORDER_LABEL}
        </button>
      </div>

      {!hideIntentChips ? (
        <>
          <div className="cai-order-pick-flow__caiAsk">
            <p className="cai-order-pick-flow__caiHeading">How can I help with this order?</p>
          </div>

          <div className="cai-msg-ai-chips" aria-label="Suggested next steps for this order">
            {intents.map((row) => (
              <button
                key={row.label}
                type="button"
                className="cai-prompt-chip cai-prompt-chip--rich"
                disabled={chatLoading}
                onClick={() => onIntentChip(row.label)}
              >
                <span className="cai-prompt-chip__glyph" aria-hidden>
                  {row.icon}
                </span>
                <span>{row.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
    );
  }

  return (
    <div className={rootClass}>
      <div className="cai-order-pick-flow__confirm cai-order-pick-flow__confirm--panel">
        <div className="cai-order-pick-flow__panelMeta">
          <span className="cai-order-pick-flow__panelMetaName">{petParentName}</span>
          <span className="cai-order-pick-flow__panelMetaTime">{formatChatTimestamp(pickedAt)}</span>
        </div>
        <div className="cai-order-pick-flow__panelBubble">
          <p className="cai-order-pick-flow__panelBubbleText">{userBubbleText}</p>
        </div>
      </div>

      <div className="cai-order-pick-flow__selectedBlock">
        <p className="cai-order-pick-flow__selectedLabel">{formatOrderSelectedCaption(order)}</p>
        <CaiOrderSelectedDetailCard o={order} />
        <button
          type="button"
          className="cai-order-pick-flow__changeOrder"
          disabled={chatLoading}
          onClick={onDifferentOrder}
        >
          {SELECT_DIFFERENT_ORDER_LABEL}
        </button>
      </div>

      {!hideIntentChips ? (
        <>
          <div className="cai-order-pick-flow__caiAsk">
            <p className="cai-order-pick-flow__caiHeading">How can I help with this order?</p>
          </div>

          <div className="cai-order-pick-flow__intentStack" aria-label="Suggested next steps for this order">
            {intents.map((row) => (
              <button
                key={row.label}
                type="button"
                className="cai-order-pick-intent"
                disabled={chatLoading}
                onClick={() => onIntentChip(row.label)}
              >
                <span className="cai-order-pick-intent__glyph" aria-hidden>
                  {row.icon}
                </span>
                <span className="cai-order-pick-intent__label">{row.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
