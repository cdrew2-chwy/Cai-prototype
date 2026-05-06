import { FormEvent, useMemo, useState } from "react";
import { apiUrl, readJson } from "./api";
import { CaiAssistantLeadContent } from "./CaiAssistantLeadContent";
import { CaiOrderPickFollowup } from "./CaiOrderPickFollowup";
import { CaiOrderShowcase } from "./CaiOrderShowcase";
import { CaiPhoneScreen } from "./CaiPhoneScreen";
import { CaiPhoneThread } from "./CaiPhoneThread";
import { CaiReturnExchangePanel } from "./CaiReturnExchangePanel";
import { OrderHelpLeadInSerial } from "./OrderHelpLeadInSerial";
import type { CaiOrderItem, ChatMessage, OrderPickState } from "./chatUtils";
import { ConnectWithVetIngressCard } from "./ConnectWithVetIngressCard";
import { CaiProductShowcase } from "./CaiProductShowcase";
import {
  extractPetParentDisplayName,
  messagesForApi,
  ORDER_HELP_LOADING_LEAD_IN,
  parseAssistantMessage,
  RETURN_FLOW_CARE_TEAM_CHIP,
  START_RETURN_OR_EXCHANGE_CHIP,
  stripCaiStructuredFences,
  stripRedundantOrderHelpModelEcho,
  stripWelcomeMarkdownBold,
  wantsOrderHelpFromUser,
} from "./chatUtils";
import { PhoneWelcomePlaceholder, WelcomePhoneContent } from "./welcomePhone";
import {
  parseOrderHistoryFromShoppingText,
  stripStructuredOrderBlockFromShoppingText,
} from "./orderHistoryFromShopping";
import {
  GATHER_ORDER_STATUS_OPTIONS,
  buildOrderHistoryString,
  createEmptyGatherOrderField,
  formEntriesToPrototypeRows,
  hasOrderPlacedInLastNDays,
  orderStatusShowsDeliveredDateField,
  orderStatusShowsExpectedDeliveryField,
  prototypeRowsToFormEntries,
  type GatherOrderField,
} from "./gatherOrderForm";
import { getSessionPersona, SESSION_PERSONA_CUSTOM, SESSION_PERSONAS } from "./sessionPersonas";
import "./App.css";
import "./cai-phone.css";

type Phase = "gather" | "welcome" | "chat";

/** LLM-written lead for the return / exchange panel (not hardcoded marketing lines). */
type ReturnFlowLead = { headline: string; body: string };

/** Injected into ### Order history when the session has parseable order rows (kept in sync with `server/orderContextBundle.js`). */
const ORDER_HISTORY_CARDS_ONLY_HINT = `The parent's recent order row(s) are shown as interactive order cards in this app when you include a \`cai-orders\` block. Do not list, bullet, number, or repeat individual orders, product names, URLs, or order dates in your replies—the cards and that fence are the only place for that detail.`;

function mergeSessionContext(
  parent: string,
  pet: string,
  orderHistoryText: string,
  browsingHistoryText: string
) {
  const p = parent.trim() || "(none provided)";
  const pe = pet.trim() || "(none provided)";
  const stripped = stripStructuredOrderBlockFromShoppingText(orderHistoryText).trim();
  const orders = parseOrderHistoryFromShoppingText(orderHistoryText);
  let orderBlock: string;
  if (orders.length > 0) {
    orderBlock = ORDER_HISTORY_CARDS_ONLY_HINT;
  } else if (stripped) {
    orderBlock = stripped;
  } else {
    orderBlock = "(none provided)";
  }
  const browseBlock = browsingHistoryText.trim() || "(none provided)";
  return `### Pet parent profile\n${p}\n\n### Pet profile\n${pe}\n\n### Order history\n${orderBlock}\n\n### Browsing history\n${browseBlock}`;
}

