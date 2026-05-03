// ─── src/services/subjectGenerator.js ────────────────────────────────────────
// Generates a user's subject list from their profile.
// "Sciences" is NEVER used — real school structure only.
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_SUBJECTS = {
  maths:    { id: "maths",    label: "Maths",            icon: "📐", color: "#6366f1" },
  francais: { id: "francais", label: "Français",         icon: "📖", color: "#ec4899" },
  hg:       { id: "hg",       label: "Histoire-Géo",     icon: "🏛️", color: "#f59e0b" },
  anglais:  { id: "anglais",  label: "Anglais",          icon: "🌍", color: "#3b82f6" },
  svt:      { id: "svt",      label: "SVT",              icon: "🌿", color: "#10b981" },
  physique: { id: "physique", label: "Physique-Chimie",  icon: "⚗️", color: "#06b6d4" },
  techno:   { id: "techno",   label: "Technologie",      icon: "💻", color: "#0ea5e9" },
  snt:      { id: "snt",      label: "SNT",              icon: "💡", color: "#0284c7" },
  ses:      { id: "ses",      label: "SES",              icon: "📊", color: "#f97316" },
  philo:    { id: "philo",    label: "Philosophie",      icon: "💭", color: "#8b5cf6" },
  bac:      { id: "bac",      label: "Révision Bac",     icon: "🎓", color: "#ef4444" },
  espagnol: { id: "espagnol", label: "Espagnol",         icon: "🇪🇸", color: "#f59e0b" },
  allemand: { id: "allemand", label: "Allemand",         icon: "🇩🇪", color: "#dc2626" },
  italien:  { id: "italien",  label: "Italien",          icon: "🇮🇹", color: "#16a34a" },
  sport:    { id: "sport",    label: "Sport",            icon: "⚽", color: "#64748b", noAI: true },
  general:  { id: "general",  label: "Général",          icon: "💬", color: "#64748b" },
};

export const LANGUAGE_OPTIONS = [
  { id: "espagnol", label: "Espagnol", icon: "🇪🇸" },
  { id: "allemand", label: "Allemand", icon: "🇩🇪" },
  { id: "italien",  label: "Italien",  icon: "🇮🇹" },
];

const COLLEGE = ["6e", "5e", "4e", "3e"];
const LYCEE   = ["2nde", "1ere", "terminale"];

export function generateSubjects(profile) {
  const level     = profile?.level || "3e";
  const languages = profile?.languages || [];
  const hasSport  = !!profile?.hasSport;

  const isCollege    = COLLEGE.includes(level);
  const isLycee      = LYCEE.includes(level);
  const isTerminale  = level === "terminale";
  const isProf       = profile?.role === "prof";

  const pick = (...ids) => ids.map(id => ALL_SUBJECTS[id]).filter(Boolean);

  if (isProf) {
    return [
      ...pick("maths","francais","hg","anglais","svt","physique","philo"),
      ...languages.map(l => ALL_SUBJECTS[l]).filter(Boolean),
      ALL_SUBJECTS.general,
    ];
  }

  const subjects = pick("maths", "francais", "hg", "anglais", "svt", "physique");

  if (isCollege) subjects.push(ALL_SUBJECTS.techno);
  if (level === "2nde") subjects.push(ALL_SUBJECTS.snt);
  if (isLycee)   subjects.push(ALL_SUBJECTS.philo);
  if (isTerminale) subjects.push(ALL_SUBJECTS.bac);

  // User-selected specialty subjects (e.g. SES)
  const specialties = profile?.specialties || [];
  specialties.forEach(s => {
    if (ALL_SUBJECTS[s] && !subjects.find(sub => sub.id === s)) {
      subjects.push(ALL_SUBJECTS[s]);
    }
  });

  languages.forEach(l => { if (ALL_SUBJECTS[l]) subjects.push(ALL_SUBJECTS[l]); });
  if (hasSport) subjects.push(ALL_SUBJECTS.sport);

  return subjects;
}

// Maps legacy subject IDs to new ones (migration)
export function migrateSubjectId(id) {
  const MAP = { sciences: "svt", histoire: "hg" };
  return MAP[id] || id;
}

// Returns a flat list of all subject IDs that map to a legacy ID
export function getLegacyMap() {
  return { sciences: "svt", histoire: "hg" };
}
