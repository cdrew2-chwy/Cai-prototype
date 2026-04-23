export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  /** Set when the pet parent sends a message (phone + workbench). */
  sentAt?: number;
};

/** First name for Figma “Customer message” name slot — strips labels like “Name:” and uses the first word. */
export function extractPetParentDisplayName(profile: string): string {
  const rawLine = profile.trim().split(/\n/)[0]?.trim() ?? "";
  if (!rawLine || rawLine === "(none provided)") return "Pet parent";
  const beforeComma = rawLine.split(",")[0]?.trim() || rawLine;
  const withoutLabel = beforeComma
    .replace(/^(?:name|pet parent|parent|full name|example)\s*:\s*/i, "")
    .trim();
  if (!withoutLabel) return "Pet parent";
  const firstName = withoutLabel.split(/\s+/)[0] ?? "";
  if (!firstName) return "Pet parent";
  return firstName.length > 36 ? `${firstName.slice(0, 33)}…` : firstName;
}

/** Figma-style time e.g. “9:41 p.m.” */
export function formatChatTimestamp(sentAt: number): string {
  const s = new Date(sentAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return s.replace(" AM", " a.m.").replace(" PM", " p.m.");
}

/** Strip optional fields before calling the chat API. */
export function messagesForApi(messages: ChatMessage[]): { role: ChatRole; content: string }[] {
  return messages.map(({ role, content }) => ({ role, content }));
}

/** Strip `**` from model output so markdown bold does not appear literally in welcome UI. */
export function stripWelcomeMarkdownBold(text: string): string {
  return text.replace(/\*\*/g, "");
}

export function parseChips(text: string): { body: string; chips: string[] } {
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

/** One product row inside a ```cai-products JSON block (Figma 3204:111808 / in-app row 3215:112444). */
export type CaiProductItem = {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  /** PDP / web link for prototype taps; production should deep-link the Chewy app. */
  url?: string;
  /** Large card eyebrow, e.g. “Top pick”. */
  badge?: string;
  /** Medium card — branch label, e.g. “Reflective collars”. */
  categoryLabel?: string;
  /** Brand / vendor line from catalog (in-app). */
  brand?: string;
  /** Formatted current price, e.g. “$42.99” — only when supplied by verified context. */
  price?: string;
  /** Optional compare / “Was” price (struck through in UI). */
  wasPrice?: string;
  /** Average rating 0–5 from catalog; renders star row when set. */
  rating?: number;
  /** Review count from catalog. */
  reviewCount?: number;
  /** Short promo from catalog (e.g. Autoship). Stripped at parse when `price` is absent (prototype anti-fabrication). */
  dealLabel?: string;
  /** PDP gallery: number of dot indicators (1–12). */
  galleryCount?: number;
  /** 0-based active dot (defaults 0). */
  galleryActiveIndex?: number;
  /** e.g. “4 sizes” — under gallery dots (reference: `src/assets/cai-product-card-reference.png`). */
  sizeVariantLabel?: string;
  /** e.g. “($2.10/lb)” next to list price. */
  unitPrice?: string;
  /** “At a glance” chip labels; strings or `{ "label": "…" }` in JSON. */
  atAGlance?: string[];
};

/**
 * `top_pick` → one **large** card (overall recommendation when pet context is sufficient).
 * `category_options` → **medium** cards in a horizontal carousel (e.g. adjustable vs reflective).
 */
export type CaiProductsBlock = {
  layout: "top_pick" | "category_options";
  /** Section title above the card(s) in the UI (Figma 3211:111809). */
  heading?: string;
  items: CaiProductItem[];
};

const CAI_PRODUCTS_FENCE_RE = /```cai-products\s*\n?([\s\S]*?)```/gi;

function extractCaiProductsFence(raw: string): {
  textWithoutFence: string;
  jsonText: string | null;
  beforeFence: string;
  afterFence: string;
} {
  const matches = [...raw.matchAll(CAI_PRODUCTS_FENCE_RE)];
  if (matches.length === 0) {
    return { textWithoutFence: raw, jsonText: null, beforeFence: "", afterFence: "" };
  }
  const last = matches[matches.length - 1]!;
  const fullMatch = last[0] ?? "";
  const idx = last.index ?? 0;
  const jsonText = last[1]?.trim() ?? "";
  const beforeFence = raw.slice(0, idx);
  const afterFence = raw.slice(idx + fullMatch.length);
  CAI_PRODUCTS_FENCE_RE.lastIndex = 0;
  const textWithoutFence = raw.replace(CAI_PRODUCTS_FENCE_RE, "").replace(/\n{3,}/g, "\n\n").trimEnd();
  return { textWithoutFence, jsonText, beforeFence, afterFence };
}

function normalizeRating(x: unknown): number | undefined {
  if (typeof x === "number" && Number.isFinite(x)) {
    return Math.min(5, Math.max(0, x));
  }
  if (typeof x === "string") {
    const n = Number.parseFloat(x.trim());
    if (!Number.isNaN(n)) return Math.min(5, Math.max(0, n));
  }
  return undefined;
}

function normalizeReviewCount(x: unknown): number | undefined {
  if (typeof x === "number" && Number.isFinite(x) && x >= 0) {
    return Math.min(9_999_999, Math.floor(x));
  }
  if (typeof x === "string" && /^\d[\d\s,]*$/.test(x.trim())) {
    const n = Number.parseInt(x.replace(/[\s,]/g, ""), 10);
    if (!Number.isNaN(n) && n >= 0) return Math.min(9_999_999, n);
  }
  return undefined;
}

function normalizeGlanceLabels(x: unknown): string[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out: string[] = [];
  for (const el of x) {
    if (typeof el === "string" && el.trim()) {
      out.push(el.trim());
      continue;
    }
    if (el && typeof el === "object") {
      const lab = (el as Record<string, unknown>).label;
      if (typeof lab === "string" && lab.trim()) out.push(lab.trim());
    }
  }
  return out.length > 0 ? out : undefined;
}

function normalizeGalleryCount(x: unknown): number | undefined {
  if (typeof x === "number" && Number.isFinite(x)) {
    const n = Math.floor(x);
    if (n >= 1 && n <= 12) return n;
  }
  return undefined;
}

function normalizeGalleryActive(x: unknown): number | undefined {
  if (typeof x === "number" && Number.isFinite(x)) {
    const n = Math.floor(x);
    if (n >= 0 && n < 12) return n;
  }
  return undefined;
}

function normalizeProductItem(v: unknown): CaiProductItem | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const title = o.title;
  if (typeof title !== "string" || !title.trim()) return null;
  const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : undefined);
  const price = str(o.price);
  let wasPrice = str(o.wasPrice);
  let dealLabel = str(o.dealLabel);
  let rating = normalizeRating(o.rating);
  let reviewCount = normalizeReviewCount(o.reviewCount);
  let unitPrice = str(o.unitPrice);
  let atAGlance = normalizeGlanceLabels(o.atAGlance) ?? normalizeGlanceLabels(o.glanceChips);
  let sizeVariantLabel = str(o.sizeVariantLabel);
  let galleryCount = normalizeGalleryCount(o.galleryCount);
  const galleryActiveIndex = normalizeGalleryActive(o.galleryActiveIndex) ?? 0;
  /**
   * Text-only prototype: prices / promos / ratings normally come from the catalog BFF together.
   * Drop catalog-style fields when `price` is missing so the model cannot “decorate” with fake
   * Autoship % off, was-prices, stars, or review counts.
   */
  if (!price) {
    wasPrice = undefined;
    dealLabel = undefined;
    rating = undefined;
    reviewCount = undefined;
    unitPrice = undefined;
    atAGlance = undefined;
    sizeVariantLabel = undefined;
    galleryCount = undefined;
  }
  return {
    title: title.trim(),
    subtitle: str(o.subtitle),
    imageUrl: str(o.imageUrl),
    url: str(o.url),
    badge: str(o.badge),
    categoryLabel: str(o.categoryLabel),
    brand: str(o.brand),
    price,
    wasPrice,
    rating,
    reviewCount,
    dealLabel,
    galleryCount,
    galleryActiveIndex:
      galleryCount !== undefined && galleryCount > 0
        ? Math.min(galleryActiveIndex, galleryCount - 1)
        : undefined,
    sizeVariantLabel,
    unitPrice,
    atAGlance,
  };
}