/** Figma 3619:4232 “Chat prototype buttons” — Chirp Button Medium Action fullWidth, secondary + primary. */
function ChatPrototypeWelcomeButtons(props: {
  welcomeLoading: boolean;
  onBack: () => void;
  onStart: () => void;
}) {
  const { welcomeLoading, onBack, onStart } = props;
  return (
    <div className="chat-prototype-buttons" data-node-id="3619:4232" data-name="Chat prototype buttons">
      <button
        type="button"
        className="chat-prototype-buttons__btn chat-prototype-buttons__btn--secondary"
        onClick={onBack}
        disabled={welcomeLoading}
      >
        Back to edit context
      </button>
      <button type="button" className="chat-prototype-buttons__btn chat-prototype-buttons__btn--primary" onClick={onStart}>
        Start chatting
      </button>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("gather");
  const [parentProfile, setParentProfile] = useState("");
  const [petProfile, setPetProfile] = useState("");
  const [orderEntries, setOrderEntries] = useState<GatherOrderField[]>(() => [createEmptyGatherOrderField()]);
  const [browsingHistoryText, setBrowsingHistoryText] = useState("");
  const [context, setContext] = useState("");
  const [welcomeRaw, setWelcomeRaw] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  /** Figma 3288:29321 — order card tapped; UI shows confirmation + intents until cleared or a chip is sent. */
  const [orderPick, setOrderPick] = useState<OrderPickState | null>(null);
  /** Figma 3066:38124 — return card after “Start a return or exchange” chip. */
  const [returnFlowOrder, setReturnFlowOrder] = useState<CaiOrderItem | null>(null);
  const [returnFlowLead, setReturnFlowLead] = useState<ReturnFlowLead | null>(null);
  const [returnFlowLeadLoading, setReturnFlowLeadLoading] = useState(false);
  const [input, setInput] = useState("");
  const [welcomeLoading, setWelcomeLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iphonePreview, setIphonePreview] = useState(true);
  /** With phone preview in Chat: whether the workbench session context + side panel is visible. */
  const [sessionContextPanelOpen, setSessionContextPanelOpen] = useState(true);
  /** Gather panel: on = first meeting + Cai may introduce themself; off = welcome back, no re-intro. */
  const [firstTimeExperienceWithCai, setFirstTimeExperienceWithCai] = useState(true);
  /** Gather: pre-filled persona vs typing your own (`sessionPersonas.ts`). */
  const [sessionPersonaId, setSessionPersonaId] = useState<string>(SESSION_PERSONA_CUSTOM);

  /** From gather Order history: at least one row with product + placed date in the last 10 days. */
  const getHelpWithOrderFirst = useMemo(
    () => hasOrderPlacedInLastNDays(orderEntries, 10),
    [orderEntries]
  );

  function applySessionPersona(id: string) {
    if (id === SESSION_PERSONA_CUSTOM) {
      setSessionPersonaId(SESSION_PERSONA_CUSTOM);
      return;
    }
    const p = getSessionPersona(id);
    if (!p) return;
    setSessionPersonaId(id);
    setParentProfile(p.parentProfile);
    setPetProfile(p.petProfile);
    setOrderEntries(prototypeRowsToFormEntries(parseOrderHistoryFromShoppingText(p.orderHistory)));
    setBrowsingHistoryText(p.browsingHistory);
  }

  function updateOrderField(
    index: number,
    patch: Partial<
      Pick<
        GatherOrderField,
        "productOrLink" | "placedDate" | "deliveredDate" | "status" | "expectedDelivery" | "autoship"
      >
    >
  ) {
    setSessionPersonaId(SESSION_PERSONA_CUSTOM);
    setOrderEntries((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addOrderRow() {
    setSessionPersonaId(SESSION_PERSONA_CUSTOM);
    setOrderEntries((rows) => (rows.length < 5 ? [...rows, createEmptyGatherOrderField()] : rows));
  }

  function removeOrderRow(index: number) {
    setSessionPersonaId(SESSION_PERSONA_CUSTOM);
    setOrderEntries((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  }

  async function generateWelcome() {
    setError(null);
    setWelcomeLoading(true);
    try {
      const res = await fetch(apiUrl("/api/welcome"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentProfile,
          petProfile,
          orderHistory: buildOrderHistoryString(orderEntries),
          browsingHistory: browsingHistoryText,
          firstTimeExperienceWithCai,
          orderPlacedInLast10Days: getHelpWithOrderFirst,
        }),
      });
      const data = await readJson<{ welcome?: string; error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setWelcomeRaw(stripWelcomeMarkdownBold(stripCaiStructuredFences(data.welcome ?? "")));
      setPhase("welcome");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setWelcomeLoading(false);
    }
  }

  function startChatting() {
    setContext(
      mergeSessionContext(
        parentProfile,
        petProfile,
        buildOrderHistoryString(orderEntries),
        browsingHistoryText
      )
    );
    setMessages([{ role: "assistant", content: welcomeRaw }]);
    setOrderPick(null);
    setReturnFlowOrder(null);
    setReturnFlowLead(null);
    setReturnFlowLeadLoading(false);
    setPhase("chat");
    setError(null);
    if (iphonePreview) {
      setSessionContextPanelOpen(false);
    }
  }

  function backToGather() {
    setPhase("gather");
    setError(null);
  }

  function startOver() {
    setPhase("gather");
    setMessages([]);
    setOrderPick(null);
    setReturnFlowOrder(null);
    setReturnFlowLead(null);
    setReturnFlowLeadLoading(false);
    setWelcomeRaw("");
    setInput("");
    setError(null);
    setFirstTimeExperienceWithCai(true);
    setOrderEntries([createEmptyGatherOrderField()]);
    setBrowsingHistoryText("");
    setSessionContextPanelOpen(true);
  }

  async function sendUserText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chatLoading || returnFlowLeadLoading) return;

    const orderForReturnFlow =
      trimmed === START_RETURN_OR_EXCHANGE_CHIP && orderPick ? orderPick.order : null;

    const preserveOrderPickForReturnFlow =
      Boolean(orderForReturnFlow) && trimmed === START_RETURN_OR_EXCHANGE_CHIP;

    if (!preserveOrderPickForReturnFlow) {
      setOrderPick(null);
    }

    if (orderForReturnFlow) {
      setReturnFlowOrder(orderForReturnFlow);
    } else if (trimmed !== START_RETURN_OR_EXCHANGE_CHIP) {
      setReturnFlowOrder(null);
      setReturnFlowLead(null);
      setReturnFlowLeadLoading(false);
    }

    setError(null);

    const userMessage: ChatMessage = { role: "user", content: trimmed, sentAt: Date.now() };
    const messagesForRequest: ChatMessage[] = [...messages, userMessage];

    /** Order chosen; panel microcopy comes from Cai (JSON)—no extra assistant bubble in the thread. */
    if (orderForReturnFlow && trimmed === START_RETURN_OR_EXCHANGE_CHIP) {
      setMessages(messagesForRequest);
      setInput("");
      setReturnFlowLead(null);
      setReturnFlowLeadLoading(true);
      try {
        const orderRowsForApi = formEntriesToPrototypeRows(orderEntries);
        const res = await fetch(apiUrl("/api/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesForApi(messagesForRequest),
            context: context.trim() || undefined,
            orderHistory: orderRowsForApi,
            returnExchangePanelCopy: true,
          }),
        });
        const data = await readJson<{ headline?: string; body?: string; error?: string }>(res);
        if (!res.ok) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }
        const headline = data.headline?.trim();
        const body = data.body?.trim();
        if (!headline || !body) {
          throw new Error(data.error || "Return panel copy was incomplete.");
        }
        setReturnFlowLead({ headline, body });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setReturnFlowLead(null);
      } finally {
        setReturnFlowLeadLoading(false);
      }
      return;
    }

    const orderRowsForApi = formEntriesToPrototypeRows(orderEntries);
    const showOrderHelpLeadIn =
      wantsOrderHelpFromUser(trimmed) && orderRowsForApi.length > 0;

    setMessages(
      showOrderHelpLeadIn
        ? [...messagesForRequest, { role: "assistant", content: ORDER_HELP_LOADING_LEAD_IN }]
        : messagesForRequest
    );
    setInput("");
    setChatLoading(true);

    try {
      const res = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForApi(messagesForRequest),
          context: context.trim() || undefined,
          orderHistory: orderRowsForApi,
        }),
      });
      const data = await readJson<{ reply?: string; error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const reply = data.reply ?? "";
      setMessages((prev) => {
        if (!showOrderHelpLeadIn) {
          return [...prev, { role: "assistant", content: reply }];
        }
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content === ORDER_HELP_LOADING_LEAD_IN) {
          return [
            ...prev.slice(0, -1),
            {
              role: "assistant",
              content: `${ORDER_HELP_LOADING_LEAD_IN}\n\n${stripRedundantOrderHelpModelEcho(reply.trim())}`,
            },
          ];
        }
        return [...prev, { role: "assistant", content: reply }];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      if (showOrderHelpLeadIn) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.content === ORDER_HELP_LOADING_LEAD_IN) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      }
    } finally {
      setChatLoading(false);
    }
  }

  function onSubmitChat(e: FormEvent) {
    e.preventDefault();
    void sendUserText(input);
  }

  function openChewyOrdersAccount() {
    window.open("https://www.chewy.com/app/account/orders", "_blank", "noopener,noreferrer");
  }

  const stepLabel =
    phase === "gather" ? "Step 1 · Gather context" : phase === "welcome" ? "Step 2 · Your welcome" : "Chat";

  const showWorkbenchChatThread = !(iphonePreview && phase === "chat");

  const welcomePhoneCentered = iphonePreview && phase === "welcome";
  const phoneChatFocusMode = iphonePreview && phase === "chat" && !sessionContextPanelOpen;
  const workbenchPhoneSoloLayout = welcomePhoneCentered || phoneChatFocusMode;

  const workbenchHeader = (
    <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            C
          </span>
          <div>
            <h1 className="title">Cai</h1>
            <p className="subtitle">
              Shopping &amp; pet care prototype · <span className="step-pill">{stepLabel}</span>
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-text" onClick={() => setIphonePreview((v) => !v)}>
            {iphonePreview ? "Exit phone preview" : "iPhone 14 preview"}
          </button>
          {phase === "chat" && (
            <button type="button" className="btn-text" onClick={startOver}>
              New session
            </button>
          )}
        </div>
      </header>
  );

  const workbenchMain = (
      <main className="main">
        {phase === "gather" && (
          <section className="panel gather-panel" aria-labelledby="gather-title">
            <h2 id="gather-title" className="panel-title">
              Tell Cai about this session
            </h2>
            <p className="panel-lead">
              Pick a preset persona or add your own details by choosing <strong>Custom</strong>.
            </p>

            <div className="field-block persona-picker" role="radiogroup" aria-labelledby="persona-picker-label">
              <p className="label" id="persona-picker-label">
                Session preset
              </p>
              <p className="label-hint" id="persona-picker-hint">
                Selecting a persona replaces the main text areas below. Editing any field switches you to Custom.
              </p>
              <div className="persona-options" aria-describedby="persona-picker-hint">
                {SESSION_PERSONAS.map((p) => (
                  <label key={p.id} className="persona-option">
                    <input
                      type="radio"
                      name="sessionPersona"
                      value={p.id}
                      checked={sessionPersonaId === p.id}
                      onChange={() => applySessionPersona(p.id)}
                    />
                    <span>{p.title}</span>
                  </label>
                ))}
                <label className="persona-option">
                  <input
                    type="radio"
                    name="sessionPersona"
                    value={SESSION_PERSONA_CUSTOM}
                    checked={sessionPersonaId === SESSION_PERSONA_CUSTOM}
                    onChange={() => applySessionPersona(SESSION_PERSONA_CUSTOM)}
                  />
                  <span>Custom (type your own)</span>
                </label>
              </div>
            </div>

            <div className="gather-session-divider" aria-hidden="true">
              <div className="gather-session-divider__line" />
            </div>

            <div className="field-block session-first-time-block">
              <div className="session-first-time-row">
                <div className="session-first-time-text">
                  <p className="label" id="gather-first-time-label">
                    First-time experience with Cai
                  </p>
                  <p className="label-hint" id="gather-first-time-hint">
                    When on, the welcome feels like a first meeting—Cai may briefly introduce who they are. When off, it
                    feels like they&apos;re back—warm &quot;welcome back&quot; energy without re-introducing Cai.
                  </p>
                </div>
                <label className="session-switch" htmlFor="gather-first-time-input">
                  <input
                    id="gather-first-time-input"
                    type="checkbox"
                    className="session-switch-input"
                    checked={firstTimeExperienceWithCai}
                    onChange={(e) => setFirstTimeExperienceWithCai(e.target.checked)}
                    aria-labelledby="gather-first-time-label"
                    aria-describedby="gather-first-time-hint"
                  />
                  <span className="session-switch-track" aria-hidden>
                    <span className="session-switch-thumb" />
                  </span>
                </label>
              </div>
            </div>

            {iphonePreview && (
              <p className="hint gather-phone-hint">
                With <strong>iPhone preview</strong> on, these fields stay in the workbench; the phone shows the welcome
                after you generate it, then the full chat thread once you start chatting.
              </p>
            )}

            <div className="field-stack">
              <div className="field-block">
                <label className="label" htmlFor="parent">
                  Pet parent profile
                </label>
                <p className="label-hint">Name, city/region if relevant, preferences, household, Autoship habits, etc.</p>
                <textarea
                  id="parent"
                  className="textarea"
                  rows={4}
                  placeholder="Example: Jamie, prefers grain-inclusive diets, two cats and one dog in the home."
                  value={parentProfile}
                  onChange={(e) => {
                    setSessionPersonaId(SESSION_PERSONA_CUSTOM);
                    setParentProfile(e.target.value);
                  }}
                />
              </div>

              <div className="field-block">
                <label className="label" htmlFor="pet">
                  Pet profile <span className="optional">(optional)</span>
                </label>
                <p className="label-hint">Pet names, species, breed, age, weight, sensitivities, vet notes the parent shared.</p>
                <textarea
                  id="pet"
                  className="textarea"
                  rows={4}
                  placeholder="Example: Luna — 4-year-old domestic shorthair, indoor, picky with wet food."
                  value={petProfile}
                  onChange={(e) => {
                    setSessionPersonaId(SESSION_PERSONA_CUSTOM);
                    setPetProfile(e.target.value);
                  }}
                />
              </div>

              <div className="field-block" aria-describedby="order-history-hint">
                <p className="label" id="order-history-label">
                  Order history
                </p>
                <div className="order-history-hint" id="order-history-hint">
                  <p className="order-history-hint__lead">Add up to 5 orders.</p>
                  <details className="order-history-hint__details">
                    <summary className="order-history-hint__summary">
                      <span className="visually-hidden">How these fields work</span>
                      <span className="order-history-hint__icon" aria-hidden>
                        i
                      </span>
                    </summary>
                    <div className="order-history-hint__panel">
                      <p>
                        Each order needs a <strong>product or PDP link</strong> and a <strong>placed date</strong> to drive in-thread{" "}
                        <strong>order cards</strong> during order help. For a <strong>Chewy PDP URL</strong> (
                        <code>https://www.chewy.com/…</code>), the demo API fetches the product name and image for the cards. Mark{" "}
                        <strong>Autoship</strong> per order. For <strong>Processing</strong>, <strong>In-transit</strong>, or{" "}
                        <strong>Delayed</strong> orders you can add an optional <strong>expected delivery date</strong>; for{" "}
                        <strong>Delivered</strong>, use <strong>Delivered on</strong> when you want a specific arrival date on cards.{" "}
                        <strong>Cancelled</strong> orders omit delivery dates. The{" "}
                        <strong>structured</strong> JSON is generated automatically for the session bundle and order help. If a placed
                        date falls in the <strong>last 10 days</strong>, the welcome screen prepends{" "}
                        <strong>Get help with an order</strong> as the first prompt chip.
                      </p>
                    </div>
                  </details>
                </div>

                <div className="gather-orders" role="list">
                  {orderEntries.map((ord, i) => (
                    <div
                      key={ord.id}
                      className="gather-order"
                      role="listitem"
                      aria-labelledby={`order-block-title-${ord.id}`}
                    >
                      <div className="gather-order-header">
                        <h3 className="gather-order-title" id={`order-block-title-${ord.id}`}>
                          Order {i + 1}
                        </h3>
                        {orderEntries.length > 1 && (
                          <button
                            type="button"
                            className="btn-text gather-order-remove"
                            onClick={() => removeOrderRow(i)}
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="gather-order-grid">
                        <div>
                          <label className="label label--compact" htmlFor={`order-product-${ord.id}`}>
                            Chewy PDP link or product name
                          </label>
                          <textarea
                            id={`order-product-${ord.id}`}
                            className="textarea"
                            rows={2}
                            placeholder="Product name or https://www.chewy.com/…"
                            value={ord.productOrLink}
                            onChange={(e) => updateOrderField(i, { productOrLink: e.target.value })}
                          />
                        </div>
                        <div className="gather-order-status-delivery">
                          <div>
                            <label className="label label--compact" htmlFor={`order-status-${ord.id}`}>
                              Order status
                            </label>
                            <select
                              id={`order-status-${ord.id}`}
                              className="input input--select"
                              value={ord.status}
                              onChange={(e) => {
                                const next = e.target.value;
                                const patch: Partial<GatherOrderField> = { status: next };
                                if (next === "Delivered") {
                                  patch.expectedDelivery = "";
                                } else if (next === "Cancelled") {
                                  patch.deliveredDate = "";
                                  patch.expectedDelivery = "";
                                } else if (orderStatusShowsExpectedDeliveryField(next)) {
                                  patch.deliveredDate = "";
                                }
                                updateOrderField(i, patch);
                              }}
                            >
                              {GATHER_ORDER_STATUS_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div
                          className={
                            orderStatusShowsDeliveredDateField(ord.status) ||
                            orderStatusShowsExpectedDeliveryField(ord.status)
                              ? "gather-order-dates-row"
                              : "gather-order-dates-row gather-order-dates-row--single"
                          }
                        >
                          <div>
                            <label className="label label--compact" htmlFor={`order-date-${ord.id}`}>
                              Order placed date
                            </label>
                            <input
                              id={`order-date-${ord.id}`}
                              className="input input--date"
                              type="date"
                              value={ord.placedDate}
                              onChange={(e) => updateOrderField(i, { placedDate: e.target.value })}
                            />
                          </div>
                          {orderStatusShowsDeliveredDateField(ord.status) ? (
                            <div>
                              <label className="label label--compact" htmlFor={`order-delivered-${ord.id}`}>
                                Delivered on (optional)
                              </label>
                              <input
                                id={`order-delivered-${ord.id}`}
                                className="input input--date"
                                type="date"
                                value={ord.deliveredDate}
                                onChange={(e) => updateOrderField(i, { deliveredDate: e.target.value })}
                              />
                            </div>
                          ) : null}
                          {orderStatusShowsExpectedDeliveryField(ord.status) ? (
                            <div>
                              <label className="label label--compact" htmlFor={`order-expected-${ord.id}`}>
                                Expected delivery date (optional)
                              </label>
                              <input
                                id={`order-expected-${ord.id}`}
                                className="input"
                                type="text"
                                placeholder="e.g. Apr 25 or Friday"
                                value={ord.expectedDelivery}
                                onChange={(e) => updateOrderField(i, { expectedDelivery: e.target.value })}
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="session-first-time-block gather-order-autoship-block">
                          <div className="session-first-time-row">
                            <div className="session-first-time-text">
                              <p className="label label--compact" id={`order-autoship-label-${ord.id}`}>
                                Autoship
                              </p>
                              <p className="label-hint" id={`order-autoship-hint-${ord.id}`}>
                                On when this purchase is on Autoship; off for one-time orders.
                              </p>
                            </div>
                            <label className="session-switch" htmlFor={`order-autoship-${ord.id}`}>
                              <input
                                id={`order-autoship-${ord.id}`}
                                type="checkbox"
                                className="session-switch-input"
                                checked={ord.autoship}
                                onChange={(e) => updateOrderField(i, { autoship: e.target.checked })}
                                aria-labelledby={`order-autoship-label-${ord.id}`}
                                aria-describedby={`order-autoship-hint-${ord.id}`}
                              />
                              <span className="session-switch-track" aria-hidden>
                                <span className="session-switch-thumb" />
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="gather-orders-toolbar">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={addOrderRow}
                    disabled={orderEntries.length >= 5}
                  >
                    {orderEntries.length >= 5 ? "Maximum 5 orders" : "Add an order"}
                  </button>
                </div>
              </div>

              <div className="field-block">
                <label className="label" htmlFor="browsing-history">
                  Browsing history
                </label>
                <p className="label-hint" id="browsing-history-hint">
                  Categories browsed, search queries, PDP views, and other non-order signals.
                </p>
                <textarea
                  id="browsing-history"
                  className="textarea"
                  rows={3}
                  placeholder="Example: searched senior dog food; viewed orthopedic beds; saved freeze-dried toppers."
                  value={browsingHistoryText}
                  onChange={(e) => {
                    setSessionPersonaId(SESSION_PERSONA_CUSTOM);
                    setBrowsingHistoryText(e.target.value);
                  }}
                  aria-describedby="browsing-history-hint"
                />
              </div>
            </div>

            {error && <div className="banner error">{error}</div>}

            <div className="actions-row">
              <button
                type="button"
                className="send send-wide"
                onClick={() => void generateWelcome()}
                disabled={welcomeLoading}
              >
                {welcomeLoading ? "Generating welcome…" : "Generate personalized welcome"}
              </button>
            </div>
          </section>
        )}

        {phase === "welcome" && !welcomePhoneCentered && (
          <section className="panel welcome-panel" aria-label="Welcome actions">
            {error && <div className="banner error">{error}</div>}
            <ChatPrototypeWelcomeButtons welcomeLoading={welcomeLoading} onBack={backToGather} onStart={startChatting} />
          </section>
        )}

        {phase === "chat" && (
          <>
            <section className="panel context-panel" aria-label="Session context sent with each message">
              <label className="label" htmlFor="ctx">
                Session context (editable)
              </label>
              <textarea
                id="ctx"
                className="textarea"
                rows={5}
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
              <p className="hint">
                Built from your four context blocks when you clicked &quot;Start chatting.&quot; Cai receives this on every reply
                when it helps. It treats browsing and pasted context as hints, not certainty—and it won&apos;t push for pet
                details until the parent asks about their pet.
              </p>
            </section>

            <section className="panel chat-panel" aria-label="Chat">
              {showWorkbenchChatThread ? (
                <>
                  <div className="thread">
                    {messages.map((m, i) => {
                      const interimOrderHelpLeadIn =
                        m.role === "assistant" &&
                        chatLoading &&
                        m.content === ORDER_HELP_LOADING_LEAD_IN &&
                        i === messages.length - 1;

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
                      } =
                        m.role === "assistant"
                          ? interimOrderHelpLeadIn
                            ? {
                                body: "",
                                bodyAfterVet: undefined,
                                chips: [],
                                products: null,
                                orders: null,
                                recommendationRationale: undefined,
                                vetIngress: false,
                                vetWaitSeconds: undefined,
                                vetCardIntro: undefined,
                              }
                            : parseAssistantMessage(m.content)
                          : {
                              body: m.content,
                              bodyAfterVet: undefined,
                              chips: [],
                              products: null,
                              orders: null,
                              recommendationRationale: undefined,
                              vetIngress: false,
                              vetWaitSeconds: undefined,
                              vetCardIntro: undefined,
                            };
                      const sectionTitle = products?.heading?.trim() || "Recommendation";
                      const ordersSectionTitle = orders?.heading?.trim();
                      return (
                        <div key={i} className={`bubble-row ${m.role}`}>
                          <div className="bubble">
                            <div className="bubble-meta">{m.role === "user" ? "You" : "Cai"}</div>
                            {interimOrderHelpLeadIn ? (
                              <div className="bubble-body">
                                <OrderHelpLeadInSerial variant="panel" />
                              </div>
                            ) : body.trim() ? (
                              <div className="bubble-body">
                                <CaiAssistantLeadContent text={body} variant="panel" />
                              </div>
                            ) : null}
                            {m.role === "assistant" && vetIngress ? (
                              <ConnectWithVetIngressCard waitSeconds={vetWaitSeconds} intro={vetCardIntro} />
                            ) : null}
                            {m.role === "assistant" && bodyAfterVet?.trim() ? (
                              <div className="bubble-body cai-msg-ai-body-after-vet">
                                <CaiAssistantLeadContent text={bodyAfterVet} variant="panel" />
                              </div>
                            ) : null}
                            {m.role === "assistant" && orders ? (
                              <section className="cai-recommendation-section" aria-label="Recent orders">
                                {ordersSectionTitle ? (
                                  <h3 className="cai-recommendation-section__title">{ordersSectionTitle}</h3>
                                ) : null}
                                {orderPick && orderPick.messageIndex === i ? (
                                  <CaiOrderPickFollowup
                                    variant="panel"
                                    order={orderPick.order}
                                    petParentName={extractPetParentDisplayName(parentProfile)}
                                    petProfile={petProfile}
                                    pickedAt={orderPick.pickedAt}
                                    chatLoading={chatLoading || returnFlowLeadLoading}
                                    hideIntentChips={Boolean(returnFlowOrder)}
                                    onDifferentOrder={() => {
                                      setOrderPick(null);
                                      setReturnFlowOrder(null);
                                      setReturnFlowLead(null);
                                      setReturnFlowLeadLoading(false);
                                    }}
                                    onIntentChip={(t) => void sendUserText(t)}
                                  />
                                ) : (
                                  <CaiOrderShowcase
                                    block={orders}
                                    onSelectOrder={(o) => {
                                      setReturnFlowOrder(null);
                                      setReturnFlowLead(null);
                                      setReturnFlowLeadLoading(false);
                                      setOrderPick({ messageIndex: i, order: o, pickedAt: Date.now() });
                                    }}
                                  />
                                )}
                              </section>
                            ) : null}
                            {m.role === "assistant" && products ? (
                              <section className="cai-recommendation-section" aria-label="Product recommendation">
                                <h3 className="cai-recommendation-section__title">{sectionTitle}</h3>
                                <CaiProductShowcase block={products} suppressHeading />
                                {recommendationRationale?.trim() ? (
                                  <div className="bubble-body cai-recommendation-section__why">{recommendationRationale}</div>
                                ) : null}
                              </section>
                            ) : null}
                            {m.role === "assistant" && chips.length > 0 && (
                              <div className="inline-chips" aria-label="Suggested replies">
                                {chips.map((c, idx) => (
                                  <button
                                    key={`${idx}-${c}`}
                                    type="button"
                                    className="chip"
                                    disabled={chatLoading || returnFlowLeadLoading}
                                    onClick={() => void sendUserText(c)}
                                  >
                                    {c}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {returnFlowOrder ? (
                      <div className="bubble-row assistant">
                        <div className="bubble">
                          <div className="bubble-meta">Cai</div>
                          <CaiReturnExchangePanel
                            variant="panel"
                            order={returnFlowOrder}
                            leadLoading={returnFlowLeadLoading}
                            headline={returnFlowLead?.headline ?? null}
                            body={returnFlowLead?.body ?? null}
                            actionsDisabled={chatLoading}
                            onCareTeamChip={() => void sendUserText(RETURN_FLOW_CARE_TEAM_CHIP)}
                            onStartReturnNow={openChewyOrdersAccount}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {error && <div className="banner error">{error}</div>}
                  <form className="composer" onSubmit={onSubmitChat}>
                    <input
                      className="input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask Cai anything…"
                      autoComplete="off"
                      disabled={chatLoading || returnFlowLeadLoading}
                    />
                    <button className="send" type="submit" disabled={chatLoading || returnFlowLeadLoading || !input.trim()}>
                      {chatLoading || returnFlowLeadLoading ? "Sending…" : "Send"}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <p className="hint">
                    The full conversation (welcome through each reply) scrolls inside the phone preview. Edit session
                    context above; send messages from the phone composer.
                  </p>
                  {error && <div className="banner error">{error}</div>}
                </>
              )}
            </section>
          </>
        )}
      </main>
  );

  const layoutInner = (
    <>
      {workbenchHeader}
      {workbenchMain}
    </>
  );

  return iphonePreview ? (
    <div className="device-workbench">
      <div className="layout layout--workbench device-workbench-top">
        {workbenchHeader}
        {welcomePhoneCentered ? (
          <div className="device-workbench-welcome-toolbar">
            {error ? (
              <div className="banner error" role="alert">
                {error}
              </div>
            ) : null}
            <ChatPrototypeWelcomeButtons welcomeLoading={welcomeLoading} onBack={backToGather} onStart={startChatting} />
          </div>
        ) : null}
        {phase === "chat" && (
          <div className="session-context-toggle-wrap">
            <button
              type="button"
              className="btn-text"
              id="session-context-toggle"
              onClick={() => setSessionContextPanelOpen((o) => !o)}
              aria-expanded={sessionContextPanelOpen}
              aria-controls="workbench-session-panel"
            >
              {sessionContextPanelOpen ? "Hide session context" : "Show session context"}
            </button>
          </div>
        )}
        {phase === "chat" && phoneChatFocusMode && error ? (
          <div className="banner error device-workbench-inline-error" role="alert">
            {error}
          </div>
        ) : null}
      </div>
      <div className={`workbench-split${workbenchPhoneSoloLayout ? " workbench-split--session-collapsed" : ""}`}>
        <div className="workbench-column workbench-column--session" id="workbench-session-panel">
          {!workbenchPhoneSoloLayout ? <div className="layout layout--workbench">{workbenchMain}</div> : null}
        </div>
        <div className="phone-column">
      <div
        className="device-shell"
        role="region"
        aria-label="Phone preview: Cai chat shell (Figma), 390 by 844 CSS pixels"
      >
        <div className="device-screen device-screen--cai">
          <div className="device-screen-fill">
            <CaiPhoneScreen
              phase={phase}
              chatInput={input}
              onChatInputChange={setInput}
              onSend={() => void sendUserText(input)}
              chatLoading={chatLoading || returnFlowLeadLoading}
            >
              {phase === "chat" ? (
                welcomeRaw.trim() ? (
                  <CaiPhoneThread
                    welcomeText={welcomeRaw}
                    messages={messages}
                    petParentName={extractPetParentDisplayName(parentProfile)}
                    petProfile={petProfile}
                    orderPick={orderPick}
                    onOrderCardSelect={(messageIndex, order) => {
                      setReturnFlowOrder(null);
                      setReturnFlowLead(null);
                      setReturnFlowLeadLoading(false);
                      setOrderPick({ messageIndex, order, pickedAt: Date.now() });
                    }}
                    onOrderPickClear={() => {
                      setOrderPick(null);
                      setReturnFlowOrder(null);
                      setReturnFlowLead(null);
                      setReturnFlowLeadLoading(false);
                    }}
                    getHelpWithOrderFirst={getHelpWithOrderFirst}
                    onChipSelect={(t) => void sendUserText(t)}
                    chatLoading={chatLoading || returnFlowLeadLoading}
                    returnFlowOrder={returnFlowOrder}
                    returnFlowLeadLoading={returnFlowLeadLoading}
                    returnFlowHeadline={returnFlowLead?.headline ?? null}
                    returnFlowBody={returnFlowLead?.body ?? null}
                    onReturnCareTeamChip={() => void sendUserText(RETURN_FLOW_CARE_TEAM_CHIP)}
                    onReturnStartNow={openChewyOrdersAccount}
                  />
                ) : (
                  <PhoneWelcomePlaceholder />
                )
              ) : welcomeRaw.trim() ? (
                <WelcomePhoneContent text={welcomeRaw} getHelpWithOrderFirst={getHelpWithOrderFirst} />
              ) : (
                <PhoneWelcomePlaceholder />
              )}
            </CaiPhoneScreen>
          </div>
          <div className="device-home-bar" aria-hidden />
        </div>
      </div>
        </div>
      </div>
      <p className="device-caption">
        Phone bezel approximates iPhone 14 (390 × 844 pt). The screen scrolls like the app: welcome, then messages as you
        chat (see{" "}
        <a
          href="https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=3065-29802"
          target="_blank"
          rel="noreferrer"
        >
          Figma: Cai Shop prompt
        </a>
        ; suggested prompts match{" "}
        <a
          href="https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=3065-29722"
          target="_blank"
          rel="noreferrer"
        >
          Figma: prompt chip (3065:29722)
        </a>
        ). With iPhone preview on during <strong>Chat</strong>, the thread is on the phone; use{" "}
        <strong>Show session context</strong> to edit the bundle sent with each reply. For native safe areas, use browser{" "}
        <strong>responsive design mode</strong>.
      </p>
    </div>
  ) : (
    <div className="layout">{layoutInner}</div>
  );
}
