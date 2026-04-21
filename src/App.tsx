import { FormEvent, useEffect, useRef, useState } from "react";
import { apiUrl, readJson } from "./api";
import "./App.css";

type Role = "user" | "assistant";

type ChatMessage = { role: Role; content: string };

type Phase = "gather" | "welcome" | "chat";

function mergeSessionContext(parent: string, pet: string, shop: string) {
  const p = parent.trim() || "(none provided)";
  const pe = pet.trim() || "(none provided)";
  const s = shop.trim() || "(none provided)";
  return `### Pet parent profile\n${p}\n\n### Pet profile\n${pe}\n\n### Shopping & browsing history\n${s}`;
}

function parseChips(text: string): { body: string; chips: string[] } {
  const lines = text.trimEnd().split("\n");
  const last = lines[lines.length - 1]?.trim() ?? "";
  const prefix = "CHIPS:";
  if (last.startsWith(prefix)) {
    const rest = last.slice(prefix.length).trim();
    const chips = rest
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean);
    const body = lines.slice(0, -1).join("\n").trimEnd();
    return { body, chips };
  }
  return { body: text, chips: [] };
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
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, chatLoading, phase]);

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
        }),
      });
      const data = await readJson<{ welcome?: string; error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setWelcomeRaw(data.welcome ?? "");
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
  }

  async function sendUserText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chatLoading) return;

    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setChatLoading(true);

    try {
      const res = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
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

            <div className="welcome-card">
              <div className="welcome-card-head">Cai</div>
              {(() => {
                const { body, chips } = parseChips(welcomeRaw);
                return (
                  <>
                    <div className="welcome-body">{body || welcomeRaw}</div>
                    {chips.length > 0 && (
                      <div className="welcome-chips" aria-label="Suggested starters">
                        {chips.map((c, idx) => (
                          <span key={`${idx}-${c}`} className="chip chip-static">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

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
                so answers stay aligned with the profile and history you simulated.
              </p>
            </section>

            <section className="panel chat-panel" aria-label="Chat">
              <div className="thread">
                {messages.map((m, i) => {
                  const { body, chips } =
                    m.role === "assistant" ? parseChips(m.content) : { body: m.content, chips: [] };
                  return (
                    <div key={i} className={`bubble-row ${m.role}`}>
                      <div className="bubble">
                        <div className="bubble-meta">{m.role === "user" ? "You" : "Cai"}</div>
                        <div className="bubble-body">{body}</div>
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
            </section>
          </>
        )}
      </main>
    </>
  );

  return iphonePreview ? (
    <div className="device-workbench">
      <div
        className="device-shell"
        role="region"
        aria-label="Preview frame approximating iPhone 14 portrait, 390 by 844 CSS pixels"
      >
        <div className="device-notch" aria-hidden />
        <div className="device-screen">
          <div className="device-screen-scroll">
            <div className="layout layout--phone">{layoutInner}</div>
          </div>
          <div className="device-home-bar" aria-hidden />
        </div>
      </div>
      <p className="device-caption">
        Approximates iPhone 14 logical size (390 × 844 pt). For native metrics and safe areas, use
        browser <strong>responsive design mode</strong> with the same device preset.
      </p>
    </div>
  ) : (
    <div className="layout">{layoutInner}</div>
  );
}
