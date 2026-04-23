import { FormEvent, useEffect, useRef, useState } from "react";
import { apiUrl, readJson } from "./api";
import { CaiPhoneScreen } from "./CaiPhoneScreen";
import { CaiPhoneThread } from "./CaiPhoneThread";
import type { ChatMessage } from "./chatUtils";
import { CaiProductShowcase } from "./CaiProductShowcase";
import {
  extractPetParentDisplayName,
  finalizeWelcomeChips,
  messagesForApi,
  parseAssistantMessage,
  parseChips,
  stripWelcomeMarkdownBold,
} from "./chatUtils";
import { MAX_WELCOME_PROMPTS, PhoneWelcomePlaceholder, WelcomePhoneContent } from "./welcomePhone";
import "./App.css";

type Phase = "gather" | "welcome" | "chat";

function mergeSessionContext(parent: string, pet: string, shop: string) {
  const p = parent.trim() || "(none provided)";
  const pe = pet.trim() || "(none provided)";
  const s = shop.trim() || "(none provided)";
  return `### Pet parent profile\n${p}\n\n### Pet profile\n${pe}\n\n### Shopping & browsing history\n${s}`;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("gather");
  const [parentProfile, setParentProfile] = useState("");
  const [petProfile, setPetProfile] = useState("");
  const [shoppingHistory, setShoppingHistory] = useState("");
  const [context, setContext] = useState("");
  const [welcomeRaw, setWelcomeRaw] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [welcomeLoading, setWelcomeLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iphonePreview, setIphonePreview] = useState(false);
  /** Gather panel: on = first meeting + Cai may introduce themself; off = welcome back, no re-intro. */
  const [firstTimeExperienceWithCai, setFirstTimeExperienceWithCai] = useState(true);
  /** Gather panel: order placed or received in last 7 days → welcome leads with “Get help with an order”. */
  const [recentOrderWithin7Days, setRecentOrderWithin7Days] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, chatLoading, phase, welcomeRaw]);

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
          shoppingHistory,
          firstTimeExperienceWithCai,
          recentOrderWithin7Days,
        }),
      });
      const data = await readJson<{ welcome?: string; error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setWelcomeRaw(stripWelcomeMarkdownBold(data.welcome ?? ""));
      setPhase("welcome");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setWelcomeLoading(false);
    }
  }

  function startChatting() {
    setContext(mergeSessionContext(parentProfile, petProfile, shoppingHistory));
    setMessages([{ role: "assistant", content: welcomeRaw }]);
    setPhase("chat");
    setError(null);
  }

  function backToGather() {
    setPhase("gather");
    setError(null);
  }

  function startOver() {
    setPhase("gather");
    setMessages([]);
    setWelcomeRaw("");
    setInput("");
    setError(null);
    setFirstTimeExperienceWithCai(true);
    setRecentOrderWithin7Days(false);
  }

  async function sendUserText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chatLoading) return;

    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed, sentAt: Date.now() }];
    setMessages(nextMessages);
    setInput("");
    setChatLoading(true);

    try {
      const res = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForApi(nextMessages),
          context: context.trim() || undefined,
        }),
      });
      const data = await readJson<{ reply?: string; error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const reply = data.reply ?? "";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setChatLoading(false);
    }
  }

  function onSubmitChat(e: FormEvent) {
    e.preventDefault();
    void sendUserText(input);
  }

  const stepLabel =
    phase === "gather" ? "Step 1 · Gather context" : phase === "welcome" ? "Step 2 · Your welcome" : "Chat";

  const showWorkbenchChatThread = !(iphonePreview && phase === "chat");

  const layoutInner = (
    <>
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

      <main className="main">
        {phase === "gather" && (
          <section className="panel gather-panel" aria-labelledby="gather-title">
            <h2 id="gather-title" className="panel-title">
              Tell Cai about this session
            </h2>
            <p className="panel-lead">
              Paste or type mock <strong>pet parent</strong>, <strong>pet</strong>, and <strong>shopping / browsing</strong>{" "}
              signals. In a full app this would come from accounts and telemetry; here you supply it so the welcome can
              personalize. Fields can be empty—Cai will still greet you and invite you in.
            </p>

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

            <div className="field-block session-first-time-block">
              <div className="session-first-time-row">
                <div className="session-first-time-text">
                  <p className="label" id="gather-recent-order-label">
                    Recent order (last 7 days)
                  </p>
                  <p className="label-hint" id="gather-recent-order-hint">
                    When on, the welcome screen shows <strong>Get help with an order</strong> as the first suggested chip
                    (before other starters). In a full app this would come from order telemetry.
                  </p>
                </div>
                <label className="session-switch" htmlFor="gather-recent-order-input">
                  <input
                    id="gather-recent-order-input"
                    type="checkbox"
                    className="session-switch-input"
                    checked={recentOrderWithin7Days}
                    onChange={(e) => setRecentOrderWithin7Days(e.target.checked)}
                    aria-labelledby="gather-recent-order-label"
                    aria-describedby="gather-recent-order-hint"
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
                  onChange={(e) => setParentProfile(e.target.value)}
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
                  onChange={(e) => setPetProfile(e.target.value)}
                />
              </div>

              <div className="field-block">
                <label className="label" htmlFor="shop">
                  Shopping &amp; browsing history
                </label>
                <p className="label-hint">Recent orders, saved items, categories browsed, brands clicked—whatever you want to simulate.</p>
                <textarea
                  id="shop"
                  className="textarea"
                  rows={4}
                  placeholder="Example: Recently viewed freeze-dried toppers; last order included litter and dental treats."
                  value={shoppingHistory}
                  onChange={(e) => setShoppingHistory(e.target.value)}
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

        {phase === "welcome" && (
          <section className="panel welcome-panel" aria-labelledby="welcome-title">
            <h2 id="welcome-title" className="panel-title">
              Here is Cai&apos;s welcome
            </h2>
            <p className="panel-lead">This is what a pet parent would see before typing their first message.</p>

            {!iphonePreview && (
              <div className="welcome-card">
                <div className="welcome-card-head">Cai</div>
                {(() => {
                  const welcomeClean = stripWelcomeMarkdownBold(welcomeRaw);
                  const { body, chips } = parseChips(welcomeClean);
                  const welcomeChips = finalizeWelcomeChips(chips, MAX_WELCOME_PROMPTS, {
                    recentOrderWithin7Days,
                  });
                  return (
                    <>
                      <div className="welcome-body">{body || welcomeClean}</div>
                      <div className="welcome-chips" aria-label="Suggested starters and customer care">
                        {welcomeChips.map((c, idx) => (
                          <span key={`${idx}-${c}`} className="chip chip-static">
                            {c}
                          </span>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {iphonePreview && (
              <p className="hint welcome-phone-hint">
                The welcome copy is shown in the phone preview. After you start chatting, the full thread scrolls there
                too.
              </p>
            )}

            {error && <div className="banner error">{error}</div>}

            <div className="actions-row split">
              <button type="button" className="btn-secondary" onClick={backToGather} disabled={welcomeLoading}>
                Back to edit context
              </button>
              <button type="button" className="send send-wide" onClick={startChatting}>
                Start chatting
              </button>
            </div>
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
                Built from your three blocks when you clicked &quot;Start chatting.&quot; Cai receives this on every reply
                when it helps. It treats browsing and pasted context as hints, not certainty—and it won&apos;t push for pet
                details until the parent asks about their pet.
              </p>
            </section>

            <section className="panel chat-panel" aria-label="Chat">
              {showWorkbenchChatThread ? (
                <>
                  <div className="thread">
                    {messages.map((m, i) => {
                      const { body, chips, products, recommendationRationale } =
                        m.role === "assistant"
                          ? parseAssistantMessage(m.content)
                          : { body: m.content, chips: [], products: null, recommendationRationale: undefined };
                      const sectionTitle = products?.heading?.trim() || "Recommendation";
                      return (
                        <div key={i} className={`bubble-row ${m.role}`}>
                          <div className="bubble">
                            <div className="bubble-meta">{m.role === "user" ? "You" : "Cai"}</div>
                            {body.trim() ? <div className="bubble-body">{body}</div> : null}
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
                                    disabled={chatLoading}
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
                    <div ref={bottomRef} />
                  </div>
                  {error && <div className="banner error">{error}</div>}
                  <form className="composer" onSubmit={onSubmitChat}>
                    <input
                      className="input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask Cai anything…"
                      autoComplete="off"
                      disabled={chatLoading}
                    />
                    <button className="send" type="submit" disabled={chatLoading || !input.trim()}>
                      {chatLoading ? "Sending…" : "Send"}
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
    </>
  );

  return iphonePreview ? (
    <div className="device-workbench">
      <div className="workbench-split">
        <div className="workbench-column">
          <div className="layout layout--workbench">{layoutInner}</div>
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
              chatLoading={chatLoading}
            >
              {phase === "chat" ? (
                welcomeRaw.trim() ? (
                  <CaiPhoneThread
                    welcomeText={welcomeRaw}
                    messages={messages}
                    petParentName={extractPetParentDisplayName(parentProfile)}
                    recentOrderWithin7Days={recentOrderWithin7Days}
                    onChipSelect={(t) => void sendUserText(t)}
                    chatLoading={chatLoading}
                    bottomRef={bottomRef}
                  />
                ) : (
                  <PhoneWelcomePlaceholder />
                )
              ) : welcomeRaw.trim() ? (
                <WelcomePhoneContent text={welcomeRaw} recentOrderWithin7Days={recentOrderWithin7Days} />
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
        ). With iPhone preview on during <strong>Chat</strong>, the thread moves to the phone; the workbench keeps session
        context. For native safe areas, use browser <strong>responsive design mode</strong>.
      </p>
    </div>
  ) : (
    <div className="layout">{layoutInner}</div>
  );
}
