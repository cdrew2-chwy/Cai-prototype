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
 * Last N user turns (chronological within the window), joined — so a final "Connect with a Vet" tap
 * still inherits symptom keywords from earlier messages.
 * @param {unknown[]} messages
 * @param {{ maxMessages?: number; maxChars?: number }} [opts]
 */
export function extractRecentUserConcernSnippet(messages, opts = {}) {
  const maxMessages = opts.maxMessages ?? 6;
  const maxChars = opts.maxChars ?? 2000;
  if (!Array.isArray(messages)) return "";
  const parts = [];
  for (let i = messages.length - 1; i >= 0 && parts.length < maxMessages; i--) {
    const m = messages[i];
    if (m?.role !== "user" || typeof m.content !== "string") continue;
    const s = m.content.trim();
    if (!s) continue;
    parts.unshift(s);
  }
  const joined = parts.join("\n");
  return joined.length > maxChars ? joined.slice(-maxChars) : joined;
}

function isFoodLaneLabel(label) {
  return /\b(food|treat|appetite|meal|supplement|nutrition|kibble|diet)\b/i.test(label);
}

function isSkinCoatLabel(label) {
  return /\bskin\b.*\bcoat\b|\bskin\s*&\s*coat\b/i.test(label);
}

/** Filler chips after a vet card should stay health/care–adjacent, not generic retail. */
function isHealthCareFillerLabel(label) {
  return /\b(wellness|otc|supplement|vitamin|hydrat|feeding|recovery|comfort\s+aids?|first-?aid|bandag|health|care|preventive)\b/i.test(
    label,
  );
}

/**
 * Build a CHIPS line from the parent's concern + assistant text (keyword buckets → shopping intents).
 * @param {string} userText latest user message
 * @param {string} reply assistant reply (may include fences)
 * @param {string} petFirstName from context, or ""
 * @param {string} [recentUserSnippet] recent user turns (see extractRecentUserConcernSnippet)
 */
export function buildCareProductIngressChips(userText, reply, petFirstName, recentUserSnippet = "") {
  const concern = `${recentUserSnippet || ""}\n${userText || ""}\n${reply || ""}`.toLowerCase();
  /** @type {string[]} */
  const out = [];

  const add = (label) => {
    if (!label || out.length >= 3 || out.includes(label)) return;
    const lower = label.toLowerCase();
    for (const existing of out) {
      if (isFoodLaneLabel(lower) && isFoodLaneLabel(existing)) return;
      if (isSkinCoatLabel(lower) && isSkinCoatLabel(existing)) return;
    }
    out.push(label);
  };

  // Order: acute / localized concerns before broad buckets (e.g. wound before loose "food" matches).
  if (/\b(poison|toxic|xylitol|chocolate|onion|garlic|raisin)\b/i.test(concern)) {
    add("Sensitive stomach & recovery food");
    add("Digestive care products");
  }
  if (/\b(wound|cut|scrape|bleed|bandage|first\s*aid|paw\s+pad|abrasion|gash)\b/i.test(concern)) {
    add("Wound & first-aid supplies");
  }
  if (/\b(limp|limps|limping|lame|lameness|stiff|stiffness|hip|joint|arthrit|mobility|favoring)\b/i.test(concern)) {
    add("Joint & mobility products");
  }
  if (/\b(itch|itchy|scratch|scratching|skin|flake|dandruff|hot\s*spot|dermatitis|allerg)\b/i.test(concern)) {
    add("Skin & coat shopping");
  }
  if (/\b(vomit|vomiting|diarrh|loose\s+stool|constipat|digest|digestive|tummy|gassy|bloated)\b/i.test(concern)) {
    add("Digestive care picks");
  }
  if (/\b(eye|ear|cough|sneeze|wheez|dental|tooth)\b/i.test(concern)) {
    add("Ear, eye & dental care");
  }
  if (/\b(anxiety|stress|calm|thunder|separation)\b/i.test(concern)) {
    add("Calming & behavior aids");
  }

  const foodish =
    /\b(not eating|won'?t eat|loss of appetite|eating less|eats less|picky eater|picky eating|entice to eat|won'?t touch (his|her|their) food)\b/i.test(
      concern,
    ) ||
    (/\b(hungry|hunger)\b/i.test(concern) && /\b(appetite|eat|food|meal)\b/i.test(concern)) ||
    (/\b(treats?\b|meals?\b|kibble)\b/i.test(concern) && /\b(appetite|diet|nutrition|picky)\b/i.test(concern)) ||
    (/\bfood\b/i.test(concern) &&
      /\b(diet|nutrition|appetite|feed|feeding|renal|kidney|sensitive stomach|weight loss|puppy food|kitten food|senior food)\b/i.test(
        concern,
      ));

  if (foodish) {
    add(petFirstName ? `Food & treats for ${petFirstName}` : "Food & appetite ideas");
  }

  if (out.length === 0) {
    const tail = petFirstName
      ? `CHIPS: Health & care for ${petFirstName} | OTC wellness picks | First-aid & bandaging | Ask something else`
      : "CHIPS: Pet health & OTC care | Wellness supplements | First-aid essentials | Ask something else";
    return tail;
  }

  const fillerPool = petFirstName
    ? [
        `OTC wellness for ${petFirstName}`,
        "Hydration & feeding support",
        "Comfort aids for recovery",
      ]
    : ["OTC wellness & supplements", "Hydration & feeding support", "Comfort aids for recovery"];
  for (const f of fillerPool) {
    if (!isHealthCareFillerLabel(f)) continue;
    if (isSkinCoatLabel(f) && out.some((x) => isSkinCoatLabel(x))) continue;
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
 * @param {unknown[]} [messages] full thread — recent user turns supply keywords when the latest message is a short chip tap
 * @returns {string}
 */
export function ensureVetAlternatePathChips(reply, context, latestUserText, messages) {
  const raw = reply ?? "";
  if (!/```\s*cai-vet-ingress\b/i.test(raw)) return raw;
  if (hasTrailingChipsLine(raw)) return raw;

  const pet = extractPetFirstNameFromContext(typeof context === "string" ? context : "");
  const recent = extractRecentUserConcernSnippet(Array.isArray(messages) ? messages : []);
  const chips = buildCareProductIngressChips(
    typeof latestUserText === "string" ? latestUserText : "",
    raw,
    pet,
    recent,
  );
  return `${raw.trimEnd()}\n\n${chips}`;
}
