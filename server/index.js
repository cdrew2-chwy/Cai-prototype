import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";
import { CAI_SYSTEM_PROMPT } from "./caiSystemPrompt.js";
import { buildWelcomeSystemPrompt } from "./welcomePrompt.js";

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

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: Boolean(apiKey()) });
});

/**
 * POST /api/welcome
 * Body: { parentProfile?: string, petProfile?: string, shoppingHistory?: string }
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

    const { parentProfile = "", petProfile = "", shoppingHistory = "" } = req.body || {};

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
        { role: "system", content: buildWelcomeSystemPrompt() },
        {
          role: "user",
          content: `Context bundle for the welcome screen:\n\n${bundle}\n\nWrite Cai's welcome message now.`,
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
 * Body: { messages: { role: 'user'|'assistant', content: string }[], context?: string }
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

    const { messages, context } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Expected body.messages as a non-empty array." });
      return;
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

    const reply = completion.choices[0]?.message?.content ?? "";
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
