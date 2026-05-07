import { CaiOrderPickFollowup } from "./CaiOrderPickFollowup";
import { CaiOrderShowcase } from "./CaiOrderShowcase";
import { CaiProductShowcase } from "./CaiProductShowcase";
import type { CaiOrderItem, ChatMessage, OrderPickState } from "./chatUtils";
import { ConnectWithVetIngressCard } from "./ConnectWithVetIngressCard";
import { CaiAssistantLeadContent } from "./CaiAssistantLeadContent";
import { CaiReturnExchangePanel } from "./CaiReturnExchangePanel";
import { OrderHelpLeadInSerial } from "./OrderHelpLeadInSerial";
import { WelcomePhoneContent } from "./welcomePhone";
import {
  ORDER_HELP_LOADING_LEAD_IN,
  formatChatTimestamp,
  fullMessageIndexFromTailIndex,
  parseAssistantMessage,
} from "./chatUtils";

type Props = {
  welcomeText: string;
  /** Full transcript including [0] = welcome assistant message (duplicate of welcomeText for API). */
  messages: ChatMessage[];
  /** Figma 3177:61059 — timestamp row name (from pet parent profile). */
  petParentName: string;
  /** Pet profile string (first-line name used to personalize the product-help chip). */
  petProfile: string;
  /** When set, that assistant turn’s order list is replaced by the selected-order + intent UI (Figma 3288:29321). */
  orderPick: OrderPickState | null;
  onOrderCardSelect: (messageIndex: number, order: CaiOrderItem) => void;
  onOrderPickClear: () => void;
  /** When true, welcome’s first prompt chip is order help (gather had an order placed in the last 10 days). */
  getHelpWithOrderFirst?: boolean;
  onChipSelect: (text: string) => void;
  chatLoading: boolean;
  /** Figma 3066:38124 — structured return UI after the return intent chip. */
  returnFlowOrder: CaiOrderItem | null;
  returnFlowLeadLoading?: boolean;
  returnFlowHeadline?: string | null;
  returnFlowBody?: string | null;
  onReturnCareTeamChip: () => void;
  onReturnStartNow: () => void;
};

/**
 * Figma 3065:29802 “Cai Shop prompt” — welcome + prompts + user bubble + Cai reply in one scroll stack.
 */
