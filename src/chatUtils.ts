export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  /** Set when the pet parent sends a message (phone + workbench). */
  sentAt?: number;
};

/**
 * Maps a `CaiPhoneThread` tail index to the index in `messages` (tail omits index 0 when it is the welcome assistant).
 */
export function fullMessageIndexFromTailIndex(tailIndex: number, messages: ChatMessage[]): number {
  return messages.length > 0 && messages[0]?.role === "assistant" ? tailIndex + 1 : tailIndex;
}

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

/**
 * Pet name for personalized copy in some flows (order-help chips use fixed Figma labels in the UI).
 * Uses the first line of the pet profile before an em dash or similar separator.
 */
export function extractPetCallingName(petProfile: string): string {
  const raw = (petProfile.split("\n")[0] ?? "").replace(/^example:\s*/i, "").trim();
  if (!raw) return "your pet";
  const beforeSep = raw.split(/[—–-]/)[0]?.trim() ?? raw;
  const token = (beforeSep.split(/\s+/)[0] ?? "").replace(/^[^A-Za-z]+/, "");
  if (!token || token.length < 2) return "your pet";
  if (/^(example|my|the|our|pet|dog|cat|two|one|all|both)$/i.test(token)) return "your pet";
  if (!/^[A-Za-z][A-Za-z'-]{1,23}$/.test(token)) return "your pet";
  return token;
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

/** Strip `**` from model output so markdown bold does not appear literally in welcome or chat prose. */
export function stripWelcomeMarkdownBold(text: string): string {
  return text.replace(/\*\*/g, "");
}

/**
 * Split assistant prose into an emphasized first sentence (Figma 1117:13599 Editorial / Heading-1-Stronger)
 * and the remainder as body copy. Handles `...` and optional closing quotes before whitespace or end.
 */
export function splitFirstSentence(text: string): { lead: string; rest: string } {
  const s = text;
  if (!s) return { lead: "", rest: "" };

  let i = 0;
  const n = s.length;
  while (i < n) {
    const ch = s[i];
    if (ch === "." || ch === "!" || ch === "?") {
      let j = i;
      if (ch === ".") {
        while (j < n && s[j] === ".") j++;
        const runLen = j - i;
        const beforeDot = i > 0 ? s[i - 1] : "";
        const afterRun = j < n ? s[j] : "";
        if (runLen === 1 && /\d/.test(beforeDot) && /\d/.test(afterRun)) {
          i = j;
          continue;
        }
      } else {
        j = i + 1;
      }
      let k = j;
      while (
        k < n &&
        (s[k] === '"' ||
          s[k] === "'" ||
          s[k] === ")" ||
          s[k] === "]" ||
          s[k] === "\u201d" ||
          s[k] === "\u2019")
      ) {
        k++;
      }
      if (k === n || /\s/.test(s[k] ?? "")) {
        const lead = s.slice(0, k).trimEnd();
        const rest = s.slice(k).trimStart();
        return { lead, rest };
      }
      i = ch === "." ? j : i + 1;
      continue;
    }
    i++;
  }
  return { lead: s, rest: "" };
}

/** Spaced em/en dashes often read stiff; prefer a comma in displayed assistant prose. */
function relaxConversationalDashes(text: string): string {
  return text.replace(/ — /g, ", ").replace(/ – /g, ", ");
}

/** Normalizes model chat lines for the thread (bold + softer punctuation). */
function formatAssistantProse(text: string): string {
  return relaxConversationalDashes(stripWelcomeMarkdownBold(text));
}

/**
 * If prose before ```cai-vet-ingress``` already hands off to Connect with a Vet / licensed vet techs,
 * the UI should not show a second intro line (avoids duplicate pitch + JSON `intro`).
 */
function preFenceAlreadyIntroducesConnectWithVetVetTech(beforeFence: string): boolean {
  const t = (beforeFence || "").toLowerCase();
  if (!t.trim()) return false;
  if (/\bconnect with a vet\b/.test(t)) return true;
  if (/\blicensed vet techs?\b/.test(t)) return true;
  if (/\bchat (with|free with)\s+(a\s+)?licensed vet techs?\b/.test(t)) return true;
  return false;
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

/**
 * One order row inside a ```cai-orders``` JSON block (Figma 3277:28045 list; Figma 3279:29189 — card / row spec).
 * Optional `imageUrl`: first line item (from BFF); when omitted, UI shows a neutral order-tile.
 */
export type CaiOrderItem = {
  id: string;
  orderNumber: string;
  summary: string;
  /** Optional in JSON; the order card does not show Autoship/one-time copy. Use `status` + `placedAt` in the UI. */
  meta?: string;
  status?: string;
  placedAt?: string;
  /** When set, “Arrived …” for delivered orders uses this date; otherwise `placedAt`. */
  deliveredAt?: string;
  /** When set, shown in the leading 56px tile; otherwise a package placeholder is used. */
  imageUrl?: string;
  /**
   * Original Chewy PDP URL when the server replaced `summary` with a product title but could not
   * set `imageUrl` (used to resolve local fallback thumbnails by `/dp/{id}`).
   */
  productPageUrl?: string;
  /** Optional catalog list price (USD) when enriched from product CSV / fence JSON. */
  listPrice?: number;
};

export type CaiOrdersBlock = {
  heading?: string;
  orders: CaiOrderItem[];
  /** When true and more than 3 orders in the list, UI shows 3 first with “Load more”. */
  showLoadMore?: boolean;
};

/** After parent taps an order card (Figma 3288:29321); keyed to the assistant `messages` index. */
export type OrderPickState = {
  messageIndex: number;
  order: CaiOrderItem;
  pickedAt: number;
};

/** Order-help intent chip — opens return / exchange card flow (Figma 3066:38124). */
export const START_RETURN_OR_EXCHANGE_CHIP = "Start a return or exchange";

/** Chip under return card — escalates to care team (Figma 3066:38124). */
export const RETURN_FLOW_CARE_TEAM_CHIP = "Get help from our care team";

/**
 * Models occasionally wrap the whole reply in quotes, add zero‑width characters, or put spaces /
 * a language tag after the opening backticks — any of that breaks strict ```cai-* fence matching so
 * structured UI (product cards, orders, vet card) never mounts and the fence shows as raw text.
 */
function normalizeAssistantStructuredInput(raw: string): string {
  let s = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");

  const t = s.trim();
  const hasStructuredFence = /```\s*cai-(?:products|orders|vet-ingress)\b/i.test(t);
  if (
    hasStructuredFence &&
    t.length >= 2 &&
    ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("\u201C") && t.endsWith("\u201D")))
  ) {
    try {
      const parsed = JSON.parse(t);
      if (typeof parsed === "string") return parsed;
    } catch {
      /* not a valid JSON string; fall through */
    }
    const inner = t.slice(1, -1);
    return inner.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return s;
}

/** Allow optional spaces / language token after opening ``` (common markdown variance). */
const CAI_PRODUCTS_FENCE_RE = /```\s*cai-products(?:\s+[\w.-]+)?\s*\n?([\s\S]*?)```/gi;

const CAI_ORDERS_FENCE_RE = /```\s*cai-orders(?:\s+[\w.-]+)?\s*\n?([\s\S]*?)```/gi;

const CAI_VET_INGRESS_FENCE_RE = /```\s*cai-vet-ingress(?:\s+[\w.-]+)?\s*\n?([\s\S]*?)```/gi;

/** First ```cai-vet-ingress``` only — keeps prose before vs after the card for layout. */
function splitFirstVetFence(raw: string): {
  beforeVet: string;
  afterVet: string;
  vetIngress: boolean;
  vetWaitSeconds?: number;
  /**
   * From JSON `intro`: set line above card; `undefined` = use component default; `""` = no line (prose
   * already introduced Connect with a Vet).
   */
  vetCardIntro?: string;
} {
  CAI_VET_INGRESS_FENCE_RE.lastIndex = 0;
  const m = CAI_VET_INGRESS_FENCE_RE.exec(raw);
  if (!m) {
    return { beforeVet: "", afterVet: raw, vetIngress: false };
  }
  let vetWaitSeconds: number | undefined;
  let vetCardIntro: string | undefined;
  const inner = m[1]?.trim();
  if (inner) {
    try {
      const o = JSON.parse(inner) as { waitSeconds?: unknown; intro?: unknown };
      if (typeof o.waitSeconds === "number" && Number.isFinite(o.waitSeconds)) {
        vetWaitSeconds = Math.min(23, Math.max(1, Math.floor(o.waitSeconds)));
      }
      if (Object.prototype.hasOwnProperty.call(o, "intro")) {
        if (o.intro === null) {
          vetCardIntro = "";
        } else if (typeof o.intro === "string") {
          const t = o.intro.trim();
          vetCardIntro = t ? formatAssistantProse(t) : "";
        }
      }
    } catch {
      /* ignore */
    }
  }
  const beforeVet = raw.slice(0, m.index ?? 0).trimEnd();
  const afterVet = raw.slice((m.index ?? 0) + (m[0]?.length ?? 0)).trimStart();
  return { beforeVet, afterVet, vetIngress: true, vetWaitSeconds, vetCardIntro };
}

/**
 * Removes ```cai-vet-ingress```, ```cai-orders```, and ```cai-products``` fences from assistant text.
 * Welcome UI only runs {@link parseChips}; without this, model-injected fences show as raw markdown in the welcome card.
 */
export function stripCaiStructuredFences(content: string): string {
  const normalized = normalizeAssistantStructuredInput(content);
  const stripped = normalized
    .replace(CAI_VET_INGRESS_FENCE_RE, "")
    .replace(CAI_ORDERS_FENCE_RE, "")
    .replace(CAI_PRODUCTS_FENCE_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
  CAI_VET_INGRESS_FENCE_RE.lastIndex = 0;
  CAI_ORDERS_FENCE_RE.lastIndex = 0;
  CAI_PRODUCTS_FENCE_RE.lastIndex = 0;
  return stripped;
}

function chipsFromAssistantContent(content: string): string[] {
  return parseChips(stripCaiStructuredFences(content)).chips;
}

function extractCaiOrdersFence(raw: string): {
  textWithoutFence: string;
  jsonText: string | null;
  beforeFence: string;
  afterFence: string;
} {
  const matches = [...raw.matchAll(CAI_ORDERS_FENCE_RE)];
  if (matches.length === 0) {
    return { textWithoutFence: raw, jsonText: null, beforeFence: "", afterFence: "" };
  }
  const last = matches[matches.length - 1]!;
  const fullMatch = last[0] ?? "";
  const idx = last.index ?? 0;
  const jsonText = last[1]?.trim() ?? "";
  const beforeFence = raw.slice(0, idx);
  const afterFence = raw.slice(idx + fullMatch.length);
  CAI_ORDERS_FENCE_RE.lastIndex = 0;
  const textWithoutFence = raw.replace(CAI_ORDERS_FENCE_RE, "").replace(/\n{3,}/g, "\n\n").trimEnd();
  return { textWithoutFence, jsonText, beforeFence, afterFence };
}

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

function normalizeOrderItem(v: unknown): CaiOrderItem | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
  const orderNumber = typeof o.orderNumber === "string" && o.orderNumber.trim() ? o.orderNumber.trim() : "";
  const summary = typeof o.summary === "string" && o.summary.trim() ? o.summary.trim() : "";
  if (!orderNumber || !summary) return null;
  const meta = typeof o.meta === "string" && o.meta.trim() ? o.meta.trim() : undefined;
  const status = typeof o.status === "string" && o.status.trim() ? o.status.trim() : undefined;
  const placedAt = typeof o.placedAt === "string" && o.placedAt.trim() ? o.placedAt.trim() : undefined;
  const deliveredAt =
    typeof o.deliveredAt === "string" && o.deliveredAt.trim() ? o.deliveredAt.trim() : undefined;
  const imageUrl = typeof o.imageUrl === "string" && o.imageUrl.trim() ? o.imageUrl.trim() : undefined;
  const productPageUrl =
    typeof o.productPageUrl === "string" && o.productPageUrl.trim() ? o.productPageUrl.trim() : undefined;
  let listPrice: number | undefined;
  if (typeof o.listPrice === "number" && Number.isFinite(o.listPrice)) {
    listPrice = o.listPrice;
  } else if (typeof o.listPrice === "string" && o.listPrice.trim()) {
    const n = Number(o.listPrice.trim());
    if (!Number.isNaN(n)) listPrice = n;
  }
  return {
    id: id || orderNumber,
    orderNumber,
    summary,
    meta,
    status,
    placedAt,
    deliveredAt,
    imageUrl,
    productPageUrl,
    listPrice,
  };
}

/** Parse JSON from a cai-orders fence; returns null if invalid. */
export function parseCaiOrdersJson(jsonText: string): CaiOrdersBlock | null {
  let data: unknown;
  try {
    data = JSON.parse(jsonText) as unknown;
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const ordersRaw = o.orders;
  if (!Array.isArray(ordersRaw) || ordersRaw.length === 0) return null;
  const orders = ordersRaw.map(normalizeOrderItem).filter((x): x is CaiOrderItem => x !== null);
  if (orders.length === 0) return null;
  const heading = typeof o.heading === "string" && o.heading.trim() ? o.heading.trim() : undefined;
  const showLoadMore = o.showLoadMore === true;
  return { heading, orders, showLoadMore };
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
  /**
   * Main prose block: with **vet ingress**, this is only copy **before** ```cai-vet-ingress``` (empathy / limits),
   * so it sits next to the vet card. Without vet, same as before (opener before ```cai-products``` when products exist).
   */
  body: string;
  /**
   * When **vet ingress** is used: prose **after** the vet fence and **before** ```cai-products``` (e.g. “meanwhile” /
   * other care ideas). Rendered **after** the vet card, before product cards.
   */
  bodyAfterVet?: string;
  /** Suggestion chips; always empty when {@link orders} is set (parent must tap an order card first). */
  chips: string[];
  products: CaiProductsBlock | null;
  /** Order cards from ```cai-orders``` (order help / returns / tracking). */
  orders: CaiOrdersBlock | null;
  /** Prose after the fence, before CHIPS — “why this recommendation” (Figma 3211:111809). Only set when products is non-null. */
  recommendationRationale?: string;
  /** When true, UI renders the Connect with a Vet card (```cai-vet-ingress``` fence). */
  vetIngress?: boolean;
  /** Optional 1–23 for prototype wait copy (always under 24 seconds). */
  vetWaitSeconds?: number;
  /** One line above the card from JSON `intro`; `undefined` = default line; `""` = skip (no duplicate pitch). */
  vetCardIntro?: string;
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
 * Order-line bullets the model may echo beside ```cai-orders``` (duplicates the cards).
 * Plain `-` / `*` / `•` / `1.` with body text, not the bold `**` product-catalog shape.
 */
function isMarkdownOrderListLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 4) return false;
  if (/^\d+\.\s+.+/.test(t)) return true;
  if (/^[-*•]\s+.+/.test(t)) return true;
  return false;
}

const ORDER_INTRO_LINE_RE = new RegExp(
  [
    "^(?:here|below) are (?:your|the) (?:most recent |recent )?orders?\\b",
    "^(?:here|below) (?:is|are) (?:your|the) (?:most recent |recent )?order\\b",
    "^i(?:'|’)?ve (?:pulled|put|listed) (?:up )?your (?:recent )?orders?\\b",
    "^i have (?:pulled|put|listed) (?:up )?your (?:recent )?orders?\\b",
  ].join("|") + ".*$",
  "i",
);

function lineIsOrderListIntroOnly(line: string): boolean {
  return ORDER_INTRO_LINE_RE.test(line.trim());
}

/**
 * When order cards are present, remove duplicated copy: a “here are your orders” line and/or a run of
 * plain markdown list lines the UI already shows in ```cai-orders```.
 */
function stripProseWhenOrderCardsPresent(body: string, orders: CaiOrdersBlock | null): string {
  if (!orders || orders.orders.length === 0) return body;
  const raw = body ?? "";
  let t = raw;

  t = t.replace(
    // Intro line(s) + following bullet / numbered run (incl. (On Autoship) tails)
    new RegExp(
      "(?:^|\\n\\n)\\s*(?:" +
        "here are (?:your|the) (?:most recent |recent )?orders?\\s*:?\\s*|" +
        "below (?:is|are) (?:your|the) (?:most recent |recent )?orders?\\s*:?\\s*|" +
        "i(?:'|’)?ve (?:pulled|put|listed) (?:up )?[^\\n]{0,100}orders?\\s*:?\\s*|" +
        "i have (?:pulled|put|listed) (?:up )?[^\\n]{0,100}orders?\\s*:?\\s*" +
        ")\\s*\\n" +
        "(?:\\s*\\n)*(?:[ \\t]*[-*•]\\s+[^\\n]+\\s*\\n|" +
        "\\s*\\d+\\.\\s+[^\\n]+\\s*\\n)+",
      "gi",
    ),
    "\n",
  );
  t = t.replace(
    // Same intro without a newline before bullets (single block)
    new RegExp(
      "^(?:here are|below (?:is|are)|i(?:'|’)?ve|i have)\\b[^.\\n]*orders?\\s*:?\\s*\\n" +
        "[-*•]\\s*[^\\n]+(?:\\n+[-*•]\\s*[^\\n]+|\\n+\\d+\\.\\s*[^\\n]+)+",
      "gim",
    ),
    "",
  );
  t = t.replace(/\n{3,}/g, "\n\n").trimEnd();
  t = stripTrailingOrderListLines(t, 1);
  t = stripLoneOrderIntro(t);
  t = stripLeadingOrderIntroParagraph(t);
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

/** First paragraph is only an “here are your orders” line; drop it (cards carry the list). */
function stripLeadingOrderIntroParagraph(body: string): string {
  const t = body.trim();
  if (!t) return "";
  const parts = t.split(/\n\n+/);
  if (parts.length < 2) return body;
  const first = parts[0]!
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
  if (lineIsOrderListIntroOnly(first)) {
    return parts.slice(1).join("\n\n").trim();
  }
  return body;
}

/**
 * Trailing list lines at end of body (at least `min` lines) to avoid false positives.
 */
function stripTrailingOrderListLines(body: string, min: number): string {
  const lines = body.split(/\n/);
  let k = lines.length - 1;
  while (k >= 0 && lines[k]!.trim() === "") k--;
  if (k < 0) return body;
  const suffixEnd = k;
  let listLines = 0;
  while (k >= 0) {
    const line = lines[k]!;
    if (isMarkdownOrderListLine(line)) {
      listLines += 1;
      k -= 1;
      continue;
    }
    if (line.trim() === "") {
      let kk = k - 1;
      while (kk >= 0 && lines[kk]!.trim() === "") kk -= 1;
      if (kk >= 0 && isMarkdownOrderListLine(lines[kk]!)) {
        k = kk;
        continue;
      }
    }
    break;
  }
  if (listLines < min) return body;
  let removeStart = k + 1;
  while (removeStart > 0 && lines[removeStart - 1]!.trim() === "") {
    removeStart -= 1;
  }
  const out = [...lines.slice(0, removeStart), ...lines.slice(suffixEnd + 1)];
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

/** If all that is left is an “here are your orders” line, drop it. */
function stripLoneOrderIntro(body: string): string {
  const t = body.trim();
  if (!t) return "";
  const oneLine = !/\n/.test(t);
  if (oneLine && lineIsOrderListIntroOnly(t)) return "";
  return body;
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
 * Assistant replies: optional ```cai-vet-ingress``` then optional ```cai-orders``` then optional ```cai-products``` JSON, then CHIPS.
 * When ```cai-orders``` is present, parsed **chips** are always empty (UI: no suggestion chips until the parent selects an order card).
 * With vet ingress, {@link ParsedAssistantMessage.body} is prose **before** the vet fence only; {@link ParsedAssistantMessage.bodyAfterVet}
 * is bridge / other-care prose after the vet card, before orders/products.
 */
export function parseAssistantMessage(content: string): ParsedAssistantMessage {
  const normalized = normalizeAssistantStructuredInput(content);
  const { beforeVet, afterVet, vetIngress, vetWaitSeconds, vetCardIntro } = splitFirstVetFence(normalized);
  const sourceForFences = vetIngress ? afterVet : normalized;
  const ordersEx = extractCaiOrdersFence(sourceForFences);
  const { textWithoutFence, jsonText, beforeFence } = extractCaiProductsFence(ordersEx.textWithoutFence);
  const orders = ordersEx.jsonText ? parseCaiOrdersJson(ordersEx.jsonText) : null;
  const products = jsonText ? parseCaiProductsJson(jsonText) : null;
  const chips = orders ? [] : chipsFromAssistantContent(normalized);
  const beforeFenceTrim = beforeFence.trim();

  let displayVetCardIntro = vetCardIntro;
  if (vetIngress && preFenceAlreadyIntroducesConnectWithVetVetTech(beforeVet)) {
    displayVetCardIntro = "";
  }

  const vetFields = vetIngress
    ? ({
        vetIngress: true,
        ...(vetWaitSeconds !== undefined ? { vetWaitSeconds } : {}),
        ...(displayVetCardIntro !== undefined ? { vetCardIntro: displayVetCardIntro } : {}),
      } as const)
    : {};

  if (!vetIngress) {
    const { body: proseNoChips } = parseChips(textWithoutFence);
    let bodyStripped =
      products && products.items.length > 0 ? stripTrailingMarkdownProductCatalog(proseNoChips) : proseNoChips;
    bodyStripped = stripProseWhenOrderCardsPresent(bodyStripped, orders);
    if (!products) {
      return {
        body: formatAssistantProse(bodyStripped),
        chips,
        products: null,
        orders,
        ...vetFields,
      };
    }
    const { leadIn, rationale } = splitRecommendationProse(bodyStripped, beforeFenceTrim);
    return {
      body: formatAssistantProse(leadIn),
      chips,
      products,
      orders,
      recommendationRationale: formatAssistantProse(rationale),
      ...vetFields,
    };
  }

  const bodyLead = formatAssistantProse(beforeVet.trim());

  if (!products) {
    const { body: afterProse } = parseChips(textWithoutFence);
    const afterStripped = stripProseWhenOrderCardsPresent(afterProse, orders);
    return {
      body: bodyLead,
      bodyAfterVet: formatAssistantProse(afterStripped.trim()) || undefined,
      chips,
      products: null,
      orders,
      ...vetFields,
    };
  }

  const { body: proseNoChipsVet } = parseChips(textWithoutFence);
  let bodyStripped = products.items.length > 0 ? stripTrailingMarkdownProductCatalog(proseNoChipsVet) : proseNoChipsVet;
  bodyStripped = stripProseWhenOrderCardsPresent(bodyStripped, orders);
  const { leadIn, rationale } = splitRecommendationProse(bodyStripped, beforeFenceTrim);

  return {
    body: bodyLead,
    bodyAfterVet: formatAssistantProse(leadIn.trim()) || undefined,
    chips,
    products,
    orders,
    recommendationRationale: formatAssistantProse(rationale.trim()) || undefined,
    ...vetFields,
  };
}

/** Always last on the welcome screen — human escalation (Chewy customer care). */
export const CUSTOMER_CARE_WELCOME_CHIP = "Chat live with customer care";

/** Suggested first prompt for order help; the welcome UI may prepend it when gather has an order placed in the last 10 days. */
export const RECENT_ORDER_WELCOME_CHIP = "Get help with an order";

/**
 * Shown in the thread as soon as the pet parent asks for order help (when we have order rows to send),
 * while the server enriches PDP data—so “Just a moment!” lines up with the real wait. Merged with the
 * API reply when it returns (see {@link App} `sendUserText`). Keep in sync with server `wantsOrderHelp` triggers.
 */
export const ORDER_HELP_LOADING_LEAD_IN =
  "I can help with that!\n\nLet me dig up your recent orders so we can get started.\n\nJust a moment!";

/** Paragraphs for {@link ORDER_HELP_LOADING_LEAD_IN} (serial reveal in the UI while orders load). */
export function splitOrderHelpLoadingLeadIn(): string[] {
  return ORDER_HELP_LOADING_LEAD_IN.split(/\n\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Removes model paragraphs that repeat “dig/fetch/load orders” or wait-copy already shown in
 * {@link ORDER_HELP_LOADING_LEAD_IN}—used when merging so the thread stays natural if the model drifts.
 */
export function stripRedundantOrderHelpModelEcho(reply: string): string {
  const trimmed = reply.trim();
  if (!trimmed) return trimmed;

  const fenceIdx = trimmed.search(/```\s*cai-orders\b/i);
  const head = fenceIdx >= 0 ? trimmed.slice(0, fenceIdx).trimEnd() : trimmed;
  const tail = fenceIdx >= 0 ? trimmed.slice(fenceIdx).trimStart() : "";

  const strippedHead = stripRedundantOrderHelpParagraphs(head);
  if (!tail) return strippedHead;
  return strippedHead ? `${strippedHead}\n\n${tail}` : tail;
}

function stripRedundantOrderHelpParagraphs(preFence: string): string {
  const parts = preFence
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";

  const filtered = parts.filter((p) => !orderHelpFetchEchoParagraph(p));
  return filtered.join("\n\n").trimEnd();
}

/** True when a block mainly echoes staging copy about retrieving orders (already shown in the UI). */
function orderHelpFetchEchoParagraph(p: string): boolean {
  const plain = p.replace(/\*{1,2}|__/g, "").trim();
  if (!plain || plain.length > 320) return false;
  const lower = plain.toLowerCase();

  const retrieval =
    /\bdig(?:ging)?\s+up\b/.test(lower) ||
    /\bfetch(?:ing)?\b/.test(lower) ||
    /\bpull(?:ing)?\s+up\b/.test(lower) ||
    /\bgrab(?:bing)?\b/.test(lower) ||
    /\bretrieve\b/.test(lower) ||
    /\blook(?:ing)?\s+up\b/.test(lower) ||
    /\bround(?:ing)?\s+up\b/.test(lower) ||
    (/\bloading\b/.test(lower) && /\border/.test(lower));

  const ordersOrDetails = /\border/.test(lower) || /\bdetail/.test(lower);

  const waitAgain =
    /\bjust\s+a\s+moment\b/.test(lower) ||
    /\bhang\s+tight\b/.test(lower) ||
    /\bbear\s+with\b/.test(lower) ||
    /\bone\s+sec(ond)?\b/.test(lower);

  const letsDigUp = /\blet['']?s\s+dig\s+up\b/.test(lower);

  const startedPlusRetrieval =
    /\bget\s+started\b/.test(lower) &&
    (retrieval || /\bso\s+i\s+(can|could)\b/.test(lower) || /\bdetail/.test(lower));

  if (letsDigUp) return true;
  if (/\bi['']?ll\b/.test(lower) && /\bfetch\b/.test(lower) && /\bdetail/.test(lower)) return true;
  if (waitAgain && (ordersOrDetails || retrieval)) return true;
  if (retrieval && ordersOrDetails) return true;
  if (startedPlusRetrieval) return true;

  return false;
}

/**
 * Mirrors `server/orderHelpGuard.js` {@code wantsOrderHelp} so the client can stage the loading lead-in
 * before `/api/chat` returns.
 */
export function wantsOrderHelpFromUser(userText: string): boolean {
  const raw = (userText ?? "").trim();
  if (!raw) return false;
  const t = raw.toLowerCase();
  if (t === "get help with an order") return true;
  if (/\b(return|refund|replace|damag|missing|track|shipment|deliver|wrong item|cancel)\b/.test(t) && /\border\b/.test(t))
    return true;
  if (/\b(order help|help with (my |an |the )?order|my order|order status|where('?s| is) my order)\b/.test(t))
    return true;
  if (/\b(i'?d like to|i want to|need to)\s+(return|cancel|track)\b/.test(t)) return true;
  return false;
}

/**
 * True when a chip is the same intent as {@link RECENT_ORDER_WELCOME_CHIP} (model often omits “Get ” or varies articles).
 */
export function isOrderHelpWelcomeChipLabel(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  return /^(get\s+)?help\s+with\s+(an|your|the)\s+order(s)?\b/.test(t) || /^help\s+with\s+(an|your|the)\s+order(s)?\b/.test(t);
}

/** Stable key for welcome-chip deduping (order-help family collapses to one slot). */
function welcomeChipDedupeKey(label: string, careLabel: string): string {
  const n = label.trim().toLowerCase();
  if (n === careLabel.trim().toLowerCase()) return "__care__";
  if (isOrderHelpWelcomeChipLabel(label)) return "__order_help__";
  return n;
}

export type FinalizeWelcomeChipsOptions = {
  /**
   * Set when gather Order history has a placed date in the last 10 days: prepends
   * {@link RECENT_ORDER_WELCOME_CHIP} and strips the same label from the model to avoid duplicate.
   */
  getHelpWithOrderFirst?: boolean;
};

/**
 * Welcome UI: optionally prepends “Get help with an order” first, drops duplicate customer care from
 * the model, fills remaining slots, appends customer care last (max {@code maxTotal} chips).
 * Never shows two chips for the same intent (e.g. “Help with an order” vs “Get help with an order”).
 */
export function finalizeWelcomeChips(
  chips: string[],
  maxTotal = 4,
  options?: FinalizeWelcomeChipsOptions
): string[] {
  const getHelp = Boolean(options?.getHelpWithOrderFirst);
  const care = CUSTOMER_CARE_WELCOME_CHIP;
  const orderHelp = RECENT_ORDER_WELCOME_CHIP;

  const seen = new Set<string>();
  const rest: string[] = [];
  for (const c of chips) {
    const trimmed = c.trim();
    if (!trimmed) continue;
    const key = welcomeChipDedupeKey(trimmed, care);
    if (key === "__care__") continue;
    if (getHelp && key === "__order_help__") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    rest.push(trimmed);
  }

  const startSlots = getHelp ? 1 : 0;
  const roomForModel = Math.max(0, maxTotal - startSlots - 1);
  const modelSlice = rest.slice(0, roomForModel);

  const out: string[] = [];
  if (getHelp) out.push(orderHelp);
  out.push(...modelSlice, care);
  return out;
}
