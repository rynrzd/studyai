// ─── src/services/auth.js ─────────────────────────────────────────────────────
// Auth via localStorage (remplaçable par Firebase)
// ─────────────────────────────────────────────────────────────────────────────

import { CLASSES } from "../data/constants.js";

const ACCOUNTS_KEY = "sai_accounts";

function getAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}"); }
  catch { return {}; }
}

function saveAccounts(acc) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(acc));
}

// ── Inscription ───────────────────────────────────────────────────────────────
export function register({ name, email, password, classe, matiere, noteActuelle }) {
  const accounts = getAccounts();
  if (accounts[email]) throw new Error("Cet email est déjà utilisé.");

  const cls = CLASSES.find(c => c.v === classe);
  const user = {
    name, email, pwd: password,
    classe, age: cls?.age || 14,
    role:          classe === "prof" ? "prof" : "eleve",
    plan:          "free",
    aiName:        "Study AI",
    questionsLeft: 20,
    photosLeft:    4,
    questionsResetDate: new Date().toDateString(),
    photosResetDate:    new Date().toDateString(),
    createdAt: Date.now(),
    // Champs optionnels du questionnaire d'inscription
    ...(matiere      ? { matierePref: matiere }              : {}),
    ...(noteActuelle ? { noteDepart:  Number(noteActuelle) } : {}),
  };

  accounts[email] = user;
  saveAccounts(accounts);
  return user;
}

// ── Connexion ─────────────────────────────────────────────────────────────────
export function login(email, password) {
  const accounts = getAccounts();
  const user = accounts[email];
  if (!user)            throw new Error("Aucun compte avec cet email.");
  if (user.pwd !== password) throw new Error("Mot de passe incorrect.");

  // Reset limites quotidiennes
  const today = new Date().toDateString();
  const updated = { ...user };
  if (user.questionsResetDate !== today) { updated.questionsLeft = 20; updated.questionsResetDate = today; }
  if (user.photosResetDate    !== today) { updated.photosLeft    = 4;  updated.photosResetDate    = today; }
  accounts[email] = updated;
  saveAccounts(accounts);
  return updated;
}

// ── Mise à jour du profil ─────────────────────────────────────────────────────
export function updateAccount(email, updates) {
  const accounts = getAccounts();
  if (!accounts[email]) return;
  accounts[email] = { ...accounts[email], ...updates };
  saveAccounts(accounts);
  return accounts[email];
}

// ── Générer un code de vérification (console) ─────────────────────────────────
export function generateVerifCode(email) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const payload = { code, email, expires: Date.now() + 5 * 60 * 1000 };
  localStorage.setItem("sai_pending_code", JSON.stringify(payload));
  console.log(`%c🔐 Code de vérification Study AI : ${code}`, "color:#5046e4;font-size:18px;font-weight:bold;background:#f0efff;padding:6px 12px;border-radius:8px");
  return code;
}

// ── Vérifier le code ──────────────────────────────────────────────────────────
export function verifyCode(email, inputCode) {
  try {
    const stored = JSON.parse(localStorage.getItem("sai_pending_code") || "null");
    if (!stored) throw new Error("Aucun code en attente.");
    if (stored.email   !== email)    throw new Error("Email ne correspond pas.");
    if (Date.now()     >  stored.expires) throw new Error("Code expiré. Recommence.");
    if (stored.code    !== inputCode) throw new Error("Code incorrect.");
    localStorage.removeItem("sai_pending_code");
    return true;
  } catch (e) {
    throw new Error(e.message || "Code invalide.");
  }
}
