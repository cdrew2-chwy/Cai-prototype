import fs from "node:fs";
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
  normalizeOrderPlacedInLast10Days,
} from "./welcomePrompt.js";
import { ensureVetIngressInReply } from "./vetIngressGuard.js";
import { ensureVetAlternatePathChips } from "./vetFollowUpChipsGuard.js";
import { ensureOrderCardsInReply, wantsOrderHelp } from "./orderHelpGuard.js";
import { orderBlockForLlmBundle } from "./orderContextBundle.js";
import { enrichOrderHistoryWithPdpData } from "./chewyPdpEnrich.js";
import { handleChewyProductImageRequest } from "./chewyImageProxy.js";
import { generateReturnExchangePanelCopy } from "./returnExchangePanelCopy.js";

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

/** Optional cap on assistant reply length (faster / cheaper). Omit or empty = API default (no cap). */
function maxOutputTokens(envName) {
  const raw = process.env[envName];
  if (raw === undefined || raw === "") return undefined;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const MAX_WELCOME_TOKENS = maxOutputTokens("OPENAI_MAX_TOKENS_WELCOME");
const MAX_CHAT_TOKENS = maxOutputTokens("OPENAI_MAX_TOKENS_CHAT");

let openaiSingleton = null;
function openaiClient(key) {
  if (!openaiSingleton) openaiSingleton = new OpenAI({ apiKey: key });
  return openaiSingleton;
}

/** Keep in sync with `START_RETURN_OR_EXCHANGE_CHIP` in `src/chatUtils.ts`. */
const START_RETURN_OR_EXCHANGE_CHIP = "Start a return or exchange";

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: Boolean(apiKey()) });
});

/** Browser-safe load of Chewy / Scene7 product art (avoids CDN hotlink blocks on `<img src>`). */
app.get("/api/chewy-product-image", (req, res) => {
  void handleChewyProductImageRequest(req, res);
});

