/**
 * Connect-with-a-Vet replies must still offer tappable shopping / care ingress (CHIPS) when the model
 * omits them — quick paths into product lanes that match the health concern.
 */

function hasTrailingChipsLine(text) {
  const lines = (text ?? "").trimEnd().split("\n");
  const last = lines[lines.length - 1]?.trim() ?? "";
  if (!/^CHIPS:\s*/i.test(last)) return false;
  const rest = last.replace(/^CHIPS:\s*/i, "").trim();
  return rest.length > 0;
}

/** First plausible pet name from the developer context bundle (### Pet profile). */
export function extractPetFirstNameFromContext(context) {
  if (typeof context !== "string" || !context.trim()) return "";
  const blockMatch = /###\s*Pet profile\s*\n([\s\S]*?)(?=\n###\s|$)/i.exec(context.trim());
  if (!blockMatch) return "";
  const block = blockMatch[1];
  const lines = block.split("\n");
  for (const line of lines) {
    const m = line.match(/^\s*\*{0,2}\s*(?:pet\s*)?name\*{0,2}\s*:\s*(.+)$/i);
    if (!m) continue;
    const part = m[1].replace(/\*{2}/g, "").split(/[,;|/]/)[0].trim();
    const first = (part.split(/\s+/)[0] ?? "").replace(/^[^A-Za-z0-9'-]+/, "").replace(/[^A-Za-z0-9'-]+$/, "");
    if (
      first.length >= 2 &&
      first.length <= 24 &&
      !/^(yes|no|unknown|none|dog|cat|puppy|kitten|pet|n\/a)$/i.test(first)
    ) {
      return first;
    }
  }
  return "";
}

/**
 * Build a CHIPS line from the parent's concern + assistant text (keyword buckets → shopping intents).
 * @param {string} userText latest user message
 * @param {string} reply assistant reply (may include fences)
 * @param {string} petFirstName from context, or ""
 */
export function buildCareProductIngressChips(userText, reply, petFirstName) {
  const t = `${userText || ""}\n${reply || ""}`.toLowerCase();
  /** @type {string[]} */
  const out = [];

  const add = (label) => {
    if (!label || out.length >= 3 || out.includes(label)) return;
    out.push(label);
  };

  if (/\b(poison|toxic|xylitol|chocolate|onion|garlic|raisin)\b/i.test(t)) {
    add("Sensitive stomach & recovery food");
    add("Digestive care products");
  }
  if (/\b(itch|itchy|scratch|scratching|skin|flake|dandruff|hot\s*spot|dermatitis|allerg)\b/i.test(t)) {
    add("Skin & coat shopping");
  }
  if (/\b(limp|limps|limping|lame|lameness|stiff|stiffness|hip|joint|arthrit|mobility|favoring)\b/i.test(t)) {
    add("Joint & mobility products");
  }
  if (/\b(vomit|vomiting|diarrh|loose\s+stool|constipat|digest|digestive|tummy|gassy|bloated)\b/i.test(t)) {
    add("Digestive care picks");
  }
  if (
    /\b(not eating|won'?t eat|loss of appetite|appetite|eating less|picky eat|eats less|food|meal|treats?|entice|hungry)\b/i.test(
      t,
    ) ||
    /\b(eating|eat|ate)\b/i.test(t)
  ) {
    add(petFirstName ? `Food & treats for ${petFirstName}` : "Food & appetite ideas");
  }
  if (/\b(wound|cut|scrape|bleed|bandage|first\s*aid|paw\s+pad|abrasion|gash)\b/i.test(t)) {
    add("Wound & first-aid supplies");
  }
  if (/\b(eye|ear|cough|sneeze|wheez|dental|tooth)\b/i.test(t)) {
    add("Ear, eye & dental care");
  }
  if (/\b(anxiety|stress|calm|thunder|separation)\b/i.test(t)) {
    add("Calming & behavior aids");
  }

  if (out.length === 0) {
    const tail = petFirstName
      ? `CHIPS: Shop care for ${petFirstName} | Food & supplements | Everyday health | Ask something else`
      : "CHIPS: Shop pet health & care | Food & supplements | Everyday wellness | Ask something else";
    return tail;
  }

  const fillers = petFirstName
    ? [
        `Food & supplements for ${petFirstName}`,
        "Everyday wellness picks",
        "Skin & coat essentials",
      ]
    : ["Food & supplement ideas", "Everyday wellness picks", "Skin & coat essentials"];
  for (const f of fillers) {
    add(f);
    if (out.length >= 3) break;
  }

  if (!out.includes("Ask something else")) out.push("Ask something else");
  return `CHIPS: ${out.join(" | ")}`;
}

/**
 * If the reply includes ```cai-vet-ingress``` and no trailing CHIPS line, append product-oriented CHIPS
 * derived from the latest user message (and reply), so parents always get quick ingress after the card.
 * @param {string} reply
 * @param {string} [context] developer bundle — optional pet name for chip labels
 * @param {string} [latestUserText] latest user turn — drives which product lanes to surface
 * @returns {string}
 */
export function ensureVetAlternatePathChips(reply, context, latestUserText) {
  const raw = reply ?? "";
  if (!/```\s*cai-vet-ingress\b/i.test(raw)) return raw;
  if (hasTrailingChipsLine(raw)) return raw;

  const pet = extractPetFirstNameFromContext(typeof context === "string" ? context : "");
  const chips = buildCareProductIngressChips(
    typeof latestUserText === "string" ? latestUserText : "",
    raw,
    pet,
  );
  return `${raw.trimEnd()}\n\n${chips}`;
}
