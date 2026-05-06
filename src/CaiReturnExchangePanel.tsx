import type { CaiOrderItem } from "./chatUtils";
import { RETURN_FLOW_CARE_TEAM_CHIP } from "./chatUtils";
import { OrderReturnExchangeSummary } from "./CaiOrderShowcase";
import "./cai-return-exchange.css";

type Props = {
  variant?: "phone" | "panel";
  order: CaiOrderItem;
  /** While true, show placeholders instead of headline/body (copy is loading from the API). */
  leadLoading?: boolean;
  headline?: string | null;
  body?: string | null;
  /** Disable panel actions during unrelated chat requests (not during {@link leadLoading}). */
  actionsDisabled?: boolean;
  onCareTeamChip: () => void;
  onStartReturnNow: () => void;
};

function CareTeamChipGlyph() {
  return (
    <span className="material-symbols-rounded cai-order-pick-intent__material" aria-hidden>
      volunteer_activism
    </span>
  );
}

/**
 * After “Start a return or exchange”: LLM-written lead + product card (3551:49473) + care chip.
 */
export function CaiReturnExchangePanel({
  variant = "phone",
  order,
  leadLoading = false,
  headline,
  body,
  actionsDisabled = false,
  onCareTeamChip,
  onStartReturnNow,
}: Props) {
  const rootClass = variant === "panel" ? "cai-return-exchange cai-return-exchange--panel" : "cai-return-exchange";
  const showLead = leadLoading || (Boolean(headline?.trim()) && Boolean(body?.trim()));
  /** Card + chip only after LLM headline/body finishes (avoid layout ahead of Cai’s reply). */
  const showCardAndChip = !leadLoading;

  return (
    <section className={rootClass} aria-label="Return or exchange">
      {showLead ? (
        <div className="cai-return-exchange__lead" aria-busy={leadLoading}>
          {leadLoading ? (
            <>
              <div className="cai-return-exchange__skel cai-return-exchange__skel--headline" aria-hidden />
              <div className="cai-return-exchange__skel cai-return-exchange__skel--body" aria-hidden />
              <div className="cai-return-exchange__skel cai-return-exchange__skel--body cai-return-exchange__skel--short" aria-hidden />
            </>
          ) : (
            <>
              {headline?.trim() ? <p className="cai-return-exchange__headline">{headline.trim()}</p> : null}
              {body?.trim() ? <p className="cai-return-exchange__body">{body.trim()}</p> : null}
            </>
          )}
        </div>
      ) : null}

      {showCardAndChip ? (
        <>
          <div className="cai-return-exchange__card">
            <OrderReturnExchangeSummary o={order} />
            <button
              type="button"
              className="cai-return-exchange__cta"
              disabled={actionsDisabled}
              onClick={onStartReturnNow}
            >
              Start return now
            </button>
          </div>

          <div className="cai-msg-ai-chips" aria-label="Escalate to customer care">
            <button
              type="button"
              className="cai-prompt-chip cai-prompt-chip--rich"
              disabled={actionsDisabled}
              onClick={onCareTeamChip}
            >
              <span className="cai-prompt-chip__glyph" aria-hidden>
                <CareTeamChipGlyph />
              </span>
              <span>{RETURN_FLOW_CARE_TEAM_CHIP}</span>
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
