// api/ai.js — Secure Anthropic proxy (Vercel serverless function)
// API key stays server-side. Browser calls /api/ai, never api.anthropic.com.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  // ── API key check ─────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[api/ai] ANTHROPIC_API_KEY manquante dans les variables d'environnement Vercel.");
    return res.status(500).json({ error: "Service IA indisponible." });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  // Vercel auto-parses JSON when Content-Type is application/json.
  // Manual fallback covers edge cases where body parser is bypassed.
  let body = req.body;
  if (!body || typeof body !== "object") {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Corps de requête invalide." });
    }
  }

  const { systemPrompt, messages, message, imageBase64 } = body;

  // ── Build messages array ──────────────────────────────────────────────────
  // Accepts both { messages } array (full conversation) and { message } string (simple).
  let msgArray;
  if (Array.isArray(messages) && messages.length > 0) {
    if (messages.length > 60) {
      return res.status(400).json({ error: "Historique trop long." });
    }
    msgArray = messages.map((m) => ({
      role:    m.role === "user" ? "user" : "assistant",
      content: String(m.content || "").slice(0, 12000),
    }));
  } else if (typeof message === "string" && message.trim()) {
    msgArray = [{ role: "user", content: message.trim().slice(0, 12000) }];
  } else {
    return res.status(400).json({ error: "Message requis." });
  }

  // ── Payload size guard ────────────────────────────────────────────────────
  const totalChars = msgArray.reduce((s, m) => s + String(m.content).length, 0);
  if (totalChars > 120000) {
    return res.status(400).json({ error: "Payload trop volumineux." });
  }

  // ── Attach image to last user message (optional) ──────────────────────────
  if (imageBase64 && typeof imageBase64 === "string") {
    const last = msgArray[msgArray.length - 1];
    if (last.role === "user") {
      msgArray[msgArray.length - 1] = {
        role: "user",
        content: [
          {
            type:   "image",
            source: {
              type:       "base64",
              media_type: "image/jpeg",
              data:       imageBase64.slice(0, 5 * 1024 * 1024),
            },
          },
          {
            type: "text",
            text: String(last.content) || "Analyse ce document scolaire.",
          },
        ],
      };
    }
  }

  // ── Anthropic request ─────────────────────────────────────────────────────
  const requestBody = {
    model:      "claude-3-haiku-20240307",
    max_tokens: 1200,
    messages:   msgArray,
  };

  // Only include system prompt when non-empty (empty string causes Anthropic errors)
  const system = String(systemPrompt || "").trim();
  if (system) requestBody.system = system.slice(0, 6000);

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.json().catch(() => ({}));
      const detail = errBody?.error?.message || errBody?.error || JSON.stringify(errBody);
      console.error("[api/ai] Anthropic error:", anthropicRes.status, detail);
      return res.status(502).json({ error: `IA erreur ${anthropicRes.status}: ${detail}` });
    }

    const data  = await anthropicRes.json();
    const reply = data?.content?.[0]?.text || "Aucune réponse reçue.";
    return res.status(200).json({ reply });

  } catch (err) {
    console.error("[api/ai] Fetch error:", err.message);
    return res.status(500).json({ error: "Une erreur est survenue." });
  }
}