export function CaiPhoneThread({
  welcomeText,
  messages,
  petParentName,
  petProfile,
  orderPick,
  onOrderCardSelect,
  onOrderPickClear,
  getHelpWithOrderFirst = false,
  onChipSelect,
  chatLoading,
  returnFlowOrder,
  returnFlowLeadLoading = false,
  returnFlowHeadline = null,
  returnFlowBody = null,
  onReturnCareTeamChip,
  onReturnStartNow,
}: Props) {
  const tail = messages.length > 0 && messages[0].role === "assistant" ? messages.slice(1) : messages;
  const lastMessage = messages[messages.length - 1];
  const interimOrderHelpLeadInShowing =
    chatLoading &&
    lastMessage?.role === "assistant" &&
    lastMessage.content === ORDER_HELP_LOADING_LEAD_IN;

  return (
    <div className="cai-thread" aria-label="Conversation with Cai">
      {welcomeText.trim() ? (
        <section className="cai-thread-welcome" aria-label="Welcome">
          <WelcomePhoneContent
            text={welcomeText}
            getHelpWithOrderFirst={getHelpWithOrderFirst}
            onPromptSelect={onChipSelect}
            promptsDisabled={chatLoading}
          />
        </section>
      ) : null}

      {tail.map((m, i) => {
        if (m.role === "user") {
          const ts = m.sentAt ?? Date.now();
          return (
            <div key={`u-${i}`} className="cai-msg-user">
              <div className="cai-msg-user-meta">
                <span className="cai-msg-user-name">{petParentName}</span>
                <span className="cai-msg-user-time">{formatChatTimestamp(ts)}</span>
              </div>
              <div className="cai-msg-user-bubble">
                <p className="cai-msg-user-text">{m.content}</p>
              </div>
            </div>
          );
        }
        const isInterimOrderHelpLeadIn =
          chatLoading && m.content === ORDER_HELP_LOADING_LEAD_IN && i === tail.length - 1;

        if (isInterimOrderHelpLeadIn) {
          return (
            <div key={`a-${i}`} className="cai-msg-ai">
              <OrderHelpLeadInSerial variant="phone" />
            </div>
          );
        }

        const {
          body,
          bodyAfterVet,
          chips,
          products,
          orders,
          recommendationRationale,
          vetIngress,
          vetWaitSeconds,
          vetCardIntro,
        } = parseAssistantMessage(m.content);
        const sectionTitle = products?.heading?.trim() || "Recommendation";
        const ordersSectionTitle = orders?.heading?.trim();
        const messageIndex = fullMessageIndexFromTailIndex(i, messages);
        const pickHere = Boolean(orderPick && orderPick.messageIndex === messageIndex);
        const pick = pickHere ? orderPick : null;
        return (
          <div key={`a-${i}`} className="cai-msg-ai">
            {body.trim() ? <CaiAssistantLeadContent text={body} variant="phone" /> : null}
            {vetIngress ? <ConnectWithVetIngressCard waitSeconds={vetWaitSeconds} intro={vetCardIntro} /> : null}
            {bodyAfterVet?.trim() ? (
              <div className="cai-msg-ai-body-after-vet">
                <CaiAssistantLeadContent text={bodyAfterVet} variant="afterVet" />
              </div>
            ) : null}
            {orders ? (
              <section className="cai-recommendation-section" aria-label="Recent orders">
                {ordersSectionTitle ? (
                  <h3 className="cai-recommendation-section__title">{ordersSectionTitle}</h3>
                ) : null}
                {pick ? (
                  <CaiOrderPickFollowup
                    variant="phone"
                    order={pick.order}
                    petParentName={petParentName}
                    petProfile={petProfile}
                    pickedAt={pick.pickedAt}
                    chatLoading={chatLoading}
                    hideIntentChips={Boolean(returnFlowOrder)}
                    onDifferentOrder={onOrderPickClear}
                    onIntentChip={onChipSelect}
                  />
                ) : (
                  <CaiOrderShowcase block={orders} onSelectOrder={(o) => onOrderCardSelect(messageIndex, o)} />
                )}
              </section>
            ) : null}
            {products ? (
              <section className="cai-recommendation-section" aria-label="Product recommendation">
                <h3 className="cai-recommendation-section__title">{sectionTitle}</h3>
                <CaiProductShowcase block={products} suppressHeading />
                {recommendationRationale?.trim() ? (
                  <div className="cai-recommendation-section__why cai-text-editorial-text-2 cai-msg-ai-body--muted">
                    {recommendationRationale}
                  </div>
                ) : null}
              </section>
            ) : null}
            {chips.length > 0 ? (
              <div className="cai-msg-ai-chips" aria-label="Suggested replies">
                {chips.map((c, idx) => (
                  <button
                    key={`${idx}-${c}`}
                    type="button"
                    className="cai-prompt-chip"
                    disabled={chatLoading}
                    onClick={() => onChipSelect(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}

      {returnFlowOrder ? (
        <div className="cai-msg-ai">
          <CaiReturnExchangePanel
            variant="phone"
            order={returnFlowOrder}
            leadLoading={returnFlowLeadLoading}
            headline={returnFlowHeadline}
            body={returnFlowBody}
            actionsDisabled={chatLoading}
            onCareTeamChip={onReturnCareTeamChip}
            onStartReturnNow={onReturnStartNow}
          />
        </div>
      ) : null}

      {(chatLoading && !interimOrderHelpLeadInShowing) || returnFlowLeadLoading ? (
        <div className="cai-msg-ai cai-msg-ai--typing" aria-live="polite">
          <p className="cai-typing-pill">
            <span className="cai-typing-brand">Cai </span>
            <span className="cai-typing-muted">is thinking…</span>
          </p>
        </div>
      ) : null}

      <div className="cai-thread-end" aria-hidden />
    </div>
  );
}
