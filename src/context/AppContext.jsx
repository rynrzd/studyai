// ─── src/context/AppContext.jsx ───────────────────────────────────────────────
// État global de l'application
// Gère : utilisateur, profils famille, chats, progression, gamification
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { XP_REWARDS, LEVEL_THRESHOLDS, BADGES } from "../data/constants.js";
import { generateSubjects, getLegacyMap } from "../services/subjectGenerator.js";
import { updateAccount } from "../services/auth.js";

const AppContext = createContext(null);

// ── localStorage helper ───────────────────────────────────────────────────────
function useLS(key, def) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; }
    catch { return def; }
  });
  const set = useCallback(val => {
    setV(val);
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key]);
  return [v, set];
}

// ── Calcul du niveau depuis XP ────────────────────────────────────────────────
function calcLevel(xp) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function xpToNextLevel(xp) {
  const lvl = calcLevel(xp);
  const next = LEVEL_THRESHOLDS[lvl] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const cur  = LEVEL_THRESHOLDS[lvl - 1] ?? 0;
  const pct  = Math.min(100, Math.round(((xp - cur) / (next - cur)) * 100));
  return { level: lvl, pct, xpNext: next - xp };
}

// ─────────────────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  const [screen,          setScreen]         = useState("landing");
  const [user,            setUserLS]         = useLS("sai_user",    null);
  const [chats,           setChats]          = useLS("sai_chats",   {});
  const [dark,            setDarkLS]         = useLS("sai_dark",    false);
  const [familyProfiles,  setFamilyProfiles] = useLS("sai_family",  []);
  const [activeProfileId, setActiveProfileId]= useLS("sai_active_profile", null);
  const [progress,        setProgress]       = useLS("sai_progress",{});  // { uid: { subject: { avg, sessions, notes[] } } }
  const [gamification,    setGamification]   = useLS("sai_game",    {});  // { uid: { xp, badges[], quizCount, streak } }
  const [profiles,        setProfiles]       = useLS("sai_profiles",{});  // { uid: { level, languages, hasSport, grades } }
  const [xpPopup,         setXpPopup]        = useState(null); // { amount, x, y }
  const [payPlan,         setPayPlan]        = useState(null);
  const [authMode,        setAuthMode]       = useState("login");

  // ── Thème ─────────────────────────────────────────────────────────────────
  const setDark = useCallback((val) => {
    setDarkLS(val);
    document.documentElement.setAttribute("data-theme", val ? "dark" : "light");
    document.body.style.background = val ? "#07091a" : "#f4f6fb";
  }, [setDarkLS]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.body.style.background = dark ? "#07091a" : "#f4f6fb";
  }, []);

  // ── Profil actif (famille ou utilisateur principal) ───────────────────────
  const activeProfile = activeProfileId
    ? familyProfiles.find(p => p.id === activeProfileId) || null
    : null;
  const currentUser = activeProfile || user;
  const uid = currentUser?.email || currentUser?.id || "guest";

  // ── User Profile (level, languages, hasSport, grades) ────────────────────
  const currentProfile = profiles[uid] || null;
  // hasProfile: true if profile exists OR if main user already completed onboarding
  // (prevents onboarding from repeating if profile localStorage was cleared)
  const hasProfile = !!currentProfile || (!activeProfileId && !!user?.onboardingDone);

  // Auto-restore minimal profile for main user who completed onboarding but lost profile data
  useEffect(() => {
    if (!user || activeProfileId) return;
    if (user.onboardingDone && !profiles[uid]) {
      setProfiles(prev => ({
        ...prev,
        [uid]: { level: user.classe || "3e", languages: [], hasSport: false, grades: {} },
      }));
    }
  }, [user?.email, user?.onboardingDone]);

  // Merge user.classe into profile as level fallback
  const effectiveProfile = currentProfile
    ? { ...currentProfile, role: currentUser?.role, name: currentUser?.name, aiName: currentUser?.aiName }
    : currentUser
      ? { level: currentUser.classe, role: currentUser.role, name: currentUser.name, aiName: currentUser.aiName }
      : null;

  // Subjects dynamically generated from profile
  const activeSubjects = effectiveProfile ? generateSubjects(effectiveProfile) : [];

  const saveProfile = useCallback((updates) => {
    setProfiles(prev => ({
      ...prev,
      [uid]: { ...(prev[uid] || {}), ...updates }
    }));
  }, [uid, setProfiles]);

  const updateProfileGrade = useCallback((subjectId, value) => {
    setProfiles(prev => {
      const cur = prev[uid] || {};
      return { ...prev, [uid]: { ...cur, grades: { ...(cur.grades || {}), [subjectId]: value } } };
    });
  }, [uid, setProfiles]);

  // Migrate legacy subject IDs in progress (sciences→svt, histoire→hg)
  useEffect(() => {
    if (!uid || uid === "guest") return;
    const legacyMap = getLegacyMap();
    const userProgress = progress[uid];
    if (!userProgress) return;
    const needsMigration = Object.keys(userProgress).some(k => legacyMap[k]);
    if (!needsMigration) return;
    setProgress(prev => {
      const cur = { ...(prev[uid] || {}) };
      Object.entries(legacyMap).forEach(([old, next]) => {
        if (cur[old]) {
          if (!cur[next]) cur[next] = cur[old];
          delete cur[old];
        }
      });
      return { ...prev, [uid]: cur };
    });
  }, [uid]);

  // ── Écran ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      // Family plan with child profiles → show Netflix profile selector
      if (user.plan === "famille" && familyProfiles.length > 0) {
        setScreen("profileselect");
      } else {
        setScreen("chat");
      }
    }
  }, []);

  // ── Chats — isolation stricte par (uid + mode) ────────────────────────────
  const getMessages = useCallback((mode) => {
    const key = `${uid}:${mode}`;
    return chats[key] || [];
  }, [uid, chats]);

  const addMessage = useCallback((mode, msg) => {
    const key = `${uid}:${mode}`;
    setChats(p => ({ ...p, [key]: [...(p[key] || []), msg] }));
  }, [uid, setChats]);

  const clearMessages = useCallback((mode) => {
    const key = `${uid}:${mode}`;
    setChats(p => ({ ...p, [key]: [] }));
  }, [uid, setChats]);

  // ── Progression & Notes ───────────────────────────────────────────────────
  const getProgress = useCallback(() => progress[uid] || {}, [uid, progress]);

  const addNote = useCallback((subject, note) => {
    setProgress(prev => {
      const cur = prev[uid]?.[subject] || { notes: [], sessions: 0 };
      const notes = [...(cur.notes || []), { value: note, date: Date.now() }].slice(-20);
      const avg = Math.round((notes.reduce((s, n) => s + n.value, 0) / notes.length) * 10) / 10;
      return { ...prev, [uid]: { ...(prev[uid] || {}), [subject]: { ...cur, notes, avg, sessions: cur.sessions } } };
    });
  }, [uid, setProgress]);

  const incrementSession = useCallback((subject) => {
    setProgress(prev => {
      const cur = prev[uid]?.[subject] || { notes: [], sessions: 0 };
      return { ...prev, [uid]: { ...(prev[uid] || {}), [subject]: { ...cur, sessions: cur.sessions + 1 } } };
    });
  }, [uid, setProgress]);

  // ── Gamification — XP + badges ────────────────────────────────────────────
  const getGame = useCallback(() => gamification[uid] || { xp: 0, badges: [], quizCount: 0, streak: 0, lastActive: null }, [uid, gamification]);

  // Ref so addXP can read the current plan without needing it in deps
  const planRef = useRef(currentUser?.plan);
  useEffect(() => { planRef.current = currentUser?.plan; });

  const addXP = useCallback((amount, eventX, eventY) => {
    // 1.5x XP multiplier for premium/famille subscribers
    const isPremium = ["premium", "famille"].includes(planRef.current);
    const boosted = isPremium ? Math.round(amount * 1.5) : amount;

    setGamification(prev => {
      const cur = prev[uid] || { xp: 0, badges: [], quizCount: 0, streak: 0, lastActive: null };
      // ── Streak logic ────────────────────────────────────────────────
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      let streak = cur.streak || 0;
      let bonus = 0;
      if (cur.lastActive !== today) {
        if (cur.lastActive === yesterday) {
          streak += 1;
          if (streak === 3)  bonus = isPremium ? 30 : 20;
          if (streak === 7)  bonus = isPremium ? 75 : 50;
          if (streak === 30) bonus = isPremium ? 300 : 200;
        } else if (cur.lastActive !== null) {
          streak = 1;
        } else {
          streak = 1;
        }
      }
      return { ...prev, [uid]: { ...cur, xp: cur.xp + boosted + bonus, streak, lastActive: today } };
    });
    if (eventX !== undefined) {
      setXpPopup({ amount: boosted, x: eventX, y: eventY });
      setTimeout(() => setXpPopup(null), 1200);
    }
  }, [uid, setGamification]);

  const unlockBadge = useCallback((badgeId) => {
    setGamification(prev => {
      const cur = prev[uid] || { xp: 0, badges: [], quizCount: 0, streak: 0 };
      if (cur.badges.includes(badgeId)) return prev;
      return { ...prev, [uid]: { ...cur, badges: [...cur.badges, badgeId] } };
    });
  }, [uid, setGamification]);

  const incrementQuiz = useCallback(() => {
    setGamification(prev => {
      const cur = prev[uid] || { xp: 0, badges: [], quizCount: 0, streak: 0 };
      const newCount = cur.quizCount + 1;
      const updated = { ...cur, quizCount: newCount };
      if (newCount >= 5 && !cur.badges.includes("quiz_5")) {
        updated.badges = [...(cur.badges || []), "quiz_5"];
      }
      return { ...prev, [uid]: updated };
    });
  }, [uid, setGamification]);

  // ── Profils famille ───────────────────────────────────────────────────────
  const addFamilyProfile = useCallback((profile) => {
    if (familyProfiles.length >= 5) return false;
    const newProfile = { ...profile, id: `fp_${Date.now()}`, createdAt: Date.now() };
    setFamilyProfiles(prev => [...prev, newProfile]);
    return newProfile;
  }, [familyProfiles, setFamilyProfiles]);

  const updateFamilyProfile = useCallback((id, updates) => {
    setFamilyProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, [setFamilyProfiles]);

  const removeFamilyProfile = useCallback((id) => {
    setFamilyProfiles(prev => prev.filter(p => p.id !== id));
    if (activeProfileId === id) setActiveProfileId(null);
  }, [setFamilyProfiles, activeProfileId, setActiveProfileId]);

  // ── Auth helpers ──────────────────────────────────────────────────────────
  const login = useCallback((u) => {
    setUserLS(u);
    if (u?.plan === "famille" && familyProfiles.length > 0) {
      setScreen("profileselect");
    } else {
      setScreen("chat");
    }
  }, [setUserLS, familyProfiles.length]);
  const logout = useCallback(() => { setUserLS(null); setActiveProfileId(null); setScreen("landing"); }, [setUserLS, setActiveProfileId]);
  const updateUser = useCallback((updates) => {
    setUserLS(prev => {
      const merged = { ...(prev || {}), ...updates };
      if (merged?.email) {
        try { updateAccount(merged.email, updates); } catch {}
      }
      return merged;
    });
  }, [setUserLS]);

  // ─────────────────────────────────────────────────────────────────────────
  // ── Plan flags ─────────────────────────────────────────────────────────────
  const isPaid       = ["premium", "famille"].includes(currentUser?.plan);
  const isFamilyMode = currentUser?.plan === "famille";
  const isParentMode = isFamilyMode && !activeProfileId;

  const value = {
    // Navigation
    screen, setScreen,
    // Auth
    user, login, logout, updateUser,
    // Current identity
    currentUser, uid,
    // Famille
    familyProfiles, activeProfileId, activeProfile,
    setActiveProfileId, addFamilyProfile, updateFamilyProfile, removeFamilyProfile,
    isPaid, isFamilyMode, isParentMode,
    // Chat
    getMessages, addMessage, clearMessages,
    // Progression
    getProgress, addNote, incrementSession,
    // Gamification
    getGame, addXP, unlockBadge, incrementQuiz, xpPopup,
    // Profile system
    currentProfile, effectiveProfile, hasProfile, activeSubjects, saveProfile, updateProfileGrade,
    // Raw stores — for parent dashboard cross-profile reading
    allProfiles: profiles,
    allGameData: gamification,
    allProgress: progress,
    // Theme
    dark, setDark,
    // Payment
    payPlan, setPayPlan,
    authMode, setAuthMode,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp doit être dans AppProvider");
  return ctx;
}
