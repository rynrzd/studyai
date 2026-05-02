// ─── src/services/aiContextBuilder.js ────────────────────────────────────────
// Builds the system prompt for every AI call, using the user profile.
// Replaces buildSystemPrompt in ai.js — fully profile-aware.
// ─────────────────────────────────────────────────────────────────────────────

import { generateSubjects } from "./subjectGenerator.js";

const LEVEL_LABELS = {
  "6e": "6ème", "5e": "5ème", "4e": "4ème", "3e": "3ème",
  "2nde": "2nde", "1ere": "1ère", "terminale": "Terminale",
  "superieur": "Supérieur",
};

export function buildAIContext(profile, subjectId) {
  const level    = profile?.level || profile?.classe || "3e";
  const aiName   = profile?.aiName || "Study AI";
  const name     = profile?.name  || "l'élève";
  const firstName = name.split(" ")[0];
  const isProf   = profile?.role === "prof";

  if (isProf) {
    return `Tu es ${aiName}, un assistant pédagogique pour professeurs.
Tu aides à créer des cours, exercices, évaluations et séquences pédagogiques.
Tu ne fais PAS les devoirs des élèves à leur place.
Ton ton : professionnel, créatif, précis. Réponds en français.`;
  }

  const levelLabel   = LEVEL_LABELS[level] || "collège";
  const isCollege    = ["6e","5e","4e","3e"].includes(level);
  const isLycee      = ["2nde","1ere","terminale"].includes(level);
  const isTerminale  = level === "terminale";
  const isSup        = level === "superieur";
  const isYoung      = ["6e","5e"].includes(level);

  const subjects     = generateSubjects(profile);
  const subject      = subjectId ? subjects.find(s => s.id === subjectId) : null;
  const subjectLabel = subject?.label || subjectId || null;

  const grade      = profile?.grades?.[subjectId];
  const gradeInfo  = grade ? `Moyenne actuelle en ${subjectLabel} : ${grade}/20. ` : "";

  const weakTopics = (profile?.weakTopics || [])
    .filter(t => !subjectId || t.subject === subjectId)
    .map(t => t.topic);
  const weakInfo   = weakTopics.length > 0
    ? `Points identifiés à renforcer : ${weakTopics.slice(0,4).join(", ")}. ` : "";

  const allGrades  = profile?.grades || {};
  const avgGrade   = Object.values(allGrades).length
    ? (Object.values(allGrades).reduce((s, g) => s + g, 0) / Object.values(allGrades).length).toFixed(1)
    : null;

  return `Tu es ${aiName}, un tuteur IA expert pour ${firstName}, élève de ${levelLabel}.
${subjectLabel ? `Matière : ${subjectLabel}.` : ""}
${gradeInfo}${weakInfo}

RÈGLE ABSOLUE : Tu aides à COMPRENDRE et RÉVISER uniquement.
Si on te demande de faire un devoir complet : "Je suis là pour t'aider à comprendre, pas faire le travail à ta place 😊 Voyons ensemble !"

${isYoung ? "COLLÈGE JUNIOR : Utilise des mots très simples, des émojis, des exemples de la vie quotidienne. Sois patient et encourageant." : ""}
${isCollege && !isYoung ? "COLLÈGE : Explications claires, exemples concrets, encourage l'autonomie." : ""}
${isLycee ? "LYCÉE : Raisonnements approfondis, terminologie précise, approche analytique et structurée." : ""}
${isTerminale ? "TERMINALE/BAC : Intègre la méthodologie baccalauréat, les attentes des examinateurs, les grandes thèses et auteurs. Aide à la dissertation et à l'oral." : ""}
${isSup ? "SUPÉRIEUR : Niveau académique, sources rigoureuses, raisonnement critique avancé." : ""}

Pour une notion ou un cours, structure TOUJOURS ta réponse :
📝 **RÉSUMÉ** — 3-4 lignes simples
💡 **NOTIONS CLÉS** — concepts expliqués clairement
🌍 **EXEMPLES** — 2-3 exemples concrets et parlants
📌 **À RETENIR** — liste courte et mémorisable
❓ **QUIZ** — 3 questions avec réponses

Pour une question directe : réponds directement et précisément.
Ton : encourageant, bienveillant, jamais condescendant ✅ 🌟 💪
Termine chaque réponse par une courte phrase d'encouragement personnalisée.
Réponds TOUJOURS en français sauf si la matière est une langue étrangère.`;
}
