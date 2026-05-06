import { finalizeWelcomeChips, parseChips, stripCaiStructuredFences, stripWelcomeMarkdownBold } from "./chatUtils";
import { welcomeChipGlyph } from "./welcomeChipGlyph";

/** Figma 3065:29722 — welcome suggested prompts; never more than four. */
export const MAX_WELCOME_PROMPTS = 4;

const HEADLINE_MAX_WORDS = 6;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Split after sentence-ending punctuation (keeps ? ! . on the chunk). */
function splitIntoSentences(text: string): string[] {
  const norm = text.replace(/\s+/g, " ").trim();
  if (!norm) return [];
  return norm
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** First N words of a line; remainder is the rest (may be empty). */
function takeFirstWords(line: string, n: number): { head: string; rest: string } {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length <= n) return { head: words.join(" "), rest: "" };
  return { head: words.slice(0, n).join(" "), rest: words.slice(n).join(" ") };
}

/**
 * Figma 796:4187 — phone welcome lead stays short (~≤6 words): “Hi, Jen. I’m Cai.” / “Welcome back, Jen!”
 * Longer role lines (“your shopping and pet care companion…”) flow into the body.
 */
function splitHeadlineFromFirstBlock(firstBlock: string): { headline: string; remainder: string } {
  const raw = firstBlock.trim();
  if (!raw) return { headline: "", remainder: "" };
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const line1 = lines[0] ?? "";
  const tailLines = lines.slice(1);

  const joinRemainder = (a: string, b: string[]) => {
    const parts = [a, ...b].map((x) => x.trim()).filter(Boolean);
    return parts.join("\n\n");
  };

  if (tailLines.length > 0) {
    if (wordCount(line1) <= HEADLINE_MAX_WORDS) {
      return { headline: line1, remainder: tailLines.join("\n\n") };
    }
    const { head, rest } = takeFirstWords(line1, HEADLINE_MAX_WORDS);
    return { headline: head, remainder: joinRemainder(rest, tailLines) };
  }

  // One line: if the full greeting fits the headline word budget, keep it (e.g. "Hi, Jane. I'm Cai.").
  if (wordCount(line1) <= HEADLINE_MAX_WORDS) {
    return { headline: line1, remainder: "" };
  }

  const sents = splitIntoSentences(line1);
  if (sents.length >= 2 && wordCount(sents[0]!) > 0 && wordCount(sents[0]!) <= HEADLINE_MAX_WORDS) {
    return { headline: sents[0]!, remainder: sents.slice(1).join(" ").trim() };
  }

  const { head, rest } = takeFirstWords(line1, HEADLINE_MAX_WORDS);
  return { headline: head, remainder: rest };
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

/**
 * Welcome never shows ```cai-orders``` cards — only chips. Drop model lines that tell users to tap
 * orders “below” (they are not on this screen).
 */
function proseMisleadsAboutOrdersBelow(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (!t) return false;
  const mentionsOrders = /\b(order|orders|order help)\b/.test(t);
  const pointsDown = /\bbelow\b/.test(t) || /\bdown here\b/.test(t);
  if (!mentionsOrders || !pointsDown) return false;
  return /\btap\b/.test(t) || /\bselect\b/.test(t) || /\bpick\b/.test(t) || /\bchoose\b/.test(t) || /\bone of your\b/.test(t);
}

/**
 * Welcome never shows order cards — only prompt chips. Remove stray model lines about tapping orders
 * “below” so workbench and phone stay consistent.
 */
export function stripWelcomeOrderBelowHints(text: string): string {
  if (!text.trim()) return text;
  const paras = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const out = paras
    .map((p) => {
      const sentences = p
        .split(/(?<=[.!?])\s+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const kept = sentences.filter((x) => !proseMisleadsAboutOrdersBelow(x));
      return kept.join(" ");
    })
    .map((p) => p.trim())
    .filter(Boolean);
  return out.join("\n\n");
}

/** What appears inside the iPhone bezel: Cai’s welcome (before chat turns). */
export function WelcomePhoneContent({
  text,
  onPromptSelect,
  promptsDisabled = false,
  getHelpWithOrderFirst = false,
}: {
  text: string;
  /** When set, prompts use the Figma 3065:29722 chip control and submit this label. */
  onPromptSelect?: (label: string) => void;
  promptsDisabled?: boolean;
  /** When true, an order in gather was placed in the last 10 days; first chip is “Get help with an order.” */
  getHelpWithOrderFirst?: boolean;
}) {
  const stripped = stripWelcomeMarkdownBold(stripCaiStructuredFences(text));
  const { body, chips } = parseChips(stripped);
  const welcomeChips = finalizeWelcomeChips(chips, MAX_WELCOME_PROMPTS, { getHelpWithOrderFirst });
  const main = (body || stripped).trim();
  const blocks = main.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  const first = blocks[0] ?? "";
  const { headline, remainder } = splitHeadlineFromFirstBlock(first);
  const bodyCore = [remainder, ...blocks.slice(1)].filter(Boolean).join("\n\n").trim();
  const bodyCoreClean = stripWelcomeOrderBelowHints(bodyCore);
  let { body: bodyMain, cta } = peelClosingCta(bodyCoreClean);
  if (cta && proseMisleadsAboutOrdersBelow(cta)) {
    cta = null;
  }

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
            className={`cai-prompt-chip cai-prompt-chip--rich${onPromptSelect ? "" : " cai-prompt-chip--locked"}`}
            disabled={Boolean(onPromptSelect && promptsDisabled)}
            aria-disabled={!onPromptSelect}
            tabIndex={onPromptSelect ? undefined : -1}
            onClick={onPromptSelect ? () => onPromptSelect(c) : undefined}
          >
            <span className="cai-prompt-chip__glyph" aria-hidden>
              {welcomeChipGlyph(c)}
            </span>
            <span>{c}</span>
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