/** Parse and validate JSON from a cai-products fence; returns null if invalid. */
export function parseCaiProductsJson(jsonText: string): CaiProductsBlock | null {
  let data: unknown;
  try {
    data = JSON.parse(jsonText) as unknown;
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const layout = o.layout;
  if (layout !== "top_pick" && layout !== "category_options") return null;
  const itemsRaw = o.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) return null;
  const items = itemsRaw.map(normalizeProductItem).filter((x): x is CaiProductItem => x !== null);
  if (items.length === 0) return null;
  const heading = typeof o.heading === "string" && o.heading.trim() ? o.heading.trim() : undefined;
  return { layout, heading, items };
}

export type ParsedAssistantMessage = {
  /** Prose before ```cai-products``` (optional warm opener). Empty when the model leads with the fence. */
  body: string;
  chips: string[];
  products: CaiProductsBlock | null;
  /** Prose after the fence, before CHIPS — “why this recommendation” (Figma 3211:111809). Only set when products is non-null. */
  recommendationRationale?: string;
};

/** `- **Name**: tail` / numbered — model often echoes these beside ```cai-products```. */
function isMarkdownProductCatalogLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^[-*]\s+\*\*.+\*\*\s*:\s*.+$/.test(t)) return true;
  if (/^\d+\.\s+\*\*.+\*\*\s*:\s*.+$/.test(t)) return true;
  return false;
}

