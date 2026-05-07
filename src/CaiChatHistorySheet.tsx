import { useEffect, useId, useRef } from "react";
import type { ChatHistoryListItem } from "./caiChatHistory";
import "./cai-chat-history.css";

function IconClose() {
  return (
    <svg className="cai-history-sheet__close-icon" width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.4 6.4L12 12m0 0l5.6 5.6M12 12l5.6-5.6M12 12l-5.6 5.6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg className="cai-history-sheet__chevron" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  entries: ChatHistoryListItem[];
  onNewChat: () => void;
  onClearHistory: () => void;
  clearDisabled?: boolean;
  onSelectEntry?: (item: ChatHistoryListItem) => void;
};

/**
 * Figma 3426:77197 — Chat history bottom sheet over Cai (dimmed chat behind).
 * Figma 3633:39615 — Empty history: copy + same Clear control as populated list, disabled.
 */
export function CaiChatHistorySheet({
  open,
  onClose,
  title = "Chat history",
  entries,
  onNewChat,
  onClearHistory,
  clearDisabled,
  onSelectEntry,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="cai-history-root cai-history-root--open"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-node-id="3426:77197"
      data-name="Cai Shop welcome - history"
    >
      <button type="button" className="cai-history-backdrop" aria-label="Dismiss chat history" onClick={onClose} />
      <div className="cai-history-sheet" data-node-id="3426:77332" data-name="Shortcuts">
        <div className="cai-history-sheet__grabber-wrap" data-node-id="3426:77333">
          <div className="cai-history-sheet__grabber" data-node-id="3426:77334" aria-hidden />
        </div>
        <div className="cai-history-sheet__header" data-node-id="3426:77335">
          <button
            ref={closeRef}
            type="button"
            className="cai-history-sheet__close"
            data-node-id="3426:77338"
            aria-label="Close chat history"
            onClick={onClose}
          >
            <IconClose />
          </button>
          <h2 id={titleId} className="cai-history-sheet__title" data-node-id="3426:77337">
            {title}
          </h2>
          <button type="button" className="cai-history-sheet__new" data-node-id="3426:77339" onClick={onNewChat}>
            New chat
          </button>
        </div>
        <div
          className={
            entries.length === 0
              ? "cai-history-sheet__scroll cai-history-sheet__scroll--empty"
              : "cai-history-sheet__scroll"
          }
        >
          {entries.length === 0 ? (
            <div className="cai-history-sheet__empty-stack" data-node-id="3633:39615">
              <div className="cai-history-sheet__empty-wrap" data-node-id="3633:39834">
                <p className="cai-history-sheet__empty-line">No saved chat history with Cai</p>
              </div>
              <div className="cai-history-sheet__clear-wrap cai-history-sheet__clear-wrap--in-empty" data-node-id="3633:39660">
                <button
                  type="button"
                  className="cai-history-sheet__clear"
                  data-node-id="3633:39661"
                  disabled={clearDisabled}
                  onClick={onClearHistory}
                >
                  Clear chat history
                </button>
              </div>
            </div>
          ) : (
            <>
              <ul className="cai-history-sheet__list" data-node-id="3426:77341">
                {entries.map((item) => (
                  <li key={item.id} className="cai-history-sheet__row">
                    <button
                      type="button"
                      className="cai-history-sheet__card"
                      onClick={() => onSelectEntry?.(item)}
                    >
                      <div className="cai-history-sheet__card-text">
                        <span className="cai-history-sheet__card-date">{item.dateLabel}</span>
                        <span className="cai-history-sheet__card-title">{item.title}</span>
                      </div>
                      <IconChevronRight />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="cai-history-sheet__clear-wrap" data-node-id="3426:78483">
                <button
                  type="button"
                  className="cai-history-sheet__clear"
                  data-node-id="3426:78477"
                  disabled={clearDisabled}
                  onClick={onClearHistory}
                >
                  Clear chat history
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
