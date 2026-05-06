/**
 * JSON microcopy for the return / exchange panel — uses full Cai system voice without a full chat reply.
 */
import { CAI_SYSTEM_PROMPT } from "./caiSystemPrompt.js";

const PANEL_TASK = `You output **JSON only** for an in-app card shown right after the parent tapped **Start a return or exchange**. Their order is already chosen in the UI; **Start return now** and a customer-care chip render below your text—do **not** tell them to tap or pick an order from a list.

Return one JSON object with exactly two string keys, "headline" and "body":
- "headline": One line, about 95 characters max. Sound like **you** (Cai): warm, clear, Chewy-native—draw on the full personality rules you already have (empathy, plain language, optional light pet-adjacent warmth when it fits). Be specific to **returns or exchanges**, not generic reassurance.
- "body": About 260 characters max. One or two sentences: steer them to **Start return now** for Chewy's returns flow and mention customer care for a human—vary wording; avoid sounding like a script.

**Hard ban** in both strings: "I can help with that", "Got it", "Happy to help", "Sure thing", "I'd be happy to", "please tap", "tap the order", "select an order", "pick an order".

No markdown in the strings. No backticks.`;

/**
 * @param {object} params
 * @param {import("openai").default} params.openai
 * @param {string} params.model
 * @param {unknown[]} params.messages
 * @param {string} params.contextStr trimmed developer context or ""
 * @returns {Promise<{ headline: string, body: string } | null>}
 */
export async function generateReturnExchangePanelCopy({ openai, model, messages, contextStr }) {
  const bundle =
    contextStr.trim().length > 0
      ? `\n\nDeveloper-provided context (session):\n${contextStr.trim()}`
      : "";

  const systemContent = `${CAI_SYSTEM_PROMPT}${bundle}\n\n---\n${PANEL_TASK}`;

  const completion = await openai.chat.completions.create({
    model,
    messages: [{ role: "system", content: systemContent }, ...messages],
    temperature: 0.88,
    max_tokens: 220,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    const headline = typeof parsed.headline === "string" ? parsed.headline.trim() : "";
    const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (headline && body) return { headline, body };
  } catch {
    /* fall through */
  }
  return null;
}
