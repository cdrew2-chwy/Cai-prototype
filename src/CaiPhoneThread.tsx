import type { RefObject } from "react";
import { CaiProductShowcase } from "./CaiProductShowcase";
import type { ChatMessage } from "./chatUtils";
import { formatChatTimestamp, parseAssistantMessage } from "./chatUtils";
import { WelcomePhoneContent } from "./welcomePhone";

type Props = {
  welcomeText: string;
  /** Full transcript including [0] = welcome assistant message (duplicate of welcomeText for API). */
  messages: ChatMessage[];
  /** Figma 3177:61059 — timestamp row name (from pet parent profile). */
  petParentName: string;
  /** When true, welcome chips lead with “Get help with an order”. */
  recentOrderWithin7Days?: boolean;
  onChipSelect: (text: string) => void;
  chatLoading: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
};

/**
 * Figma 3065:29802 “Cai Shop prompt” — welcome + prompts + user bubble + Cai reply in one scroll stack.
 */
export function CaiPhoneThread({
  welcomeText,
  messages,
  petParentName,
  recentOrderWithin7Days = false,
  onChipSelect,
  chatLoading,
  bottomRef,
}: Props) {
  const tail = messages.length > 0 && messages[0].role === "assistant" ? messages.slice(1) : messages;

  return (
    <div className="cai-thread" aria-label="Conversation with Cai">
      {welcomeText.trim() ? (
        <section className="cai-thread-welcome" aria-label="Welcome">
          <WelcomePhoneContent
            text={welcomeText}
            recentOrderWithin7Days={recentOrderWithin7Days}
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
        const { body, chips, products, recommendationRationale } = parseAssistantMessage(m.content);
        const sectionTitle = products?.heading?.trim() || "Recommendation";
        return (
          <div key={`a-${i}`} className="cai-msg-ai">
            {body.trim() ? (
              <div className="cai-msg-ai-body cai-text-editorial-text-2 cai-msg-ai-body--muted">{body}</div>
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

      {chatLoading ? (
        <div className="cai-msg-ai cai-msg-ai--typing" aria-live="polite">
          <p className="cai-typing-pill">
            <span className="cai-typing-brand">Cai </span>
            <span className="cai-typing-muted">is thinking…</span>
          </p>
        </div>
      ) : null}

      <div ref={bottomRef} className="cai-thread-end" />
    </div>
  );
}
