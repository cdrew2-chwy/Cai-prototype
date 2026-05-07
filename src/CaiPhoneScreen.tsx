import { FormEvent, ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { CaiTopOfSheet } from "./CaiTopOfSheet";
import chatIngressSvg from "./assets/cai-phone/chat-ingress.svg";
import moreContentBtnSvg from "./assets/cai-phone/cai-more-content-button.svg";
import "./cai-phone.css";

const SCROLL_END_THRESHOLD_PX = 8;

function scrollElHasOverflowBelow(el: HTMLDivElement) {
  return el.scrollHeight > el.clientHeight + SCROLL_END_THRESHOLD_PX;
}

function scrollElIsAtBottom(el: HTMLDivElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_END_THRESHOLD_PX;
}

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
  onOpenChatHistory?: () => void;
  /** Portal overlay (e.g. chat history sheet) — must be positioned within `.cai-phone`. */
  phoneOverlay?: ReactNode;
};

/** Figma “Chat ingress icon” (node 3145:47986 / Chat chat bar). */
function ChatIngressIcon() {
  return (
    <span className="cai-chat-ingress" aria-hidden>
      <img src={chatIngressSvg} alt="" width={21} height={21} decoding="async" />
    </span>
  );
}

export function CaiPhoneScreen({
  phase,
  children,
  chatInput,
  onChatInputChange,
  onSend,
  chatLoading,
  onOpenChatHistory,
  phoneOverlay,
}: Props) {
  const inputId = useId();
  const composerEnabled = phase === "chat";
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentMeasureRef = useRef<HTMLDivElement>(null);
  const [showMoreContent, setShowMoreContent] = useState(false);

  const updateMoreContentVisibility = useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const hasMore = scrollElHasOverflowBelow(sc) && !scrollElIsAtBottom(sc);
    setShowMoreContent(hasMore);
  }, []);

  useEffect(() => {
    const sc = scrollRef.current;
    const inner = contentMeasureRef.current;
    if (!sc) return;

    updateMoreContentVisibility();

    sc.addEventListener("scroll", updateMoreContentVisibility, { passive: true });
    const onResize = () => updateMoreContentVisibility();
    window.addEventListener("resize", onResize);

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateMoreContentVisibility();
          })
        : null;
    if (inner) ro?.observe(inner);

    const raf = requestAnimationFrame(() => updateMoreContentVisibility());

    return () => {
      cancelAnimationFrame(raf);
      sc.removeEventListener("scroll", updateMoreContentVisibility);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [updateMoreContentVisibility, phase]);

  function onMoreContentClick() {
    const sc = scrollRef.current;
    if (!sc) return;
    const top = sc.scrollHeight - sc.clientHeight;
    sc.scrollTo({ top, behavior: "smooth" });
  }

  function onFooterSubmit(e: FormEvent) {
    e.preventDefault();
    if (composerEnabled && chatInput.trim() && !chatLoading) onSend();
  }

  return (
    <div className="cai-phone" data-node-id="3145:47986" data-name="Cai Shop welcome">
      {/* Figma: AI chat frame (3145:47987) — gradient + scroll + pinned chat bar */}
      <div className="cai-chat-frame" data-node-id="3145:47987" data-name="AI chat frame">
        <div className="cai-chat-frame-bg" aria-hidden />
        <div className="cai-scroll" ref={scrollRef}>
          <div className="cai-scroll__content" ref={contentMeasureRef}>
            {children}
          </div>
        </div>

        {showMoreContent ? (
          <button
            type="button"
            className="cai-more-content-btn"
            data-node-id="3593:50070"
            data-name="More content button"
            aria-label="More content below. Scroll to bottom."
            onClick={onMoreContentClick}
          >
            <img src={moreContentBtnSvg} alt="" width={42} height={42} decoding="async" />
          </button>
        ) : null}

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
        <CaiTopOfSheet className="cai-tos--phone-overlay" onHistoryClick={onOpenChatHistory} />
      </div>
      {phoneOverlay}
    </div>
  );
}