/**
 * When cards are present, drop a trailing suffix of markdown product bullets (and blanks only
 * between those bullets) so the UI does not duplicate the same picks in prose. Requires at least
 * two product lines in the suffix to avoid false positives.
 */
function stripTrailingMarkdownProductCatalog(body: string): string {
  const lines = body.split(/\n/);
  let k = lines.length - 1;
  while (k >= 0 && lines[k]!.trim() === "") k--;
  if (k < 0) return body;

  let productLines = 0;
  const suffixEnd = k;

  while (k >= 0) {
    const line = lines[k]!;
    if (isMarkdownProductCatalogLine(line)) {
      productLines += 1;
      k -= 1;
      continue;
    }
    if (line.trim() === "") {
      let kk = k - 1;
      while (kk >= 0 && lines[kk]!.trim() === "") kk -= 1;
      if (kk >= 0 && isMarkdownProductCatalogLine(lines[kk]!)) {
        k = kk;
        continue;
      }
    }
    break;
  }

  if (productLines < 2) return body;

  let removeStart = k + 1;
  while (removeStart > 0 && lines[removeStart - 1]!.trim() === "") {
    removeStart -= 1;
  }

  const out = [...lines.slice(0, removeStart), ...lines.slice(suffixEnd + 1)];
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

/** Split full prose (fence removed, CHIPS stripped) into lead-in vs “why” using original fence position. */
function splitRecommendationProse(bodyFull: string, beforeFence: string): { leadIn: string; rationale: string } {
  const b = beforeFence.trim();
  const stripped = bodyFull.trimStart();
  if (!b) {
    return { leadIn: "", rationale: stripped.trimEnd() };
  }
  if (stripped.startsWith(b)) {
    const rationale = stripped.slice(b.length).replace(/^[\s\n]+/, "").trimEnd();
    return { leadIn: b, rationale };
  }
  return { leadIn: "", rationale: stripped.trimEnd() };
}

/**
 * Assistant replies: strips optional ```cai-products … ``` JSON (product cards), then parses CHIPS on the remainder.
 * For product turns, {@link ParsedAssistantMessage.body} is prose **before** the fence; {@link ParsedAssistantMessage.recommendationRationale} is prose **after** the fence (UI: title → card → why → chips; Figma 3211:111809).
 */
export function parseAssistantMessage(content: string): ParsedAssistantMessage {
  const { textWithoutFence, jsonText, beforeFence } = extractCaiProductsFence(content);
  const products = jsonText ? parseCaiProductsJson(jsonText) : null;
  const { body, chips } = parseChips(textWithoutFence);
  const bodyStripped =
    products && products.items.length > 0 ? stripTrailingMarkdownProductCatalog(body) : body;

  if (!products) {
    return { body: bodyStripped, chips, products: null };
  }

  const { leadIn, rationale } = splitRecommendationProse(bodyStripped, beforeFence);
  return {
    body: leadIn,
    chips,
    products,
    recommendationRationale: rationale,
  };
}

/** Always last on the welcome screen — human escalation (Chewy customer care). */
export const CUSTOMER_CARE_WELCOME_CHIP = "Chat live with customer care";

/** First chip when the pet parent placed or received an order in the last 7 days (product rule). */
export const RECENT_ORDER_WELCOME_CHIP = "Get help with an order";

export type FinalizeWelcomeChipsOptions = {
  /** When true, {@link RECENT_ORDER_WELCOME_CHIP} is prepended first; customer care stays last. */
  recentOrderWithin7Days?: boolean;
};

/**
 * Welcome UI only: strips reserved labels from the model list, optionally prepends the recent-order
 * chip, keeps up to the remaining slots for model chips, then appends {@link CUSTOMER_CARE_WELCOME_CHIP}
 * as the final chip (max {@code maxTotal} chips).
 */
export function finalizeWelcomeChips(
  chips: string[],
  maxTotal = 4,
  options?: FinalizeWelcomeChipsOptions
): string[] {
  const care = CUSTOMER_CARE_WELCOME_CHIP;
  const orderHelp = RECENT_ORDER_WELCOME_CHIP;
  const norm = (s: string) => s.trim().toLowerCase();
  const recent = Boolean(options?.recentOrderWithin7Days);

  const rest = chips.filter((c) => {
    const k = norm(c);
    return k !== norm(care) && k !== norm(orderHelp);
  });

  const fixedStart = recent ? 1 : 0;
  const roomForModel = Math.max(0, maxTotal - fixedStart - 1);
  const modelSlice = rest.slice(0, roomForModel);

  const out: string[] = [];
  if (recent) out.push(orderHelp);
  out.push(...modelSlice);
  out.push(care);
  return out;
}
