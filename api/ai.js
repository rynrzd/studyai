// api/ai.js — Secure Anthropic proxy (Vercel serverless function)
// API key stays server-side. Browser calls /api/ai, never api.anthropic.com.

import "dotenv/config";

const MODEL   = "claude-3-haiku-20240307";
const MAX_TOK = 2000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[api/ai] ANTHROPIC_API_KEY manquante");
    return res.status(500).json({ error: "Service IA temporairement indisponible." });
  }

  const { systemPrompt, messages, imageBase64 } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages requis." });
  }

  // ── Build a valid messages array ──────────────────────────────────────────
  // 1. Normalise roles — only "user" and "assistant"
  // 2. Ensure strict alternation (merge consecutive same-role messages)
  // 3. Must start with "user"
  // 4. Hard cap at 20 messages
  let raw = messages
    .map(m => ({
      role:    m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").trim().slice(0, 8000),
    }))
    .filter(m => m.content.length > 0)
    .slice(-20);

  // Enforce alternation: merge consecutive same-role into one
  const merged = [];
  for (const m of raw) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === m.role) {
      prev.content += "\n" + m.content;
    } else {
      merged.push({ role: m.role, content: m.content });
    }
  }

  // Must start with "user"
  if (merged[0]?.role !== "user") {
    merged.unshift({ role: "user", content: "Bonjour." });
  }

  // Attach image to last user message (optional)
  if (imageBase64 && typeof imageBase64 === "string") {
    const last = merged[merged.length - 1];
    if (last.role === "user") {
      merged[merged.length - 1] = {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type:       "base64",
              media_type: "image/jpeg",
              data:       imageBase64.slice(0, 5 * 1024 * 1024),
            },
          },
          { type: "text", text: String(last.content) || "Analyse ce document." },
        ],
      };
    }
  }

  const body = {
    model:      MODEL,
    max_tokens: MAX_TOK,
    messages:   merged,
  };

  const system = String(systemPrompt || "").trim().slice(0, 6000);
  if (system) body.system = system;

  // ── Call Anthropic ────────────────────────────────────────────────────────
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const raw = await response.text();

    if (!response.ok) {
      console.error("[api/ai] Anthropic error", response.status, raw.slice(0, 400));
      return res.status(502).json({ error: "Service IA temporairement indisponible. Réessaie dans quelques secondes." });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error("[api/ai] JSON parse error:", raw.slice(0, 200));
      return res.status(502).json({ error: "Réponse IA invalide. Réessaie." });
    }

    const text = data?.content?.[0]?.text;
    if (!text) {
      console.error("[api/ai] Empty reply:", JSON.stringify(data).slice(0, 200));
      return res.status(502).json({ error: "Réponse IA vide. Réessaie." });
    }

    return res.status(200).json({ text });

  } catch (err) {
    console.error("[api/ai] Network error:", err.message);
    return res.status(500).json({ error: "Erreur réseau. Vérifie ta connexion et réessaie." });
  }
}
