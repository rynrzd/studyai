// api/ai.js — Secure Anthropic proxy (Vercel serverless function)
// API key stays server-side. Browser calls /api/ai, never api.anthropic.com.

// Load .env for local dev. No-op in production (Vercel injects vars from dashboard).
import "dotenv/config";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Service IA indisponible : clé API manquante." });
  }

  const { systemPrompt, messages, imageBase64 } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages requis." });
  }

  // Build messages array — enforce role alternation and length limits
  let msgArray = messages.map((m) => ({
    role:    m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 12000),
  }));

  if (msgArray.length > 60) {
    msgArray = msgArray.slice(-60);
  }

  // Attach image to last user message (optional)
  if (imageBase64 && typeof imageBase64 === "string") {
    const last = msgArray[msgArray.length - 1];
    if (last.role === "user") {
      msgArray[msgArray.length - 1] = {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64.slice(0, 5 * 1024 * 1024) } },
          { type: "text",  text: String(last.content) || "Analyse ce document." },
        ],
      };
    }
  }

  const requestBody = {
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    messages:   msgArray,
  };

  const system = String(systemPrompt || "").trim();
  if (system) requestBody.system = system.slice(0, 6000);

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    const text = await anthropicRes.text();

    if (!anthropicRes.ok) {
      console.error("[api/ai] Anthropic error:", anthropicRes.status, text);
      let detail = text;
      try { detail = JSON.parse(text)?.error?.message || text; } catch {}
      return res.status(502).json({ error: `Erreur IA ${anthropicRes.status}: ${detail}` });
    }

    const data  = JSON.parse(text);
    const reply = data?.content?.[0]?.text || "Aucune réponse reçue.";
    return res.status(200).json({ reply });

  } catch (err) {
    console.error("[api/ai] Fetch error:", err.message);
    return res.status(500).json({ error: "Erreur serveur : " + err.message });
  }
}
