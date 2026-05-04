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

// ── AI Quiz generator ─────────────────────────────────────────────────────────
const DIFF_LABELS = {
  1: "QCM simples — définitions et connaissances de base",
  2: "QCM avec pièges — notions intermédiaires, confusions classiques",
  3: "Réflexion et analyse — application des concepts, raisonnement logique",
};

export async function generateAIQuiz({ subject, theme, count = 5, difficulty = 1, excludeQuestions = [] }) {
  const topic = theme ? `${subject} — thème : ${theme}` : subject;
  const diffLabel = DIFF_LABELS[difficulty] || DIFF_LABELS[1];
  const excludeClause = excludeQuestions.length > 0
    ? `\n\nÉVITE ces questions déjà posées (ne les répète pas) :\n${excludeQuestions.slice(-15).map(q => `- ${q}`).join("\n")}`
    : "";

  const prompt = `Génère ${count} questions de révision en français sur "${topic}".
Niveau de difficulté : ${difficulty}/3 — ${diffLabel}${excludeClause}

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ni après :
[
  {
    "question": "La question ici ?",
    "choices": ["Choix A", "Choix B", "Choix C", "Choix D"],
    "correctAnswer": "Choix A",
    "explanation": "Explication courte ici."
  }
]

RÈGLES STRICTES :
- Exactement 4 choix distincts par question
- correctAnswer doit être EXACTEMENT l'un des 4 choix (copie exacte)
- Aucun doublon dans les choices
- Questions adaptées lycée/collège, en français
- Respecte le niveau de difficulté demandé`;

  const raw = await callClaude({
    systemPrompt: "Tu es un générateur de quiz scolaires. Réponds UNIQUEMENT avec du JSON valide, aucun texte autour.",
    messages: [{ role: "user", content: prompt }],
  });

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Réponse IA non formatée en JSON");

  let questions;
  try { questions = JSON.parse(jsonMatch[0]); }
  catch { throw new Error("JSON invalide dans la réponse IA"); }

  const valid = questions.filter(q =>
    typeof q.question === "string" && q.question.length > 0 &&
    Array.isArray(q.choices) && q.choices.length === 4 &&
    typeof q.correctAnswer === "string" &&
    q.choices.includes(q.correctAnswer) &&
    new Set(q.choices).size === 4
  );

  if (valid.length < 1) throw new Error("Aucune question valide générée");
  return valid.slice(0, count);
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
