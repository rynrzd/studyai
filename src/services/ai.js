// ─── src/services/ai.js ────────────────────────────────────────────────────────
// AI service — all requests proxied through /api/ai (server-side)
// The Anthropic API key NEVER appears in frontend code or network requests.
// ─────────────────────────────────────────────────────────────────────────────

import { buildAIContext } from "./aiContextBuilder.js";

export function buildSystemPrompt(user) {
  return buildAIContext(user, null);
}

// ── Internal proxy call ───────────────────────────────────────────────────────
async function callClaude({ systemPrompt, messages, imageBase64 }) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, messages, imageBase64: imageBase64 || null }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Service IA temporairement indisponible.");
  }

  const data = await res.json();
  return data.text || "Aucune réponse reçue.";
}

// Keep export name identical so Chat.jsx requires zero changes
export const callOpenAI = callClaude;

// ── Exercise generator ────────────────────────────────────────────────────────
export async function generateExercises({ subject, classe, count = 3 }) {
  const prompt = `Génère ${count} exercices de ${subject} pour un élève de ${classe}.
Format pour chaque exercice :
**Exercice N :** [énoncé]
**Correction :** [réponse détaillée]

Adapte la difficulté au niveau ${classe}. Réponds en français uniquement.`;

  return callClaude({
    systemPrompt: "Tu es un professeur expert qui génère des exercices pédagogiques.",
    messages: [{ role: "user", content: prompt }],
  });
}

// ── Revision plan generator ───────────────────────────────────────────────────
export async function generateRevisionPlan({ progress, classe }) {
  const weakSubjects = Object.entries(progress)
    .filter(([, p]) => p.avg !== undefined && p.avg < 12)
    .map(([s]) => s)
    .join(", ") || "toutes les matières";

  const prompt = `Crée un plan de révision hebdomadaire pour un élève de ${classe}.
Matières à renforcer en priorité : ${weakSubjects}.
Format : planning jour par jour (Lundi à Dimanche) avec créneaux de 45 min.
Inclus des pauses et des révisions légères le week-end. Réponds en français.`;

  return callClaude({
    systemPrompt: "Tu es un coach scolaire expert en organisation et planification.",
    messages: [{ role: "user", content: prompt }],
  });
}
