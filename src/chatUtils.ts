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
