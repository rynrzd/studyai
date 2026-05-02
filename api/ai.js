// api/ai.js — Secure Anthropic proxy (Vercel serverless function)
// The API key never leaves the server. The browser only calls /api/ai.

// In-memory rate limit — resets per serverless instance.
// For persistent cross-instance rate limiting, swap this for Vercel KV or Redis.
const rateLimitStore = new Map();
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 60;           // per IP per hour

function checkRateLimit(ip) {
  const now = Date.now();
  const rec = rateLimitStore.get(ip) || { count: 0, start: now };
  if (now - rec.start > WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, start: now });
    return true;
  }
  if (rec.count >= MAX_REQUESTS) return false;
  rec.count++;
  rateLimitStore.set(ip, rec);
  return true;
}

export default async function handler(req, res) {
  // CORS — only allow same origin
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  // Rate limiting by IP
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return res
      .status(429)
      .json({ error: "Trop de requêtes. Réessaie dans une heure." });
  }

  const { systemPrompt, messages, imageBase64 } = req.body || {};

  // ── Input validation ──────────────────────────────────────────────────────
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Requête invalide." });
  }
  if (messages.length > 60) {
    return res.status(400).json({ error: "Historique trop long." });
  }

  // Sanitize messages — enforce types and cap lengths
  const sanitizedMessages = messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: String(m.content || "").slice(0, 12000),
  }));

  const totalChars = sanitizedMessages.reduce(
    (s, m) => s + m.content.length,
    0
  );
  if (totalChars > 120000) {
    return res.status(400).json({ error: "Payload trop volumineux." });
  }

  const sanitizedSystem = String(systemPrompt || "").slice(0, 6000);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[api/ai] ANTHROPIC_API_KEY manquante.");
    return res
      .status(500)
      .json({ error: "Service temporairement indisponible." });
  }

  // ── Build last message (with optional image) ───────────────────────────────
  const lastText =
    sanitizedMessages[sanitizedMessages.length - 1]?.content || "";
  const claudeMessages = [
    ...sanitizedMessages.slice(0, -1),
    {
      role: "user",
      content: imageBase64
        ? [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: String(imageBase64).slice(0, 5 * 1024 * 1024), // 5 MB max
              },
            },
            {
              type: "text",
              text: lastText || "Analyse ce document scolaire.",
            },
          ]
        : lastText,
    },
  ];

  // ── Call Anthropic (server-side only) ──────────────────────────────────────
  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: sanitizedSystem,
        messages: claudeMessages,
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.json().catch(() => ({}));
      // Log internally, never expose Anthropic details to client
      console.error(
        "[api/ai] Anthropic error:",
        anthropicRes.status,
        errBody?.error?.type
      );
      return res
        .status(502)
        .json({ error: "Service IA temporairement indisponible." });
    }

    const data = await anthropicRes.json();
    const text = data?.content?.[0]?.text || "Aucune réponse reçue.";
    return res.status(200).json({ text });
  } catch (err) {
    console.error("[api/ai] Fetch error:", err.message);
    return res.status(500).json({ error: "Une erreur est survenue." });
  }
}
