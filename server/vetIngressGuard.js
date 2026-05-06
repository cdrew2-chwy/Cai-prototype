/**
 * Prototype guard: pet parents describing symptoms / “how do I treat” for their pet
 * should always see the Connect-with-a-Vet card, even if the model skips the fence.
 */

const VET_FENCE = "\n\n```cai-vet-ingress\n{}\n```";

/** Scratch posts/pads are catalog shopping, not “pet is scratching” dermatology—unless other symptoms appear. */
function isScratchSurfaceShoppingQuery(t) {
  return /\bscratch(?:ing)?(?:[\s-]+posts?|[\s-]+pads?)\b/i.test(t);
}

/** True when “scratching” reads like skin/ears/behavior, not like “scratching post” product copy. */
function hasDermatologicScratchingConcern(t) {
  return (
    /\b(itch|itchy|bald|hot\s*spot|dermatitis)\b/i.test(t) ||
    /\bscratch(?:ing|es)?\s+at\b/i.test(t) ||
    /\b(won'?t|can'?t)\s+stop\s+scratching\b/i.test(t) ||
    /\b(constantly|excessively|non-?stop)\s+scratching\b/i.test(t) ||
    /\bscratching\b.*\b(skin|paw|ear|fur|coat|bleed|raw|red)\b/i.test(t)
  );
}

/** True if the latest user message reads like a health / injury / symptom concern for a pet. */
export function petHealthUserTurnWantsVetCard(userText) {
  const t = (userText || "").trim();
  if (!t) return false;

  if (isScratchSurfaceShoppingQuery(t) && !hasDermatologicScratchingConcern(t)) {
    return false;
  }

  const signals = [
    /\b(wound|wounds|cut|cuts|scrape|scrapes|abrasion|bleed|bleeding|gash)\b/i,
    /\b(limp|lame|lameness|limping|stiffness|stiff|favoring\s+a\s+leg)\b/i,
    /\b(vomit|vomiting|threw\s+up|regurgitat|diarrh|loose\s+stool|not\s+eating|won'?t\s+eat|loss\s+of\s+appetite)\b/i,
    // "Scratching" alone often means skin; exclude "scratching post(s)" / hyphenated variants (shopping).
    /\b(itch|itchy|scratching(?![\s-]+posts?\b)|flakey|flaky|skin\s+issue)\b/i,
    /\b(lump|mass|tumor|tumour|bump)\b/i,
    /\b(seizure|collapsed?|lethargic|lethargy|won'?t\s+get\s+up)\b/i,
    /\b(cough|sneez|wheez)\b/i,
    /\b(infection|abscess|pus|hot\s+spot)\b/i,
    /\b(swollen|swelling)\b.*\b(paw|leg|joint|face|belly|abdomen)\b/i,
    /\b(paw|paws|pads?|toenail|nail)\b.*\b(hurt|hurts|pain|painful|cut|wound|red|raw|bleed|limp)\b/i,
    /\b(hurt|hurts|pain|painful|sore)\b.*\b(paw|leg|stomach|belly|back|neck)\b/i,
    /\b(how\s+(do|should)\s+i\s+treat)\b/i,
    /\b(what\s+should\s+i\s+do)\b.*\b(sick|hurt|pain|wound|limp|vomit|not\s+eating)\b/i,
    /\b(sick|ill(ness)?|unwell|something\s+wrong)\b.*\b(pet|dog|cat|puppy|kitten|she|he|her|his)\b/i,
    /\b(med|medication|medicine)\b.*\b(reaction|side\s+effect|after)\b/i,
    /\b(poison|toxic|ingest|swallowed|ate\s+(a\s+)?(raisin|chocolate|onion|xylitol))\b/i,
    /\b(discharge|red\s+eye|goopy)\b/i,
    /\b(constipated|can'?t\s+pee|trouble\s+urinat)\b/i,
  ];

  return signals.some((re) => re.test(t));
}

/**
 * If the user turn warrants the vet card and the reply has no ```cai-vet-ingress``` fence yet,
 * append the fence. Preserves a final `CHIPS:` line as the true last line.
 * @param {string} reply
 * @param {string} latestUserText
 * @returns {string}
 */
export function ensureVetIngressInReply(reply, latestUserText) {
  const raw = reply ?? "";
  if (/```\s*cai-vet-ingress\b/i.test(raw)) return raw;
  if (!petHealthUserTurnWantsVetCard(latestUserText)) return raw;

  const trimmed = raw.trimEnd();
  const lines = trimmed.split("\n");
  const lastLine = lines[lines.length - 1] ?? "";
  if (/^CHIPS:\s*/i.test(lastLine.trim())) {
    const body = lines.slice(0, -1).join("\n").trimEnd();
    return `${body}${VET_FENCE}\n${lastLine}`;
  }
  return `${trimmed}${VET_FENCE}`;
}
