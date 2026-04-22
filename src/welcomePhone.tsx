import { finalizeWelcomeChips, parseChips } from "./chatUtils";

/** Figma 3065:29722 — welcome suggested prompts; never more than four. */
export const MAX_WELCOME_PROMPTS = 4;

/** Figma 796:4187 — at most one sentence / first line; rest joins body. */
function splitHeadlineFromFirstBlock(firstBlock: string): { headline: string; remainder: string } {
  const raw = firstBlock.trim();
  if (!raw) return { headline: "", remainder: "" };
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    return { headline: lines[0], remainder: lines.slice(1).join("\n") };
  }
  const line = lines[0] ?? "";
  if (line.length <= 120) {
    return { headline: line, remainder: "" };
  }
  const cap = line.slice(0, 120);
  const sp = cap.lastIndexOf(" ");
  const cut = sp > 40 ? sp : 120;
  return { headline: line.slice(0, cut).trim(), remainder: line.slice(cut).trim() };
}

/** Optional single-line closing question / CTA — Editorial Text-2-Strong, not 796:4187. */
function peelClosingCta(body: string): { body: string; cta: string | null } {
  const t = body.trim();
  if (!t) return { body: "", cta: null };
  const paras = t
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length < 2) return { body: t, cta: null };
  const last = paras[paras.length - 1]!;
  if (last.includes("\n")) return { body: t, cta: null };
  if (last.length > 100) return { body: t, cta: null };
  if (!/[?!]$/.test(last)) return { body: t, cta: null };
  return { body: paras.slice(0, -1).join("\n\n"), cta: last };
}

/** What appears inside the iPhone bezel: Cai’s welcome (before chat turns). */
export function WelcomePhoneContent({
  text,
  onPromptSelect,
  promptsDisabled = false,
  recentOrderWithin7Days = false,
}: {
  text: string;
  /** When set, prompts use the Figma 3065:29722 chip control and submit this label. */
  onPromptSelect?: (label: string) => void;
  promptsDisabled?: boolean;
  /** Pet parent placed or received an order in the last 7 days — first chip becomes order help. */
  recentOrderWithin7Days?: boolean;
}) {
  const { body, chips } = parseChips(text);
  const welcomeChips = finalizeWelcomeChips(chips, MAX_WELCOME_PROMPTS, { recentOrderWithin7Days });
  const main = (body || text).trim();
  const blocks = main.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  const first = blocks[0] ?? "";
  const { headline, remainder } = splitHeadlineFromFirstBlock(first);
  const bodyCore = [remainder, ...blocks.slice(1)].filter(Boolean).join("\n\n").trim();
  const { body: bodyMain, cta } = peelClosingCta(bodyCore);

  return (
    <div className="phone-welcome">
      {headline ? <p className="phone-welcome-lead cai-text-editorial-heading-2">{headline}</p> : null}
      {bodyMain ? <div className="phone-welcome-body cai-text-editorial-text-2">{bodyMain}</div> : null}
      {cta ? (
        <p className="phone-welcome-cta cai-text-editorial-text-2-strong">{cta}</p>
      ) : null}
      {!headline && !bodyMain && !cta && main ? (
        <div className="phone-welcome-body cai-text-editorial-text-2">{main}</div>
      ) : null}
      <div className="cai-msg-ai-chips phone-welcome-prompts" aria-label="Suggested starters and customer care">
        {welcomeChips.map((c, idx) => (
          <button
            key={`${idx}-${c}`}
            type="button"
            className={`cai-prompt-chip${onPromptSelect ? "" : " cai-prompt-chip--locked"}`}
            disabled={Boolean(onPromptSelect && promptsDisabled)}
            aria-disabled={!onPromptSelect}
            tabIndex={onPromptSelect ? undefined : -1}
            onClick={onPromptSelect ? () => onPromptSelect(c) : undefined}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PhoneWelcomePlaceholder() {
  return (
    <div className="phone-placeholder">
      <p>Cai&apos;s welcome will show here after you tap &quot;Generate personalized welcome.&quot;</p>
    </div>
  );
}
