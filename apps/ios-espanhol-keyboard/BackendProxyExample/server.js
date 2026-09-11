// Reference implementation of the "secure backend" architecture described in
// ../README.md § "API Key da Anthropic".
//
// This is the ONLY place, in a production deployment, where the real
// Anthropic API key exists. The iOS app and its keyboard extension never see
// it — they call this server, which calls Anthropic and relays the result.
//
// This file is a starting point, not a hardened production server. Before
// deploying for real users, at minimum add: proper user authentication
// (e.g. Sign in with Apple + signed tokens) instead of the shared-secret
// header below, per-user rate limiting/quotas, structured error monitoring,
// and TLS termination (or run behind a provider that does it for you).

const express = require("express");
const rateLimit = require("express-rate-limit");
const Anthropic = require("@anthropic-ai/sdk");

const PORT = process.env.PORT || 8787;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const APP_SHARED_SECRET = process.env.APP_SHARED_SECRET; // simple app-level gate, NOT the Anthropic key
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

if (!ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY environment variable.");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const app = express();
app.use(express.json({ limit: "64kb" })); // chat-length text only, not attachments

// Coarse abuse protection. Replace with per-user limits once you have real
// authentication — an IP-based limit alone is not enough for production.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

function requireAppSecret(req, res, next) {
  if (!APP_SHARED_SECRET) return next(); // allowed for local dev without a secret configured
  const provided = req.header("x-app-secret");
  if (provided !== APP_SHARED_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.post("/v1/translate", requireAppSecret, async (req, res) => {
  const { system, text } = req.body || {};

  if (typeof system !== "string" || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "system and text are required strings" });
  }
  if (text.length > 4000) {
    return res.status(413).json({ error: "text too long" });
  }

  try {
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: text }],
    });

    const block = message.content && message.content[0];
    const resultText = block && block.type === "text" ? block.text.trim() : "";

    if (!resultText) {
      return res.status(502).json({ error: "empty completion" });
    }

    // Deliberately: no logging of `text` or `resultText` anywhere above this
    // line or below it — message content must never reach disk or a log
    // aggregator.
    return res.json({ text: resultText });
  } catch (error) {
    console.error("anthropic_request_failed", { status: error?.status });
    return res.status(502).json({ error: "translation_failed" });
  }
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`espanhol-ia-keyboard-proxy listening on :${PORT}`);
});
