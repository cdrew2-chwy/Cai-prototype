import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";
import { CAI_SYSTEM_PROMPT } from "./caiSystemPrompt.js";
import {
  buildWelcomeSystemPrompt,
  normalizeFirstTimeExperienceWithCai,
  normalizeRecentOrderWithin7Days,
} from "./welcomePrompt.js";
import { ensureVetIngressInReply } from "./vetIngressGuard.js";
import { ensureVetAlternatePathChips } from "./vetFollowUpChipsGuard.js";
import { ensureOrderCardsInReply } from "./orderHelpGuard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from project root (parent of /server)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

/** Trim so accidental spaces in .env do not break the key. */
function apiKey() {
  return (process.env.OPENAI_API_KEY || "").trim();
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "256kb" }));

/*
 * Production intent (Chewy app): Cai will run in-app with real catalog/cart/auth. Product actions
 * (add to cart, returns, purchase, Autoship, etc.) should call native commerce modules—not browser PDP
 * links from this prototype. Here we only proxy text to OpenAI; keep SKUs and offers server-verified
 * when you wire catalog tools or BFF endpoints.
 */

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: Boolean(apiKey()) });
});

/**
 * POST /api/welcome
 * Body: { parentProfile?, petProfile?, shoppingHistory?, firstTimeExperienceWithCai?, recentOrderWithin7Days? }
 *   firstTimeExperienceWithCai defaults true — first-meeting tone; false = returning / welcome back, no Cai intro.
 *   recentOrderWithin7Days when true — welcome UI prepends “Get help with an order” as first chip; model must not duplicate.
 * Returns { welcome: string } — personalized opening before chat.
 */
app.post("/api/welcome", async (req, res) => {
  try {
    const key = apiKey();
    if (!key) {
      res.status(500).json({
        error: "Missing OPENAI_API_KEY. Copy .env.example to .env and add your key.",
      });
      return;
    }

    const {
      parentProfile = "",
      petProfile = "",
      shoppingHistory = "",
      firstTimeExperienceWithCai,
      recentOrderWithin7Days,
    } = req.body || {};
    const firstTime = normalizeFirstTimeExperienceWithCai(firstTimeExperienceWithCai);
    const recentOrder = normalizeRecentOrderWithin7Days(recentOrderWithin7Days);

    const bundle = [
      "### Pet parent profile",
      parentProfile.trim() || "(none provided)",
      "",
      "### Pet profile",
      petProfile.trim() || "(none provided)",
      "",
      "### Shopping & browsing history",
      shoppingHistory.trim() || "(none provided)",
    ].join("\n");

    const openai = new OpenAI({ apiKey: key });

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: buildWelcomeSystemPrompt({
            firstTimeExperienceWithCai: firstTime,
            recentOrderWithin7Days: recentOrder,
          }),
        },
        {
          role: "user",
          content: `${firstTime ? "[[Session: FIRST-TIME with Cai — do not use welcome-back or returning-chatter phrasing.]]\n\n" : "[[Session: RETURNING — welcome-back tone is OK; do not re-introduce Cai from scratch.]]\n\n"}${recentOrder ? "[[Recent order within 7 days: ON — do not put “Get help with an order” in CHIPS; the app shows it first.]]\n\n" : ""}Context bundle for the welcome screen:\n\n${bundle}\n\nWrite Cai's welcome message now.`,
        },
      ],
      temperature: 0.75,
    });

    const welcome = completion.choices[0]?.message?.content ?? "";
    res.json({ welcome });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Welcome failed";
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/chat
 * Body: { messages: { role: 'user'|'assistant', content: string }[], context?: string, orderHistory?: unknown[] }
 * Prototype: plain text only. In the Chewy app, pair replies with verified product payloads and
 * in-app cart / checkout / return handlers (see file header above).
 */
app.post("/api/chat", async (req, res) => {
  try {
    const key = apiKey();
    if (!key) {
      res.status(500).json({
        error: "Missing OPENAI_API_KEY. Copy .env.example to .env and add your key.",
      });
      return;
    }

    const { messages, context, orderHistory } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Expected body.messages as a non-empty array." });
      return;
    }

    let latestUserText = "";
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user" && typeof messages[i]?.content === "string") {
        latestUserText = messages[i].content;
        break;
      }
    }

    const openai = new OpenAI({ apiKey: key });

    const systemContent =
      typeof context === "string" && context.trim()
        ? `${CAI_SYSTEM_PROMPT}\n\nDeveloper-provided context (may be empty in prototype):\n${context.trim()}`
        : `${CAI_SYSTEM_PROMPT}\n\nDeveloper-provided context (may be empty in prototype):\n(none)`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "system", content: systemContent }, ...messages],
      temperature: 0.7,
    });

    const rawReply = completion.choices[0]?.message?.content ?? "";
    const contextStr = typeof context === "string" ? context : "";
    const reply = ensureOrderCardsInReply(
      ensureVetAlternatePathChips(
        ensureVetIngressInReply(rawReply, latestUserText),
        contextStr,
        latestUserText,
      ),
      latestUserText,
      orderHistory,
    );
    res.json({ reply });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Chat failed";
    res.status(500).json({ error: message });
  }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`Cai API listening on http://127.0.0.1:${PORT}`);
});
