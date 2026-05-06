import { useEffect, useState } from "react";
import { splitFirstSentence, splitOrderHelpLoadingLeadIn } from "./chatUtils";

const STAGGER_MS = 520;

type Variant = "phone" | "panel";

type Props = { variant: Variant };

/**
 * Staggered reveal of {@link ORDER_HELP_LOADING_LEAD_IN} so each line lands while PDP enrichment runs.
 */
export function OrderHelpLeadInSerial({ variant }: Props) {
  const paragraphs = splitOrderHelpLoadingLeadIn();
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    if (visible >= paragraphs.length) return;
    const id = window.setTimeout(() => setVisible((v) => v + 1), STAGGER_MS);
    return () => window.clearTimeout(id);
  }, [visible, paragraphs.length]);

  const rootClass =
    variant === "phone"
      ? "cai-order-help-lead-in-serial"
      : "cai-order-help-lead-in-serial cai-order-help-lead-in-serial--panel";

  return (
    <div className={rootClass} aria-live="polite">
      {paragraphs.slice(0, visible).map((para, idx) => (
        <SerialParagraph key={idx} text={para} isFirst={idx === 0} variant={variant} />
      ))}
    </div>
  );
}

function SerialParagraph({
  text,
  isFirst,
  variant,
}: {
  text: string;
  isFirst: boolean;
  variant: Variant;
}) {
  if (isFirst) {
    const { lead, rest } = splitFirstSentence(text);
    if (variant === "phone") {
      return (
        <div className="cai-order-help-lead-in-block cai-msg-ai-body-stack">
          <p className="cai-msg-ai-lead cai-text-editorial-heading-1">{lead}</p>
          {rest ? (
            <div className="cai-msg-ai-body-rest cai-text-editorial-text-2 cai-msg-ai-body--muted">{rest}</div>
          ) : null}
        </div>
      );
    }
    return (
      <div className="cai-order-help-lead-in-block">
        <p className="cai-msg-ai-lead cai-text-editorial-heading-1">{lead}</p>
        {rest ? <div className="bubble-body-prose-rest">{rest}</div> : null}
      </div>
    );
  }

  if (variant === "phone") {
    return (
      <div className="cai-order-help-lead-in-block cai-order-help-lead-in-block--follow cai-msg-ai-body-stack">
        <p className="cai-text-editorial-text-2 cai-msg-ai-body--muted">{text}</p>
      </div>
    );
  }

  return (
    <div className="cai-order-help-lead-in-block cai-order-help-lead-in-block--follow">
      <div className="bubble-body-prose-rest">{text}</div>
    </div>
  );
}