/**
 * POST /api/welcome
 * Body: { parentProfile?, petProfile?, orderHistory?, browsingHistory?, shoppingHistory? (legacy), firstTimeExperienceWithCai?, orderPlacedInLast10Days? }
 *   firstTimeExperienceWithCai defaults true — first-meeting tone; false = returning / welcome back, no Cai intro.
 *   orderPlacedInLast10Days: client sets true when gather Order history has a placed date in the last 10 days (first welcome chip = order help).
 *   If only `shoppingHistory` is sent (old client), it is used as the whole order block; browsing = none.
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

    const b = req.body || {};
    const { parentProfile = "", petProfile = "", firstTimeExperienceWithCai, orderPlacedInLast10Days } = b;
    const oh = typeof b.orderHistory === "string" ? b.orderHistory : "";
    const br = typeof b.browsingHistory === "string" ? b.browsingHistory : "";
    const legacy = typeof b.shoppingHistory === "string" ? b.shoppingHistory : "";
    let orderBlock = oh.trim();
    let browseBlock = br.trim();
    if (!orderBlock && !browseBlock && legacy.trim()) {
      orderBlock = legacy.trim();
    }
    if (!orderBlock) orderBlock = "(none provided)";
    orderBlock = orderBlockForLlmBundle(orderBlock);
    if (!browseBlock) browseBlock = "(none provided)";
    const firstTime = normalizeFirstTimeExperienceWithCai(firstTimeExperienceWithCai);
    const orderIn10 = normalizeOrderPlacedInLast10Days(orderPlacedInLast10Days);

    const bundle = [
      "### Pet parent profile",
      parentProfile.trim() || "(none provided)",
      "",
      "### Pet profile",
      petProfile.trim() || "(none provided)",
      "",
      "### Order history",
      orderBlock,
      "",
      "### Browsing history",
      browseBlock,
    ].join("\n");

    const openai = openaiClient(key);

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: buildWelcomeSystemPrompt({
            firstTimeExperienceWithCai: firstTime,
            orderPlacedInLast10Days: orderIn10,
          }),
        },
        {
          role: "user",
          content: `${firstTime ? "[[Session: FIRST-TIME with Cai — do not use welcome-back or returning-chatter phrasing.]]\n\n" : "[[Session: RETURNING — welcome-back tone is OK; do not re-introduce Cai from scratch.]]\n\n"}${orderIn10 ? "[[Order in last 10 days: the app shows “Get help with an order” as the first welcome prompt chip. Do not put that exact phrase in your CHIPS line.]]\n\n" : ""}Context bundle for the welcome screen:\n\n${bundle}\n\nWrite Cai's welcome message now.`,
        },
      ],
      temperature: 0.75,
      ...(MAX_WELCOME_TOKENS ? { max_tokens: MAX_WELCOME_TOKENS } : {}),
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
 * Body: { messages, context?, orderHistory?, returnExchangePanelCopy?: boolean }
 * — Default: assistant reply string. If `returnExchangePanelCopy` is true and the latest user
 *   message is **Start a return or exchange**, responds with `{ headline, body }` JSON strings only.
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

    const { messages, context, orderHistory: orderHistoryBody, returnExchangePanelCopy } = req.body || {};

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

    if (returnExchangePanelCopy === true && latestUserText.trim() === START_RETURN_OR_EXCHANGE_CHIP) {
      const openai = openaiClient(key);
      const contextStr = typeof context === "string" ? context : "";
      const copy = await generateReturnExchangePanelCopy({
        openai,
        model: MODEL,
        messages,
        contextStr,
      });
      if (!copy) {
        res.status(502).json({ error: "Return panel copy could not be generated." });
        return;
      }
      res.json(copy);
      return;
    }

    let orderHistory = orderHistoryBody;
    /**
     * PDP enrichment is the main latency hit (sequential https://www.chewy.com fetches + stagger).
     * Only run when the user is in an order-help turn — the only case where we inject ```cai-orders```
     * and need product titles/images on cards. Shopping and general chat skip this entirely.
     */
    if (Array.isArray(orderHistory) && orderHistory.length > 0 && wantsOrderHelp(latestUserText)) {
      orderHistory = await enrichOrderHistoryWithPdpData(orderHistory);
    }

    const openai = openaiClient(key);

    let systemContent =
      typeof context === "string" && context.trim()
        ? `${CAI_SYSTEM_PROMPT}\n\nDeveloper-provided context (may be empty in prototype):\n${context.trim()}`
        : `${CAI_SYSTEM_PROMPT}\n\nDeveloper-provided context (may be empty in prototype):\n(none)`;

    if (
      wantsOrderHelp(latestUserText) &&
      Array.isArray(orderHistory) &&
      orderHistory.length > 0
    ) {
      systemContent +=
        "\n\nOrder-help pacing (strict): The UI may already have shown thanks + digging up recent orders + “just a moment” **before** this reply. Treat that as **done**. In **your** words (before any injected ```cai-orders``` block): **do not** paraphrase loading/waiting, **do not** say you are fetching/digging/pulling/grabbing/loading orders or details again, and **do not** pair “let’s get started” with retrieving orders. Write **one short new angle only**: headline + how to use the cards (tap which order, what you’ll help with). Skip pet metaphors about **retrieving** orders entirely on this turn.";
    }

    if (latestUserText.trim() === START_RETURN_OR_EXCHANGE_CHIP) {
      systemContent +=
        "\n\nPrototype return chip: The parent chose **Start a return or exchange** after confirming **which order** in the UI. **Never** tell them to tap or pick an order from the card list again. **Never** stack another generic opener such as “I can help with that,” “Got it,” or “please tap an order”—those beats may already exist above. Add **only** net-new guidance (policy nuance, empathy for the hassle, what happens next on Chewy), or stay to **one** tight sentence.";
    }

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "system", content: systemContent }, ...messages],
      temperature: 0.7,
      ...(MAX_CHAT_TOKENS ? { max_tokens: MAX_CHAT_TOKENS } : {}),
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

/** After `npm run build`, serve the Vite app so one process exposes UI + `/api` (same origin). */
const distDir = path.join(__dirname, "..", "dist");
const distIndex = path.join(distDir, "index.html");
if (fs.existsSync(distIndex)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(distIndex, next);
  });
}

const PORT = Number(process.env.PORT) || 3001;
const HOST = (process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";
app.listen(PORT, HOST, () => {
  const where = HOST === "0.0.0.0" ? "all interfaces" : HOST;
  console.log(`Cai listening on http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}/ (${where})`);
  if (!fs.existsSync(distIndex)) {
    console.log("Tip: run `npm run build` then `npm start` to serve the web UI from this process.");
  }
});
