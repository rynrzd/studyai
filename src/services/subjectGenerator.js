// ─── src/services/subjectGenerator.js ────────────────────────────────────────
// Generates a user's subject list from their profile.
// Rules:
//   2nde      → fixed mandatory set (SES + SNT always included, no Philo)
//   1ère      → Français + Anglais + chosen specialties (2-3 required)
//   Terminale → Philo + Anglais + Révision Bac + chosen specialties (2-3 required)
//   Collège   → standard set + Techno + languages + sport
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_SUBJECTS = {
  maths:    { id: "maths",    label: "Maths",            icon: "📐", color: "#6366f1" },
  francais: { id: "francais", label: "Français",         icon: "📖", color: "#ec4899" },
  hg:       { id: "hg",       label: "Histoire-Géo",     icon: "🏛️", color: "#f59e0b" },
  hggsp:    { id: "hggsp",    label: "HGGSP",            icon: "🌐", color: "#d97706" },
  anglais:  { id: "anglais",  label: "Anglais",          icon: "🌍", color: "#3b82f6" },
  svt:      { id: "svt",      label: "SVT",              icon: "🌿", color: "#10b981" },
  physique: { id: "physique", label: "Physique-Chimie",  icon: "⚗️", color: "#06b6d4" },
  techno:   { id: "techno",   label: "Technologie",      icon: "💻", color: "#0ea5e9" },
  snt:      { id: "snt",      label: "SNT",              icon: "💡", color: "#0284c7" },
  nsi:      { id: "nsi",      label: "NSI",              icon: "🖥️", color: "#2563eb" },
  ses:      { id: "ses",      label: "SES",              icon: "📊", color: "#f97316" },
  philo:    { id: "philo",    label: "Philosophie",      icon: "💭", color: "#8b5cf6" },
  bac:      { id: "bac",      label: "Révision Bac",     icon: "🎓", color: "#ef4444" },
  espagnol: { id: "espagnol", label: "Espagnol",         icon: "🇪🇸", color: "#f59e0b" },
  allemand: { id: "allemand", label: "Allemand",         icon: "🇩🇪", color: "#dc2626" },
  italien:  { id: "italien",  label: "Italien",          icon: "🇮🇹", color: "#16a34a" },
  sport:    { id: "sport",    label: "Sport",            icon: "⚽", color: "#64748b", noAI: true },
  general:  { id: "general",  label: "Général",          icon: "💬", color: "#64748b" },
};

// Selectable specialties for 1ère and Terminale
export const LYCEE_SPECIALTY_OPTIONS = [
  { id: "maths",    label: "Maths",           icon: "📐" },
  { id: "ses",      label: "SES",             icon: "📊" },
  { id: "hggsp",    label: "HGGSP",           icon: "🌐" },
  { id: "svt",      label: "SVT",             icon: "🌿" },
  { id: "physique", label: "Physique-Chimie", icon: "⚗️" },
  { id: "nsi",      label: "NSI",             icon: "🖥️" },
];

export const LANGUAGE_OPTIONS = [
  { id: "espagnol", label: "Espagnol", icon: "🇪🇸" },
  { id: "allemand", label: "Allemand", icon: "🇩🇪" },
  { id: "italien",  label: "Italien",  icon: "🇮🇹" },
];

const COLLEGE = ["6e", "5e", "4e", "3e"];

export function generateSubjects(profile) {
  const level       = profile?.level || "3e";
  const languages   = profile?.languages   || [];
  const hasSport    = !!profile?.hasSport;
  const specialties = profile?.specialties || [];
  const isProf      = profile?.role === "prof";

  const add = (arr, ...ids) => {
    ids.forEach(id => {
      if (ALL_SUBJECTS[id] && !arr.find(s => s.id === id)) arr.push(ALL_SUBJECTS[id]);
    });
  };

  if (isProf) {
    const s = [];
    add(s, "maths","francais","hg","anglais","svt","physique","philo");
    languages.forEach(l => add(s, l));
    add(s, "general");
    return s;
  }

  // ── 2nde: fixed mandatory set ─────────────────────────────────────────────
  if (level === "2nde") {
    const s = [];
    add(s, "maths","francais","hg","anglais","svt","physique","ses","snt");
    languages.forEach(l => add(s, l));
    if (hasSport) add(s, "sport");
    return s;
  }

  // ── 1ère: Français + Anglais + chosen specialties ──────────────────────────
  if (level === "1ere") {
    const s = [];
    add(s, "francais","anglais");
    specialties.forEach(id => add(s, id));
    languages.forEach(l => add(s, l));
    if (hasSport) add(s, "sport");
    return s;
  }

  // ── Terminale: Philo + Anglais + Bac + chosen specialties ─────────────────
  if (level === "terminale") {
    const s = [];
    add(s, "philo","anglais","bac");
    specialties.forEach(id => add(s, id));
    languages.forEach(l => add(s, l));
    if (hasSport) add(s, "sport");
    return s;
  }

  // ── Collège (6e→3e) ────────────────────────────────────────────────────────
  if (COLLEGE.includes(level)) {
    const s = [];
    add(s, "maths","francais","hg","anglais","svt","physique","techno");
    languages.forEach(l => add(s, l));
    if (hasSport) add(s, "sport");
    return s;
  }

  // ── Supérieur ──────────────────────────────────────────────────────────────
  const s = [];
  add(s, "maths","francais","anglais");
  languages.forEach(l => add(s, l));
  return s;
}

// Maps legacy subject IDs to new ones (migration)
export function migrateSubjectId(id) {
  const MAP = { sciences: "svt", histoire: "hg" };
  return MAP[id] || id;
}

export function getLegacyMap() {
  return { sciences: "svt", histoire: "hg" };
}
