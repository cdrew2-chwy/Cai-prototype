import { FormEvent, ReactNode, useId } from "react";
import { CaiTopOfSheet } from "./CaiTopOfSheet";
import chatIngressSvg from "./assets/cai-phone/chat-ingress.svg";
import "./cai-phone.css";

/*
 * Production (Chewy app): this shell sits inside the native client. Product cards and CTAs here
 * should eventually invoke in-app commerce (add to cart, returns, checkout)—not rely on web-only
 * links. This Vite build is layout/flow only until those bridges exist.
 */

/**
 * Composer “send” arrow — matches chat bar spec (Figma 3180:61102 frame; control 3180:61132).
 * Stroke arrow with rounded caps (not a filled triangle).
 */
function IconSendArrow() {
  return (
    <svg
      className="cai-send-btn__icon"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 18.5V7.5M12 7.5l-4.5 4.5M12 7.5l4.5 4.5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Phase = "gather" | "welcome" | "chat";

type Props = {
  phase: Phase;
  children: ReactNode;
  /** When chat, wire the footer composer */
  chatInput: string;
  onChatInputChange: (v: string) => void;
  onSend: () => void;
  chatLoading: boolean;
};

/** Figma “Chat ingress icon” (node 3145:47986 / Chat chat bar). */
function ChatIngressIcon() {
  return (
    <span className="cai-chat-ingress" aria-hidden>
      <img src={chatIngressSvg} alt="" width={21} height={21} decoding="async" />
    </span>
  );
}

export function CaiPhoneScreen({ phase, children, chatInput, onChatInputChange, onSend, chatLoading }: Props) {
  const inputId = useId();
  const composerEnabled = phase === "chat";

  function onFooterSubmit(e: FormEvent) {
    e.preventDefault();
    if (composerEnabled && chatInput.trim() && !chatLoading) onSend();
  }

  return (
    <div className="cai-phone" data-node-id="3145:47986" data-name="Cai Shop welcome">
      {/* Figma: AI chat frame (3145:47987) — gradient + scroll + pinned chat bar */}
      <div className="cai-chat-frame" data-node-id="3145:47987" data-name="AI chat frame">
        <div className="cai-chat-frame-bg" aria-hidden />
        <div className="cai-scroll">{children}</div>

        <footer className="cai-chat-bar" data-node-id="3145:47989" data-name="Chat chat bar">
          <div
            className="cai-chat-bar-glass"
            aria-hidden
            data-node-id="3180:61102"
            data-name="Chat bar glass"
          />
          <form className="cai-composer-form" onSubmit={onFooterSubmit}>
            <label htmlFor={inputId} className="cai-composer-label">
              Message Cai
            </label>
            <div className={`cai-input-pill ${composerEnabled ? "" : "cai-input-pill--disabled"}`}>
              <ChatIngressIcon />
              {composerEnabled ? (
                <>
                  <input
                    id={inputId}
                    className="cai-input-field"
                    type="text"
                    autoComplete="off"
                    enterKeyHint="send"
                    placeholder="Ask Cai…"
                    value={chatInput}
                    onChange={(e) => onChatInputChange(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="cai-send-btn"
                    data-node-id="3180:61132"
                    data-name="Composer send"
                    disabled={chatLoading || !chatInput.trim()}
                    aria-label="Send message"
                  >
                    <IconSendArrow />
                  </button>
                </>
              ) : (
                <>
                  <p className="cai-input-faux" id={inputId}>
                    <span className="cai-input-faux-muted">Chat with</span>
                    <span className="cai-input-faux-brand"> Cai</span>
                  </p>
                  <button
                    type="button"
                    className="cai-send-btn"
                    data-node-id="3180:61132"
                    data-name="Composer send"
                    disabled
                    aria-label="Send (available after Start chatting)"
                  >
                    <IconSendArrow />
                  </button>
                </>
              )}
            </div>
          </form>
        </footer>

        {/* Figma 3145:47990 — same frame as chat bar; no parent transform (fixes blur / centering) */}
        <CaiTopOfSheet className="cai-tos--phone-overlay" />
      </div>
    </div>
  );
}
