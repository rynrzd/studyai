// ─── src/pages/Chat.jsx ───────────────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../context/AppContext.jsx";
import { buildSystemPrompt, callOpenAI, generateExercises, generateRevisionPlan } from "../services/ai.js";
import { buildAIContext } from "../services/aiContextBuilder.js";
import { ALL_SUBJECTS } from "../services/subjectGenerator.js";
import { SUBJECTS, CHAT_MODES, RANDOM_QUESTIONS, FLASHCARDS_DB, XP_REWARDS, DAILY_CHALLENGES, BADGES as BADGES_DATA, LEVEL_THRESHOLDS } from "../data/constants.js";
import { Logo, Btn, fmtAI, InfoBox, ProgressBar } from "../components/SharedUI.jsx";

// ── Responsive hook ───────────────────────────────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 900);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return m;
}

// ── Activity tracking ─────────────────────────────────────────────────────────
function getActivityLog() {
  try { return JSON.parse(localStorage.getItem("sai_activity") || "{}"); } catch { return {}; }
}
function markToday() {
  try {
    const l = getActivityLog();
    const k = new Date().toISOString().split("T")[0];
    l[k] = (l[k] || 0) + 1;
    localStorage.setItem("sai_activity", JSON.stringify(l));
  } catch {}
}
function calcLvl(xp) { for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) if (xp >= LEVEL_THRESHOLDS[i]) return i + 1; return 1; }
function lvlInfo(xp) {
  const l = calcLvl(xp);
  const cur = LEVEL_THRESHOLDS[l - 1] ?? 0;
  const nxt = LEVEL_THRESHOLDS[l] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return { level: l, pct: Math.min(100, Math.round((xp - cur) / (nxt - cur) * 100)), xpNext: nxt - xp };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Chat() {
  const { currentUser, uid, dark, setDark, getMessages, addMessage, clearMessages, getProgress, incrementSession, addNote, getGame, addXP, unlockBadge, incrementQuiz, setScreen, logout, familyProfiles, activeProfileId, activeProfile, setActiveProfileId, addFamilyProfile, removeFamilyProfile, effectiveProfile, activeSubjects, isFamilyMode, isParentMode, allProfiles, allGameData, allProgress } = useApp();
  const isMobile = useIsMobile();

  // Navigation state
  const [view, setView]               = useState("home");
  const [activeSubjectId, setASId]    = useState(null);

  // Copilot / chat state
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [subject, setSubject]         = useState("general");
  const [mode, setMode]               = useState("cours");
  const [imgBase64, setImgBase64]     = useState(null);
  const [imgName, setImgName]         = useState(null);
  const [copied, setCopied]           = useState(null);
  const [guestCount, setGuestCount]   = useState(0);
  const [qLeft, setQLeft]             = useState(currentUser?.questionsLeft ?? 20);
  const [pLeft, setPLeft]             = useState(currentUser?.photosLeft ?? 4);

  // Panel overlays
  const [panel, setPanel]             = useState(null);
  const [examState, setExamState]     = useState(null);
  const [flashState, setFlashState]   = useState(null);

  // Planner / generation
  const [genContent, setGenContent]   = useState(null);
  const [genLoading, setGenLoading]   = useState(false);
  const [examDates, setExamDatesS]    = useState(() => { try { return JSON.parse(localStorage.getItem("sai_exam_dates") || "[]"); } catch { return []; } });

  const endRef   = useRef(null);
  const fileRef  = useRef(null);
  const inputRef = useRef(null);

  const isGuest = !currentUser;
  const isProf  = currentUser?.role === "prof";
  const isPaid  = ["premium", "famille"].includes(currentUser?.plan);
  const aiName  = currentUser?.aiName || "Study AI";
  const messages = getMessages(mode);
  const dailyChallenge = DAILY_CHALLENGES[new Date().getDay() % DAILY_CHALLENGES.length];
  const progress = getProgress();
  const game = getGame();
  const currentSubject = activeSubjects.find(s => s.id === subject) || ALL_SUBJECTS[subject] || null;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const openSubject = (id) => { setASId(id); setSubject(id); setView("subject"); };

  const saveExamDates = (d) => { setExamDatesS(d); try { localStorage.setItem("sai_exam_dates", JSON.stringify(d)); } catch {} };

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    if (!isPaid && pLeft <= 0) { addMessage(mode, { role: "assistant", content: "📷 Limite de 4 photos atteinte. Passe en Premium !", ts: Date.now() }); return; }
    const reader = new FileReader();
    reader.onload = ev => { setImgName(file.name); setImgBase64(ev.target.result.split(",")[1]); };
    reader.readAsDataURL(file);
    if (!isPaid) setPLeft(p => p - 1);
    e.target.value = "";
  };

  const copy = async (text, i) => { try { await navigator.clipboard.writeText(text); setCopied(i); setTimeout(() => setCopied(null), 2000); } catch {} };

  const send = async (text) => {
    const userText = (text || input).trim();
    if ((!userText && !imgBase64) || loading) return;
    if (isGuest && guestCount >= 5) { addMessage(mode, { role: "assistant", content: "😊 5 messages d'essai utilisés ! Crée un compte gratuit pour continuer.", ts: Date.now() }); return; }
    if (!isPaid && !isGuest && qLeft <= 0) { setScreen("pricing"); return; }
    const modePrefix = { quiz: "Génère uniquement un quiz de 5 questions (avec réponses) sur : ", simplifie: "Explique de manière encore plus simple : ", fiche: "Crée uniquement une fiche de révision structurée sur : " }[mode] || "";
    const sysPrompt = isGuest
      ? buildSystemPrompt({ classe: "3e", age: 14, role: "eleve", aiName: "Study AI" })
      : buildAIContext(effectiveProfile, subject);
    const userMsg = { role: "user", content: modePrefix + userText, mode, subject, ts: Date.now() };
    addMessage(mode, userMsg);
    setInput(""); setLoading(true);
    if (isGuest) setGuestCount(c => c + 1);
    if (!isPaid && !isGuest) setQLeft(q => q - 1);
    markToday();
    try {
      const history = [...messages, userMsg];
      const answer = await callOpenAI({ systemPrompt: sysPrompt, messages: history.slice(-12).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })), imageBase64: imgBase64 || null });
      setImgBase64(null); setImgName(null);
      addMessage(mode, { role: "assistant", content: answer, ts: Date.now() });
      addXP(XP_REWARDS.message); incrementSession(subject);
      if (!game.badges.includes("first_msg")) unlockBadge("first_msg");
    } catch (err) {
      addMessage(mode, { role: "assistant", content: `⚠️ **Erreur** : ${err.message}`, ts: Date.now() });
    } finally { setLoading(false); setTimeout(() => inputRef.current?.focus(), 80); }
  };

  const randomQs = useCallback(() => {
    const cls = currentUser?.classe;
    const pool = cls === "terminale" ? RANDOM_QUESTIONS.terminale : ["6e","5e","4e","3e"].includes(cls) ? RANDOM_QUESTIONS.college : RANDOM_QUESTIONS.lycee;
    const filtered = subject !== "general" ? pool.filter(q => q.sub === subject) : pool;
    const src = filtered.length >= 3 ? filtered : pool;
    return [...src].sort(() => Math.random() - 0.5).slice(0, 3);
  }, [currentUser?.classe, subject]);

  const startExam = (subId) => { const sid = subId || subject; const sub = activeSubjects.find(s => s.id === sid) || ALL_SUBJECTS[sid]; setSubject(sid); setExamState({ subject: sub?.label || "Général", subjectId: sid, timeLeft: 20 * 60, submitted: false }); setPanel("exam"); };
  const startFlashcards = (subId) => { const sid = subId || subject; const cards = FLASHCARDS_DB[sid] || FLASHCARDS_DB.maths; setSubject(sid); setFlashState({ cards, idx: 0, flipped: false }); setPanel("flashcards"); };
  const handleGenPlan = async () => { setGenLoading(true); try { const r = await generateRevisionPlan({ progress, classe: currentUser?.classe || "3e" }); setGenContent({ type: "plan", content: r }); } catch (e) { setGenContent({ type: "error", content: e.message }); } finally { setGenLoading(false); } };
  const handleGenExercises = async () => { setGenLoading(true); try { const r = await generateExercises({ subject: currentSubject?.label || "général", classe: currentUser?.classe || "3e", count: 3 }); setGenContent({ type: "exercises", content: r }); } catch (e) { setGenContent({ type: "error", content: e.message }); } finally { setGenLoading(false); } };

  const overlay = panel ? <PanelOverlay panel={panel} setPanel={setPanel} subject={subject} currentSubject={currentSubject} flashState={flashState} setFlashState={setFlashState} examState={examState} setExamState={setExamState} progress={progress} addNote={addNote} game={game} genContent={genContent} genLoading={genLoading} onGenExercises={handleGenExercises} onGenPlan={handleGenPlan} onAskAI={q => { setPanel(null); setTimeout(() => send(q), 100); }} addXP={addXP} unlockBadge={unlockBadge} incrementQuiz={incrementQuiz} familyProfiles={familyProfiles} activeProfileId={activeProfileId} setActiveProfileId={setActiveProfileId} addFamilyProfile={addFamilyProfile} removeFamilyProfile={removeFamilyProfile} currentUser={currentUser} isPaid={isPaid} setScreen={setScreen} /> : null;

  const copilotProps = { messages, input, setInput, loading, send, mode, setMode, subject, setSubject, currentSubject, imgName, setImgName, imgBase64, setImgBase64, fileRef, inputRef, endRef, handleFile, copy, copied, qLeft, isGuest, isPaid, isProf, guestCount, aiName, setScreen, randomQs, clearMessages };

  const commonViewProps = { view, setView, progress, game, dailyChallenge, openSubject, setPanel, startFlashcards, startExam, send, randomQs, isPaid, isGuest, currentUser, setScreen, activeSubjectId, addXP, addNote, subject, genContent, genLoading, handleGenPlan, handleGenExercises, examDates, saveExamDates, messages, loading, input, setInput, clearMessages, copy, copied, qLeft, aiName, unlockBadge, activeSubjects };

  // ── Shared content renderer ─────────────────────────────────────────────────
  const renderContent = (mobile = false) => (
    <>
      {view === "home" && isParentMode && <ParentDashboard familyProfiles={familyProfiles} allProfiles={allProfiles} allGameData={allGameData} allProgress={allProgress} isMobile={mobile} />}
      {view === "home" && !isParentMode && <HomeContent {...commonViewProps} isMobile={mobile} />}
      {view === "subject"  && activeSubjectId && <SubjectWorkspace subjectId={activeSubjectId} {...commonViewProps} />}
      {view === "copilot"  && <CopilotFullPage {...copilotProps} />}
      {view === "progress" && <ProgressPageView progress={progress} addNote={addNote} game={game} activeSubjects={activeSubjects} onAskAI={q => { setView("copilot"); setMode("cours"); setTimeout(() => send(q), mobile ? 200 : 100); }} />}
      {view === "badges"   && <BadgesPageView game={game} isPaid={isPaid} setScreen={setScreen} />}
      {view === "planner"  && <PlannerPageView {...commonViewProps} />}
      {view === "games"    && <GamesPageView subject={subject} addXP={addXP} isPaid={isPaid} setScreen={setScreen} />}
      {view === "stats"    && <StatsPageView progress={progress} game={game} activeSubjects={activeSubjects} />}
    </>
  );

  // ── Unified layout — CSS media queries handle sidebar/bottom-nav visibility ──
  return (
    <div className="sai-full-height sai-layout" style={{ display: "flex", overflow: "hidden", background: "var(--bg)" }}>
      {overlay}

      {/* Sidebar — hidden on mobile via CSS .sai-sidebar */}
      <div className="sai-sidebar" style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--border)", background: "var(--card)", height: "100%", overflow: "hidden" }}>
        <LeftNav view={view} setView={setView} currentUser={currentUser} game={game} progress={progress} isGuest={isGuest} isPaid={isPaid} dark={dark} setDark={setDark} onLogout={logout} onPricing={() => setScreen("pricing")} onSettings={() => setScreen("settings")} onFlashcards={() => startFlashcards()} onExam={() => startExam()} onGames={() => setPanel("games")} setScreen={setScreen} familyProfiles={familyProfiles} activeProfileId={activeProfileId} setActiveProfileId={setActiveProfileId} onFamilyPanel={() => setPanel("family")} isFamilyMode={isFamilyMode} />
      </div>

      {/* Main content column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Mobile topbar — hidden on desktop via CSS .sai-mobile-topbar */}
        <div className="sai-mobile-topbar" style={{ alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--card)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <Logo size="sm" />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {game.streak > 0 && <span style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 20, padding: "4px 9px", fontSize: 12, fontWeight: 700, color: "var(--warn)" }}>🔥 {game.streak}</span>}
            <span style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-glow)", borderRadius: 20, padding: "4px 9px", fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>⭐ {game.xp}</span>
            <button onClick={() => setDark(!dark)} style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 9px", fontSize: 14 }}>{dark ? "☀️" : "🌙"}</button>
            {/* Family mode: profile switch chip */}
            {isFamilyMode && currentUser && (
              <button onClick={() => setScreen("profileselect")}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--accent-soft)", border: "1px solid var(--accent-glow)", borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: "var(--accent)", cursor: "pointer" }}>
                <span style={{ fontSize: 14 }}>{activeProfile?.avatar || currentUser.name?.[0]?.toUpperCase()}</span>
                <span>{(activeProfile?.name || currentUser.name)?.split(" ")[0]}</span>
                <span style={{ fontSize: 10 }}>⬇</span>
              </button>
            )}
            {/* Regular mode: user avatar */}
            {!isFamilyMode && currentUser && (
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),var(--accent2))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>{currentUser.name?.[0]?.toUpperCase()}</div>
            )}
          </div>
        </div>

        {/* Scrollable content — overflow: hidden when copilot view is active so only
            the internal message list scrolls, keeping the input pinned to the bottom */}
        <div className="sai-scroll sai-main" style={{ flex: 1, overflow: view === "copilot" ? "hidden" : "auto", display: "flex", flexDirection: "column", minWidth: 0 }}>
          {isMobile ? renderContent(true) : renderContent(false)}
        </div>

        {/* Mobile bottom nav — hidden on desktop via CSS .sai-bottom-nav */}
        <div className="sai-bottom-nav" style={{ background: "var(--card)", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <MobileNav view={view} setView={setView} />
        </div>
      </div>
    </div>
  );
}

// ─── LEFT NAV (desktop) ───────────────────────────────────────────────────────
function LeftNav({ view, setView, currentUser, game, progress, isGuest, isPaid, dark, setDark, onLogout, onPricing, onSettings, onFlashcards, onExam, onGames, setScreen, familyProfiles, activeProfileId, setActiveProfileId, onFamilyPanel, isFamilyMode }) {
  const info = lvlInfo(game.xp);
  const lvl  = info.level;
  const cur  = LEVEL_THRESHOLDS[lvl - 1] ?? 0;
  const nxt  = LEVEL_THRESHOLDS[lvl] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];

  const navItems = [
    { id: "home",     icon: "🏠", label: "Accueil"        },
    { id: "subject",  icon: "📚", label: "Matières"       },
    { id: "copilot",  icon: "✦",  label: "Assistant IA"   },
    { id: "planner",  icon: "📅", label: "Révisions"      },
    { id: "games",    icon: "🎮", label: "Exercices"      },
    { id: "exam",     icon: "🧪", label: "Examens"        },
    { id: "flash",    icon: "🃏", label: "Flashcards"     },
    { id: "progress", icon: "📊", label: "Progrès"        },
    { id: "badges",   icon: "🏆", label: "Badges"         },
    { id: "stats",    icon: "📈", label: "Statistiques"   },
  ];

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Logo */}
      <div style={{ padding: "20px 18px 14px", borderBottom: "1px solid var(--border)" }}>
        <Logo />
      </div>

      {/* User profile */}
      {currentUser && (
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),var(--accent2))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{currentUser.name?.[0]?.toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Niv.{lvl} · {game.xp} XP</div>
            </div>
          </div>
          <div style={{ height: 4, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${info.pct}%`, background: "linear-gradient(90deg,var(--accent),var(--accent2))", transition: "width 0.7s" }} />
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>{info.xpNext} XP avant le niveau {lvl + 1}</div>
        </div>
      )}

      {/* Family profile switcher */}
      {currentUser && isFamilyMode && (
        <div style={{ padding: "8px 12px 8px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 7 }}>Profil actif</div>
          <button onClick={() => setScreen("profileselect")}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "var(--accent-soft)", border: "1px solid var(--accent-glow)", borderRadius: 12, padding: "8px 10px", cursor: "pointer", transition: "all 0.15s" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: activeProfileId ? "var(--card)" : "linear-gradient(135deg,var(--accent),var(--accent2))", border: activeProfileId ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: activeProfileId ? 16 : 13, color: activeProfileId ? undefined : "#fff", fontWeight: 800, flexShrink: 0 }}>
              {activeProfileId
                ? (familyProfiles.find(p => p.id === activeProfileId)?.avatar || "👤")
                : (currentUser.name?.[0]?.toUpperCase() || "P")}
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeProfileId
                  ? familyProfiles.find(p => p.id === activeProfileId)?.name?.split(" ")[0]
                  : (currentUser.name?.split(" ")[0] || "Parent")}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {activeProfileId ? "Élève" : "Mode parent"}
              </div>
            </div>
            <span style={{ fontSize: 12, color: "var(--accent)" }}>⬇</span>
          </button>
        </div>
      )}
      {/* Legacy family switcher for non-family-plan users who added profiles */}
      {currentUser && !isFamilyMode && familyProfiles && familyProfiles.length > 0 && (
        <div style={{ padding: "8px 12px 6px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Profils famille</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
            <button onClick={() => setActiveProfileId(null)}
              style={{ padding: "3px 9px", borderRadius: 20, border: `1.5px solid ${!activeProfileId ? "var(--accent)" : "var(--border)"}`, background: !activeProfileId ? "var(--accent-soft)" : "transparent", color: !activeProfileId ? "var(--accent)" : "var(--text-muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {currentUser.name?.split(" ")[0] || "Moi"}
            </button>
            {familyProfiles.map(p => (
              <button key={p.id} onClick={() => setActiveProfileId(p.id)}
                style={{ padding: "3px 9px", borderRadius: 20, border: `1.5px solid ${activeProfileId === p.id ? "var(--accent)" : "var(--border)"}`, background: activeProfileId === p.id ? "var(--accent-soft)" : "transparent", color: activeProfileId === p.id ? "var(--accent)" : "var(--text-muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {p.avatar || "👤"} {p.name?.split(" ")[0]}
              </button>
            ))}
          </div>
          <button onClick={onFamilyPanel} style={{ fontSize: 11, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", padding: "2px 0" }}>+ Gérer les profils</button>
        </div>
      )}

      {/* Nav items */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 10px" }}>
        {navItems.map(item => (
          <NavItem key={item.id} icon={item.icon} label={item.label}
            active={item.id === view || (item.id === "subject" && view === "subject")}
            onClick={() => {
              if      (item.id === "flash")   onFlashcards?.();
              else if (item.id === "exam")    onExam?.();
              else if (item.id === "subject") setView("home");
              else    setView(item.id);
            }}
          />
        ))}
      </div>

      {/* Premium card */}
      {!isPaid && !isGuest && (
        <div style={{ margin: "0 10px 10px", background: "linear-gradient(135deg,var(--accent),var(--accent2))", borderRadius: 14, padding: "14px", color: "#fff" }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>✦ Passer Premium</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 10, lineHeight: 1.4 }}>Questions illimitées · Plan IA · Mode examen</div>
          <button onClick={onPricing} style={{ width: "100%", background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 9, padding: "7px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Découvrir →</button>
        </div>
      )}

      {/* Bottom actions */}
      <div style={{ padding: "8px 10px 14px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
        <button onClick={() => setDark(!dark)} style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-soft)", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>{dark ? "☀️ Mode clair" : "🌙 Mode sombre"}</button>
        {currentUser && <button onClick={onSettings} style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-soft)", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>⚙️ Paramètres</button>}
        {currentUser && <button onClick={onLogout} style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.2)", background: "transparent", color: "var(--danger)", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>🚪 Déconnexion</button>}
        {isGuest && <Btn primary full onClick={() => { /* setScreen handled in parent */ }} style={{ fontSize: 12 }}>Créer un compte</Btn>}
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: "none", background: active ? "var(--accent-soft)" : "transparent", color: active ? "var(--accent)" : "var(--text-soft)", fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer", textAlign: "left", transition: "all 0.15s", marginBottom: 2 }}
      onMouseOver={e => { if (!active) { e.currentTarget.style.background = "var(--card2)"; e.currentTarget.style.color = "var(--text)"; } }}
      onMouseOut={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-soft)"; } }}>
      <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && <span style={{ background: "var(--accent)", color: "#fff", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{badge}</span>}
    </button>
  );
}

// ─── MOBILE TOP BAR ───────────────────────────────────────────────────────────
function MobileTopbar({ game, dark, setDark, currentUser, view }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--card)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
      <Logo size="sm" />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {game.streak > 0 && <span style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 20, padding: "4px 9px", fontSize: 12, fontWeight: 700, color: "var(--warn)" }}>🔥 {game.streak}</span>}
        <span style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-glow)", borderRadius: 20, padding: "4px 9px", fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>⭐ {game.xp}</span>
        <button onClick={() => setDark(!dark)} style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 9px", fontSize: 14 }}>{dark ? "☀️" : "🌙"}</button>
        {currentUser && <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),var(--accent2))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>{currentUser.name?.[0]?.toUpperCase()}</div>}
      </div>
    </div>
  );
}

// ─── MOBILE BOTTOM NAV ────────────────────────────────────────────────────────
function MobileNav({ view, setView }) {
  const tabs = [
    { id: "home",     icon: "🏠", label: "Accueil"  },
    { id: "subject",  icon: "📚", label: "Matières" },
    { id: "copilot",  icon: "✦",  label: "IA"       },
    { id: "planner",  icon: "📅", label: "Révisions"},
    { id: "progress", icon: "📊", label: "Progrès"  },
  ];
  return (
    <>
      {tabs.map((t, i) => {
        const active = t.id === view || (t.id === "subject" && (view === "subject" || view === "home"));
        return (
          <button key={i} onClick={() => t.id === "subject" ? setView("home") : setView(t.id)}
            style={{ flex: 1, minHeight: 56, padding: "8px 4px 6px", border: "none", background: "transparent", color: active ? "var(--accent)" : "var(--text-muted)", fontSize: 10, fontWeight: active ? 700 : 500, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, WebkitTapHighlightColor: "transparent" }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 10 }}>{t.label}</span>
          </button>
        );
      })}
    </>
  );
}

// ─── HOME CONTENT (shared desktop/mobile) ─────────────────────────────────────
// ─── HOME INLINE WIDGETS ─────────────────────────────────────────────────────
function HomeHeatmap() {
  const log = getActivityLog();
  const today = new Date();
  const days = [];
  const start = new Date(today);
  start.setDate(start.getDate() - 83);
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const k = d.toISOString().split("T")[0];
    days.push({ k, c: log[k] || 0 });
  }
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const clr = c => c === 0 ? "var(--border)" : c === 1 ? "rgba(99,102,241,0.35)" : c === 2 ? "rgba(99,102,241,0.65)" : "var(--accent)";
  const totalDays = Object.keys(log).length;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Régularité · {totalDays} jours actifs</div>
      <div style={{ display: "flex", gap: 3, flexWrap: "nowrap", overflowX: "auto" }}>
        {weeks.map((wk, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
            {wk.map((d, di) => <div key={di} title={`${d.k}: ${d.c} session${d.c !== 1 ? "s" : ""}`} style={{ width: 10, height: 10, borderRadius: 3, background: clr(d.c) }} />)}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>← 12 semaines</div>
    </div>
  );
}

function HomePlannerSnippet({ examDates, saveExamDates, setView }) {
  const [adding, setAdding] = useState(false);
  const [nLabel, setNLabel] = useState("");
  const [nDate,  setNDate]  = useState("");
  const upcoming = (examDates || []).filter(e => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 3);
  const addExam = () => {
    if (nLabel && nDate) { saveExamDates([...(examDates || []), { label: nLabel, date: nDate }]); setNLabel(""); setNDate(""); setAdding(false); }
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Examens à venir</div>
        <button onClick={() => setAdding(a => !a)} style={{ background: "var(--accent-soft)", border: "none", borderRadius: 8, padding: "3px 9px", fontSize: 11, fontWeight: 700, color: "var(--accent)", cursor: "pointer" }}>+ Ajouter</button>
      </div>
      {adding && (
        <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
          <input placeholder="Matière" value={nLabel} onChange={e => setNLabel(e.target.value)} style={{ flex: 1, minWidth: 70, background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", fontSize: 11, color: "var(--text)" }} />
          <input type="date" value={nDate} onChange={e => setNDate(e.target.value)} style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", fontSize: 11, color: "var(--text)" }} />
          <button onClick={addExam} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✓</button>
        </div>
      )}
      {upcoming.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "10px 0" }}>Aucun examen planifié · <button onClick={() => setAdding(true)} style={{ background: "transparent", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Ajouter →</button></div>
      ) : upcoming.map((e, i) => {
        const days = Math.ceil((new Date(e.date) - new Date()) / 86400000);
        const urgent = days <= 7;
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < upcoming.length - 1 ? "1px solid var(--border)" : "none" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-soft)" }}>{e.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: urgent ? "var(--danger)" : "var(--text-muted)", background: urgent ? "rgba(220,38,38,0.08)" : "var(--card2)", borderRadius: 8, padding: "2px 8px" }}>J-{days}</span>
          </div>
        );
      })}
    </div>
  );
}

function FirstNoteInput({ subject, addNote }) {
  const [val, setVal] = useState("");
  const [saved, setSaved] = useState(false);
  const save = () => {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0 || n > 20) return;
    addNote(subject.id, n);
    setSaved(true);
  };
  if (saved) return (
    <div style={{ background: "var(--card)", border: `1px solid ${subject.color}30`, borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 18 }}>{subject.icon}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginTop: 3 }}>✅ Enregistrée</div>
    </div>
  );
  return (
    <div style={{ background: "var(--card)", border: `1px solid ${subject.color}20`, borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{subject.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{subject.label}</span>
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        <input type="number" min="0" max="20" step="0.5" value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && save()}
          placeholder="/20"
          style={{ flex: 1, background: "var(--card2)", border: `1.5px solid ${subject.color}30`, borderRadius: 8, padding: "5px 8px", fontSize: 12, color: "var(--text)", width: 0 }} />
        <button onClick={save} disabled={!val}
          style={{ background: subject.color, color: "#fff", border: "none", borderRadius: 8, padding: "5px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: val ? 1 : 0.4 }}>✓</button>
      </div>
    </div>
  );
}

function HomeContent({ game, progress, dailyChallenge, openSubject, setPanel, startFlashcards, startExam, send, randomQs, isPaid, isGuest, currentUser, setScreen, isMobile, setView, addNote, examDates, saveExamDates, activeSubjects: propSubjects }) {
  const { activeSubjects: ctxSubjects, effectiveProfile } = useApp();
  const grades = effectiveProfile?.grades || {};
  const info = lvlInfo(game.xp);
  const allSessions = Object.values(progress).reduce((s, p) => s + (p.sessions || 0), 0);
  const unlockedBadges = (game.badges || []).length;
  const isProf = currentUser?.role === "prof";
  const firstName = currentUser?.name?.split(" ")[0] || "là";

  // Subjects from profile (no general, no sport)
  const resolvedSubjects = propSubjects || ctxSubjects;
  const subjects = resolvedSubjects.filter(s => s.id !== "general" && !s.noAI).slice(0, 6);

  // Stats from profile.grades (single source of truth)
  const gradedSubjects = subjects.filter(s => grades[s.id] !== undefined);
  const avgScore = gradedSubjects.length
    ? (gradedSubjects.reduce((sum, s) => sum + grades[s.id], 0) / gradedSubjects.length).toFixed(1)
    : null;
  const hasAnyNotes = gradedSubjects.length > 0;

  const weakSubject = subjects.find(s => grades[s.id] !== undefined && grades[s.id] < 10);
  const lastActive = subjects.filter(s => (progress[s.id]?.sessions || 0) > 0).sort((a, b) => (progress[b.id]?.sessions || 0) - (progress[a.id]?.sessions || 0))[0];

  return (
    <div style={{ padding: isMobile ? "16px 14px 20px" : "28px 32px", maxWidth: 900, margin: "0 auto", width: "100%" }} className="fade-in">

      {/* Hero card */}
      <div style={{ background: "linear-gradient(135deg,var(--accent),var(--accent2))", borderRadius: 24, padding: isMobile ? "22px 20px" : "28px 32px", color: "#fff", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, background: "rgba(255,255,255,0.07)", borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, background: "rgba(255,255,255,0.05)", borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, fontFamily: "Space Grotesk,sans-serif", letterSpacing: "-0.5px", marginBottom: 6 }}>
            {isGuest ? "Essaie Study AI !" : `Bonjour ${firstName} 👋`}
          </div>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 16, lineHeight: 1.5 }}>
            {isGuest ? "5 messages gratuits pour découvrir l'assistant scolaire IA."
              : isProf ? "Aide-toi pour créer cours, exercices et évaluations."
              : game.lastActive === new Date().toDateString()
              ? `✅ Actif aujourd'hui · Streak ${game.streak} jours 🔥`
              : "Objectif : Pose 1 question pour entretenir ton streak 🎯"}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {lastActive && (
              <button onClick={() => openSubject(lastActive.id)}
                style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 12, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                ▶ Continuer {lastActive.label}
              </button>
            )}
            <button onClick={() => send(dailyChallenge.q)}
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 12, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              🎯 Défi du jour +{dailyChallenge.xp}XP
            </button>
          </div>
        </div>
      </div>

      {/* First-visit notes personalization card */}
      {!isGuest && !isProf && !hasAnyNotes && (
        <div style={{ marginBottom: 20, background: "linear-gradient(135deg,var(--accent-soft),rgba(124,58,237,0.04))", border: "1.5px solid var(--accent-glow)", borderRadius: 20, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: "var(--accent-soft)", border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📊</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>Personnalise ton IA</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Ajoute tes notes pour que l'IA s'adapte à ton niveau réel</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 8 }}>
            {subjects.map(s => <FirstNoteInput key={s.id} subject={s} addNote={addNote} />)}
          </div>
        </div>
      )}

      {/* Metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { icon: "⭐", val: game.xp, sub: `XP · Niv.${info.level}`, color: "#f59e0b", pct: info.pct },
          { icon: "🏆", val: `${unlockedBadges}/${BADGES_DATA.length}`, sub: "Badges débloqués", color: "#6366f1" },
          { icon: "📈", val: avgScore ? `${avgScore}/20` : allSessions > 0 ? `${allSessions} sessions` : "—", sub: avgScore ? "Moyenne globale" : "Sessions totales", color: "#10b981" },
        ].map((m, i) => (
          <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: isMobile ? "14px 12px" : "18px 16px", textAlign: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -16, right: -16, width: 60, height: 60, background: m.color + "14", borderRadius: "50%" }} />
            <div style={{ fontSize: isMobile ? 20 : 24, marginBottom: 4 }}>{m.icon}</div>
            <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: isMobile ? 18 : 22, color: "var(--text)" }}>{m.val}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{m.sub}</div>
            {i === 0 && <div style={{ marginTop: 8, height: 3, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${m.pct}%`, background: `linear-gradient(90deg,${m.color},#f97316)`, transition: "width 0.7s" }} /></div>}
          </div>
        ))}
      </div>

      {/* Premium intelligence card */}
      {isPaid && !isGuest && !isProf && (
        <PremiumIntelligenceCard grades={grades} subjects={subjects} setPanel={setPanel} setView={setView} isMobile={isMobile} />
      )}

      {/* Subjects grid */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Mes matières</div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Clique pour réviser</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 12 }}>
          {subjects.map(s => {
            const grade = grades[s.id];
            const sessions = progress[s.id]?.sessions || 0;
            const mastery = grade !== undefined ? Math.min(100, Math.round((grade / 20) * 100)) : sessions ? Math.min(80, sessions * 8) : 0;
            const masteryColor = mastery >= 70 ? "var(--success)" : mastery >= 40 ? "var(--warn)" : "var(--text-muted)";
            return (
              <button key={s.id} onClick={() => openSubject(s.id)}
                style={{ background: "var(--card)", border: `1px solid var(--border)`, borderRadius: 18, padding: "16px 14px", textAlign: "left", cursor: "pointer", transition: "all 0.18s", position: "relative", overflow: "hidden" }}
                onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${s.color}25`; e.currentTarget.style.borderColor = s.color + "50"; }}
                onMouseOut={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; e.currentTarget.style.borderColor = "var(--border)"; }}>
                <div style={{ position: "absolute", top: -10, right: -10, width: 50, height: 50, background: s.color + "14", borderRadius: "50%" }} />
                <div style={{ fontSize: 26, marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>{s.label}</div>
                {grade !== undefined ? (
                  <div style={{ fontSize: 12, fontWeight: 700, color: masteryColor, marginBottom: 6 }}>
                    {grade}/20{sessions > 0 ? ` · ${sessions} session${sessions > 1 ? "s" : ""}` : ""}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                    {sessions > 0 ? `${sessions} session${sessions > 1 ? "s" : ""}` : "Pas encore commencé"}
                  </div>
                )}
                <div style={{ height: 3, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${mastery}%`, background: `linear-gradient(90deg,${s.color},${s.color}88)`, transition: "width 0.7s" }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Weak subject suggestion */}
      {weakSubject && (
        <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 16, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 24 }}>🎯</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Point à renforcer : {weakSubject.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Moyenne {grades[weakSubject.id]}/20 · Révise maintenant pour progresser</div>
          </div>
          <button onClick={() => openSubject(weakSubject.id)}
            style={{ background: "var(--danger)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Réviser →</button>
        </div>
      )}

      {/* Daily mini game */}
      <div style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.08),rgba(217,119,6,0.04))", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 18, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#f59e0b,#f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🎮</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", marginBottom: 2 }}>Petit Jeu du Jour</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Quiz éclair sur tes flashcards · +XP garanti</div>
        </div>
        <button onClick={() => setPanel("games")}
          style={{ background: "linear-gradient(135deg,#f59e0b,#f97316)", color: "#fff", border: "none", borderRadius: 12, padding: "9px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>Jouer →</button>
      </div>

      {/* Weekly missions */}
      {!isGuest && <WeeklyMissions game={game} isPaid={isPaid} setScreen={setScreen} setPanel={setPanel} style={{ marginTop: 14 }} />}

      {/* Heatmap + Planner row (desktop: 2-col, mobile: stacked) */}
      {!isGuest && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginTop: 14 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: "16px 18px" }}>
            <HomeHeatmap />
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: "16px 18px" }}>
            <HomePlannerSnippet examDates={examDates} saveExamDates={saveExamDates} setView={setView} />
          </div>
        </div>
      )}

      {/* Guest CTA */}
      {isGuest && (
        <div style={{ marginTop: 20, background: "var(--accent-soft)", border: "1px solid var(--accent-glow)", borderRadius: 18, padding: "20px", textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)", marginBottom: 6 }}>Crée ton compte gratuitement</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>Sauvegarde ta progression · XP · Badges · Plan IA</div>
          <Btn primary onClick={() => setScreen("auth")}>Créer un compte gratuit →</Btn>
        </div>
      )}
    </div>
  );
}

// ─── WEEKLY MISSIONS ─────────────────────────────────────────────────────────
function WeeklyMissions({ game, isPaid, setScreen, setPanel, style }) {
  // Derive progress from existing game state — no new storage needed
  const quizProgress   = Math.min(5, (game.quizCount || 0) % 5 || ((game.quizCount || 0) >= 5 ? 5 : game.quizCount || 0));
  const streakProgress = Math.min(3, game.streak || 0);
  const bossWon        = (game.badges || []).includes("boss_win");
  const speedDone      = (game.badges || []).includes("speed_5");

  const FREE_MISSION = { icon: "🎯", label: "Faire 1 quiz", desc: "Complète un quiz cette semaine", done: (game.quizCount || 0) >= 1, xp: 50 };
  const PREMIUM_MISSIONS = [
    { icon: "📚", label: "5 quiz complétés", desc: "Fais 5 quiz pour débloquer le bonus", pct: (quizProgress / 5) * 100, done: quizProgress >= 5, xp: 150, color: "#6366f1" },
    { icon: "🔥", label: "Streak 3 jours",   desc: "Reste actif 3 jours de suite",        pct: (streakProgress / 3) * 100, done: streakProgress >= 3, xp: 100, color: "#f59e0b" },
    { icon: "🐉", label: "Battre le Boss",    desc: "Gagne un Boss Battle cette semaine",  pct: bossWon ? 100 : 0, done: bossWon, xp: 200, color: "#ef4444" },
    { icon: "⚡", label: "5 Speed Quiz",      desc: "Complète 5 Speed Quiz en chrono",     pct: speedDone ? 100 : 0, done: speedDone, xp: 120, color: "#10b981" },
  ];

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: "16px 20px", ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 800, fontSize: 15, color: "var(--text)" }}>
          🗓️ Missions de la semaine
        </div>
        {!isPaid && (
          <button onClick={() => setScreen("pricing")}
            style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-glow)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
            Premium ✦
          </button>
        )}
      </div>

      {/* Free mission (always visible) */}
      <div style={{ background: FREE_MISSION.done ? "rgba(16,185,129,0.08)" : "var(--card2)", border: `1px solid ${FREE_MISSION.done ? "rgba(16,185,129,0.3)" : "var(--border)"}`, borderRadius: 12, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 20 }}>{FREE_MISSION.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{FREE_MISSION.label}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{FREE_MISSION.desc}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981" }}>+{FREE_MISSION.xp} XP</span>
          {FREE_MISSION.done
            ? <span style={{ fontSize: 16 }}>✅</span>
            : <button onClick={() => setPanel("games")} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Jouer</button>
          }
        </div>
      </div>

      {/* Premium missions */}
      {isPaid ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PREMIUM_MISSIONS.map((m, i) => (
            <div key={i} style={{ background: m.done ? "rgba(16,185,129,0.06)" : "var(--card2)", border: `1px solid ${m.done ? "rgba(16,185,129,0.2)" : "var(--border)"}`, borderRadius: 12, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: m.done ? 0 : 6 }}>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text)" }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.desc}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: m.color }}>+{m.xp} XP</span>
                {m.done && <span style={{ fontSize: 14 }}>✅</span>}
              </div>
              {!m.done && (
                <div style={{ height: 3, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${m.pct}%`, background: `linear-gradient(90deg,${m.color},${m.color}88)`, transition: "width 0.6s", borderRadius: 3 }} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.03))", border: "1px dashed var(--accent-glow)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 3 }}>4 missions Premium débloquées</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>Jusqu'à +570 XP bonus par semaine avec Premium</div>
          <button onClick={() => setScreen("pricing")}
            style={{ background: "linear-gradient(135deg,var(--accent),var(--accent2))", color: "#fff", border: "none", borderRadius: 10, padding: "8px 20px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            Débloquer les missions →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── PREMIUM INTELLIGENCE CARD ───────────────────────────────────────────────
function PremiumIntelligenceCard({ grades, subjects, setPanel, setView, isMobile }) {
  const sorted = subjects
    .filter(s => grades[s.id] !== undefined)
    .sort((a, b) => grades[a.id] - grades[b.id]);
  const weakest = sorted.slice(0, 2);
  const strongCount = sorted.filter(s => grades[s.id] >= 14).length;
  const todayPlan = weakest.length >= 2
    ? `Révise ${weakest[0].label} + ${weakest[1].label} aujourd'hui`
    : weakest.length === 1
    ? `Focus sur ${weakest[0].label} aujourd'hui`
    : "Continue ton apprentissage régulièrement";

  return (
    <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.10),rgba(139,92,246,0.06))", border: "1px solid var(--accent-glow)", borderRadius: 20, padding: isMobile ? "16px 14px" : "18px 22px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, background: "rgba(99,102,241,0.06)", borderRadius: "50%", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>✦</span>
          <span style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 800, fontSize: 14, color: "var(--accent)" }}>Intelligence IA</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, background: "var(--accent)", color: "#fff", borderRadius: 20, padding: "2px 8px" }}>PREMIUM</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
        {/* Daily plan */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "12px 14px", border: "1px solid rgba(99,102,241,0.15)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6 }}>Plan du jour</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.4 }}>📅 {todayPlan}</div>
          {weakest[0] && (
            <button onClick={() => setView("subject")} style={{ marginTop: 8, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
              Commencer →
            </button>
          )}
        </div>

        {/* Analytics */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "12px 14px", border: "1px solid rgba(99,102,241,0.15)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6 }}>Analyse</div>
          {strongCount > 0 && (
            <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 4 }}>
              ✅ <strong>{strongCount}</strong> matière{strongCount > 1 ? "s" : ""} maîtrisée{strongCount > 1 ? "s" : ""} (≥14/20)
            </div>
          )}
          {weakest[0] && (
            <div style={{ fontSize: 13, color: "var(--danger)", marginBottom: 6 }}>
              ⚠️ Priorité : <strong>{weakest[0].label}</strong> ({grades[weakest[0].id]}/20)
            </div>
          )}
          <button onClick={() => setPanel("exam")} style={{ background: "transparent", border: "1px solid var(--accent-glow)", color: "var(--accent)", borderRadius: 8, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            📝 Faire un examen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SUBJECT WORKSPACE ────────────────────────────────────────────────────────
function SubjectWorkspace({ subjectId, progress, game, startFlashcards, startExam, send, setPanel, addXP, setView, currentUser, messages, loading, input, setInput, clearMessages, copy, copied, qLeft, aiName, isPaid, isGuest, unlockBadge, setScreen }) {
  const { effectiveProfile } = useApp();
  const subEndRef = useRef(null);
  const [showBrevetExam, setShowBrevetExam] = useState(false);
  useEffect(() => { subEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  const s = ALL_SUBJECTS[subjectId];
  if (!s) return null;
  const grade = effectiveProfile?.grades?.[subjectId];
  const sessions = progress[subjectId]?.sessions || 0;
  // Mastery from profile grade first, then session count fallback
  const mastery = grade !== undefined ? Math.min(100, Math.round((grade / 20) * 100)) : sessions ? Math.min(80, sessions * 8) : 0;
  const masteryLabel = mastery >= 70 ? "Maîtrisé" : mastery >= 40 ? "En progression" : mastery > 0 ? "Débutant" : "Non commencé";
  const masteryColor = mastery >= 70 ? "var(--success)" : mastery >= 40 ? "var(--warn)" : "var(--text-muted)";
  const hasCards = (FLASHCARDS_DB[subjectId]?.length || 0) > 0;

  const hasBrevetQs = !!(BREVET_QUESTIONS[subjectId]);
  const cls = currentUser?.classe;
  const isBac = cls === "terminale" || cls === "superieur";

  const tools = [
    { icon: "🃏", label: "Flashcards", desc: hasCards ? `${FLASHCARDS_DB[subjectId].length} cartes` : "Mémorisation", fn: () => startFlashcards(subjectId) },
    { icon: "🎯", label: "Quiz IA", desc: "5 questions", fn: () => send(`Génère un quiz de 5 questions sur ${s.label}`) },
    { icon: hasBrevetQs ? "📝" : "🧪", label: hasBrevetQs ? (isBac ? "Mode BAC" : "Mode Brevet") : "Mode Examen", desc: hasBrevetQs ? "Questions officielles" : "20 min chrono", fn: () => hasBrevetQs ? setShowBrevetExam(true) : startExam(subjectId) },
    { icon: "✏️", label: "Exercices IA", desc: "Générés pour toi", fn: () => { setPanel("plan"); } },
  ];

  const suggestions = [
    grade !== undefined && grade < 10 ? `Tes résultats en ${s.label} peuvent progresser. Commence par les flashcards.` : null,
    sessions === 0 ? `Commence ta première session de ${s.label} en posant une question !` : null,
    sessions >= 3 ? `Super régularité en ${s.label} ! Teste-toi avec le mode examen.` : null,
  ].filter(Boolean)[0];

  if (showBrevetExam) return (
    <div style={{ padding: "28px 32px", maxWidth: 800, margin: "0 auto" }} className="fade-in">
      <button onClick={() => setShowBrevetExam(false)}
        style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, marginBottom: 20, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
        ← Retour à {s.label}
      </button>
      <div style={{ background: "var(--card)", border: `1px solid ${s.color}25`, borderRadius: 20, padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>📝</div>
          <div>
            <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 18, color: "var(--text)" }}>{currentUser?.classe === "terminale" ? "Mode BAC" : "Mode Brevet"} — {s.label}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>Questions officielles · 25 minutes · Corrections automatiques</div>
          </div>
        </div>
        <StructuredExamPanel subjectId={subjectId} subjectLabel={s.label} onClose={() => setShowBrevetExam(false)} addXP={addXP} unlockBadge={unlockBadge} isPaid={isPaid} setScreen={setScreen} />
      </div>
    </div>
  );

  return (
    <div style={{ padding: "28px 32px", maxWidth: 800, margin: "0 auto" }} className="fade-in">
      {/* Back */}
      <button onClick={() => setView("home")}
        style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, marginBottom: 20, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
        ← Retour au tableau de bord
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24, background: "var(--card)", border: `2px solid ${s.color}30`, borderRadius: 22, padding: "22px 24px" }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0, border: `2px solid ${s.color}25` }}>{s.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 22, color: "var(--text)", marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 13, color: masteryColor, fontWeight: 700, marginBottom: 8 }}>{masteryLabel} · {mastery}%{grade !== undefined ? ` · Moyenne ${grade}/20` : ""}{sessions > 0 ? ` · ${sessions} session${sessions > 1 ? "s" : ""}` : ""}</div>
          <div style={{ height: 6, background: "var(--border)", borderRadius: 6, overflow: "hidden", maxWidth: 300 }}>
            <div style={{ height: "100%", width: `${mastery}%`, background: `linear-gradient(90deg,${s.color},${s.color}88)`, transition: "width 0.7s" }} />
          </div>
        </div>
      </div>

      {/* Smart recommendation */}
      <div style={{ background: "linear-gradient(135deg,var(--accent-soft),rgba(124,58,237,0.05))", border: "1px solid var(--accent-glow)", borderRadius: 18, padding: "18px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🤖</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 2 }}>Prochaine action recommandée</div>
          <div style={{ fontSize: 13, color: "var(--text-soft)" }}>
            {suggestions || (grade !== undefined && grade >= 14 ? `Excellent niveau en ${s.label} ! Maintiens ta forme avec un quiz.` : `Demande à l'IA une explication sur ${s.label} pour approfondir.`)}
          </div>
        </div>
        <button onClick={() => send(`Aide-moi à progresser en ${s.label}. ${grade !== undefined ? `Ma moyenne actuelle est ${grade}/20.` : "Je débute."}`)}
          style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Demander →</button>
      </div>

      {/* Practice tools */}
      <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 800, fontSize: 16, color: "var(--text)", marginBottom: 14 }}>Outils de pratique</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 24 }}>
        {tools.map((t, i) => (
          <button key={i} onClick={t.fn}
            style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: "20px", textAlign: "left", cursor: "pointer", transition: "all 0.18s" }}
            onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${s.color}20`; e.currentTarget.style.borderColor = s.color + "40"; }}
            onMouseOut={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; e.currentTarget.style.borderColor = "var(--border)"; }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 3 }}>{t.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.desc}</div>
          </button>
        ))}
      </div>

      {/* Embedded AI Chat */}
      <div style={{ background: "var(--card)", border: `1.5px solid ${s.color}25`, borderRadius: 20, overflow: "hidden" }}>
        {/* Chat header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: "40%", background: `linear-gradient(135deg,${s.color},${s.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>✦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Tuteur IA — {s.label}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{aiName || "Study AI"} · adapté à ton niveau</div>
          </div>
          {messages.length > 0 && (
            <button onClick={() => clearMessages("cours")} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", padding: "4px 8px" }}>🗑️</button>
          )}
        </div>

        {/* Quick prompts (shown when chat is empty) */}
        {messages.length === 0 && (
          <div style={{ padding: "14px 16px 8px" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Suggestions :</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[`Explique-moi les notions clés en ${s.label}`, `Génère un quiz sur ${s.label}`, `Fiche de révision rapide en ${s.label}`, `Quelles sont les erreurs classiques en ${s.label} ?`].map((q, i) => (
                <button key={i} onClick={() => send(q)}
                  style={{ background: "var(--card2)", border: `1px solid ${s.color}25`, borderRadius: 12, padding: "9px 13px", fontSize: 12, color: "var(--text-soft)", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s" }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = s.color + "60"; e.currentTarget.style.color = "var(--text)"; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = s.color + "25"; e.currentTarget.style.color = "var(--text-soft)"; }}>
                  <span style={{ color: s.color, fontSize: 14 }}>▸</span>{q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div style={{ maxHeight: 340, overflow: "auto", padding: "12px 16px 4px" }}>
            {messages.slice(-10).map((msg, i) => (
              <div key={i} className="msg-in" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 10, gap: 6, alignItems: "flex-start" }}>
                {msg.role === "assistant" && (
                  <div style={{ width: 24, height: 24, borderRadius: "40%", background: `linear-gradient(135deg,${s.color},${s.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, marginTop: 2 }}>✦</div>
                )}
                <div style={{ maxWidth: "86%" }}>
                  <div style={{ borderRadius: 14, padding: "9px 13px", fontSize: 13, lineHeight: 1.55, ...(msg.role === "user" ? { background: `linear-gradient(135deg,${s.color},${s.color}88)`, color: "#fff", borderBottomRightRadius: 4 } : { background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)", borderBottomLeftRadius: 4 }) }}>
                    {msg.role === "user" ? msg.content : <div style={{ lineHeight: 1.65 }}>{fmtAI(msg.content)}</div>}
                  </div>
                  {msg.role === "assistant" && (
                    <button onClick={() => copy(msg.content, `sub_${i}`)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 10, cursor: "pointer", marginTop: 3, paddingLeft: 2 }}>
                      {copied === `sub_${i}` ? "✅ Copié" : "📋 Copier"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="msg-in" style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: "40%", background: `linear-gradient(135deg,${s.color},${s.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✦</div>
                <div style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 14, padding: "9px 13px" }}>
                  <div style={{ display: "flex", gap: 3 }}>{[0, 0.2, 0.4].map((d, i2) => <div key={i2} style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, animation: "bounce 1.4s infinite", animationDelay: `${d}s` }} />)}</div>
                </div>
              </div>
            )}
            <div ref={subEndRef} style={{ height: 4 }} />
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "10px 12px 12px", borderTop: messages.length > 0 ? "1px solid var(--border)" : "none" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", background: "var(--card2)", border: `1.5px solid var(--border)`, borderRadius: 14, padding: "4px 5px 4px 12px" }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Pose ta question en ${s.label}...`}
              rows={2} disabled={(!isPaid && !isGuest && qLeft <= 0) || loading}
              style={{ flex: 1, background: "transparent", border: "none", color: "var(--text)", fontSize: 13, resize: "none", lineHeight: 1.4, padding: "7px 0", maxHeight: 80, overflow: "auto" }} />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              style={{ width: 32, height: 32, borderRadius: 10, background: input.trim() ? `linear-gradient(135deg,${s.color},${s.color}88)` : "var(--border)", color: "#fff", border: "none", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: !input.trim() || loading ? 0.5 : 1, cursor: "pointer" }}>↑</button>
          </div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center", marginTop: 5 }}>Pour réviser, pas pour tricher · {aiName || "Study AI"}</div>
        </div>
      </div>
    </div>
  );
}

// ─── COPILOT WIDGET (desktop right column) ────────────────────────────────────
function CopilotWidget({ messages, input, setInput, loading, send, mode, setMode, subject, setSubject, currentSubject, imgName, setImgName, imgBase64, setImgBase64, fileRef, inputRef, endRef, handleFile, copy, copied, qLeft, isGuest, isPaid, isProf, guestCount, aiName, setScreen, randomQs, clearMessages }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "40%", background: "linear-gradient(135deg,var(--accent),var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>StudyAI Copilot</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{isGuest ? "5 messages gratuits" : isPaid ? "Questions illimitées" : `${qLeft} questions restantes`}</div>
            </div>
          </div>
          {messages.length > 0 && <button onClick={() => clearMessages(mode)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>🗑️</button>}
        </div>
        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
          {CHAT_MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 16, border: `1px solid ${mode === m.id ? "var(--accent)" : "var(--border)"}`, background: mode === m.id ? "var(--accent-soft)" : "transparent", color: mode === m.id ? "var(--accent)" : "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 14px 6px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px 10px" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✦</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Pose ta question ici</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Je suis là pour t'aider à réviser</div>
            {randomQs().map((q, i) => (
              <button key={i} onClick={() => send(q.q)}
                style={{ display: "block", width: "100%", background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", fontSize: 12, color: "var(--text-soft)", textAlign: "left", cursor: "pointer", marginBottom: 6 }}>
                <span style={{ color: "var(--accent)" }}>▸</span> {q.q}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="msg-in" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 10, gap: 6, alignItems: "flex-start" }}>
            {msg.role === "assistant" && <div style={{ width: 24, height: 24, borderRadius: "40%", background: "linear-gradient(135deg,var(--accent),var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, marginTop: 2 }}>✦</div>}
            <div style={{ maxWidth: "86%" }}>
              <div style={{ borderRadius: 14, padding: "9px 13px", fontSize: 13, lineHeight: 1.55, ...(msg.role === "user" ? { background: "linear-gradient(135deg,var(--accent),var(--accent2))", color: "#fff", borderBottomRightRadius: 4 } : { background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)", borderBottomLeftRadius: 4 }) }}>
                {msg.role === "user" ? msg.content : <div style={{ lineHeight: 1.65 }}>{fmtAI(msg.content)}</div>}
              </div>
              {msg.role === "assistant" && (
                <button onClick={() => copy(msg.content, i)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 10, cursor: "pointer", marginTop: 3, paddingLeft: 2 }}>
                  {copied === i ? "✅ Copié" : "📋 Copier"}
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg-in" style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: "40%", background: "linear-gradient(135deg,var(--accent),var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✦</div>
            <div style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 14, padding: "9px 13px" }}>
              <div style={{ display: "flex", gap: 3 }}>{[0, 0.2, 0.4].map((d, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "bounce 1.4s infinite", animationDelay: `${d}s` }} />)}</div>
            </div>
          </div>
        )}
        {isGuest && guestCount >= 4 && (
          <div style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-glow)", borderRadius: 12, padding: "12px", textAlign: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>Plus que {5 - guestCount} message(s) gratuit(s)</div>
            <Btn primary sm onClick={() => setScreen("auth")}>Créer un compte →</Btn>
          </div>
        )}
        <div ref={endRef} style={{ height: 4 }} />
      </div>

      {/* Input */}
      <div style={{ padding: "8px 10px 10px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        {imgName && (
          <div style={{ background: "var(--accent-soft)", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "var(--accent)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span>📷 {imgName}</span>
            <button onClick={() => { setImgBase64?.(null); setImgName?.(null); }} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", marginLeft: "auto" }}>✕</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", background: "var(--card2)", border: "1.5px solid var(--border)", borderRadius: 14, padding: "3px 5px 3px 10px" }}>
          {!isGuest && (
            <>
              <button onClick={() => fileRef.current?.click()} style={{ width: 30, height: 30, background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📷</button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
            </>
          )}
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={isGuest ? "Pose ta question..." : !isPaid && qLeft <= 0 ? "Limite atteinte..." : `Message en ${currentSubject?.label || "général"}...`}
            rows={2} disabled={(!isPaid && !isGuest && qLeft <= 0) || (isGuest && guestCount >= 5)}
            style={{ flex: 1, background: "transparent", border: "none", color: "var(--text)", fontSize: 13, resize: "none", lineHeight: 1.4, padding: "7px 0", maxHeight: 80, overflow: "auto" }} />
          <button onClick={() => send()} disabled={(!input.trim() && !imgBase64) || loading}
            style={{ width: 32, height: 32, borderRadius: 10, background: input.trim() || imgBase64 ? "linear-gradient(135deg,var(--accent),var(--accent2))" : "var(--border)", color: "#fff", border: "none", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: (!input.trim() && !imgBase64) || loading ? 0.5 : 1, cursor: "pointer" }}>↑</button>
        </div>
        <div style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center", marginTop: 4 }}>{aiName} · pour réviser, pas pour tricher</div>
      </div>
    </div>
  );
}

// ─── COPILOT FULL PAGE (mobile) ───────────────────────────────────────────────
// Uses flex: 1 + minHeight: 0 instead of height: "100%" — the only reliable
// way to fill a flex container on iOS Safari without escaping the viewport.
function CopilotFullPage(props) {
  return (
    <div className="sai-copilot-page">
      <CopilotWidget {...props} />
    </div>
  );
}

// ─── HEATMAP WIDGET ───────────────────────────────────────────────────────────
function HeatmapWidget({ game }) {
  const log = getActivityLog();
  const today = new Date();
  const days = [];
  const start = new Date(today);
  start.setDate(start.getDate() - 83);
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const k = d.toISOString().split("T")[0];
    days.push({ k, c: log[k] || 0 });
  }
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const clr = c => c === 0 ? "var(--border)" : c === 1 ? "rgba(99,102,241,0.35)" : c === 2 ? "rgba(99,102,241,0.65)" : "var(--accent)";

  return (
    <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Régularité</div>
      <div style={{ display: "flex", gap: 2 }}>
        {weeks.map((wk, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {wk.map((d, di) => <div key={di} title={`${d.k}: ${d.c} session${d.c !== 1 ? "s" : ""}`} style={{ width: 8, height: 8, borderRadius: 2, background: clr(d.c) }} />)}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>
        <span>12 semaines</span>
        <span>🔥 {game.streak} j consécutifs</span>
      </div>
    </div>
  );
}

// ─── PLANNER MINI WIDGET ──────────────────────────────────────────────────────
function PlannerMiniWidget({ examDates, saveExamDates, setView }) {
  const [adding, setAdding] = useState(false);
  const [nLabel, setNLabel] = useState("");
  const [nDate,  setNDate]  = useState("");
  const upcoming = examDates.filter(e => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 3);

  const addExam = () => {
    if (nLabel && nDate) { saveExamDates([...examDates, { label: nLabel, date: nDate }]); setNLabel(""); setNDate(""); setAdding(false); }
  };

  return (
    <div style={{ padding: "12px 16px 14px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Examens à venir</div>
        <button onClick={() => setAdding(a => !a)} style={{ background: "var(--accent-soft)", border: "none", borderRadius: 8, padding: "3px 9px", fontSize: 11, fontWeight: 700, color: "var(--accent)", cursor: "pointer" }}>+ Ajouter</button>
      </div>
      {adding && (
        <div style={{ marginBottom: 8, display: "flex", gap: 5, flexWrap: "wrap" }}>
          <input placeholder="Matière" value={nLabel} onChange={e => setNLabel(e.target.value)} style={{ flex: 1, minWidth: 70, background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", fontSize: 11, color: "var(--text)" }} />
          <input type="date" value={nDate} onChange={e => setNDate(e.target.value)} style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", fontSize: 11, color: "var(--text)" }} />
          <button onClick={addExam} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✓</button>
        </div>
      )}
      {upcoming.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "6px 0" }}>Aucun examen planifié</div>
      ) : upcoming.map((e, i) => {
        const days = Math.ceil((new Date(e.date) - new Date()) / 86400000);
        const urgent = days <= 7;
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < upcoming.length - 1 ? "1px solid var(--border)" : "none" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{e.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: urgent ? "var(--danger)" : "var(--text-muted)", background: urgent ? "rgba(220,38,38,0.08)" : "var(--card2)", borderRadius: 8, padding: "2px 7px" }}>J-{days}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── PANEL OVERLAY ────────────────────────────────────────────────────────────
function PanelOverlay({ panel, setPanel, subject, currentSubject, flashState, setFlashState, examState, setExamState, progress, addNote, game, genContent, genLoading, onGenExercises, onGenPlan, onAskAI, addXP, unlockBadge, incrementQuiz, familyProfiles, activeProfileId, setActiveProfileId, addFamilyProfile, removeFamilyProfile, currentUser, isPaid, setScreen }) {
  const close = () => setPanel(null);
  const titles = { flashcards: "🃏 Flashcards", exam: "🧪 Mode Examen", progress: "📊 Progression", plan: "📅 Plan de Révision", badges: "🏆 Mes Badges", games: "🎮 Quiz Flash", family: "👨‍👩‍👧 Profils Famille" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} onClick={e => e.target === e.currentTarget && close()}>
      <div className="pop-in sai-panel-sheet" style={{ background: "var(--card)", borderRadius: "24px 24px 0 0", padding: "22px 20px 28px", paddingBottom: "max(28px, calc(env(safe-area-inset-bottom) + 12px))", width: "100%", maxWidth: 560, maxHeight: "85dvh", overflow: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 800, fontSize: 18, color: "var(--text)" }}>{titles[panel] || "📋"}</h2>
          <button onClick={close} style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 10, padding: "5px 10px", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>✕</button>
        </div>
        {panel === "flashcards" && flashState && <FlashcardsUI state={flashState} setState={setFlashState} subject={subject} addXP={addXP} onClose={close} />}
        {panel === "exam" && examState && <ExamUI state={examState} addXP={addXP} unlockBadge={unlockBadge} onAskAI={onAskAI} onClose={close} isPaid={isPaid} setScreen={setScreen} />}
        {panel === "progress" && <ProgressPageView progress={progress} addNote={addNote} game={game} activeSubjects={activeSubjects} onAskAI={onAskAI} compact />}
        {panel === "plan" && <PlannerPageView progress={progress} genContent={genContent} genLoading={genLoading} onGenPlan={onGenPlan} onGenExercises={onGenExercises} subject={subject} compact />}
        {panel === "badges" && <BadgesPageView game={game} compact isPaid={isPaid} setScreen={setScreen} />}
        {panel === "games" && <GamesPageView subject={subject} addXP={addXP} isPaid={isPaid} setScreen={setScreen} />}
        {panel === "family" && <FamilyProfilesPanel familyProfiles={familyProfiles} activeProfileId={activeProfileId} setActiveProfileId={setActiveProfileId} addFamilyProfile={addFamilyProfile} removeFamilyProfile={removeFamilyProfile} currentUser={currentUser} onClose={close} />}
      </div>
    </div>
  );
}

// ─── FLASHCARDS UI ────────────────────────────────────────────────────────────
function FlashcardsUI({ state, setState, subject, addXP, onClose }) {
  const cards = state.cards;
  const card = cards[state.idx];
  const done = state.idx >= cards.length;
  if (done) return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 52, marginBottom: 10 }}>🎉</div>
      <div style={{ fontWeight: 800, fontSize: 20, color: "var(--text)", marginBottom: 6 }}>Série terminée !</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18 }}>{cards.length} cartes révisées</div>
      <Btn primary onClick={() => setState(p => ({ ...p, idx: 0, flipped: false }))}>🔄 Recommencer</Btn>
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
        <span>Carte {state.idx + 1}/{cards.length}</span><span>Clique pour retourner</span>
      </div>
      <div className="card-flip" style={{ height: 200, marginBottom: 18 }} onClick={() => setState(p => ({ ...p, flipped: !p.flipped }))}>
        <div className={`card-flip-inner${state.flipped ? " flipped" : ""}`}>
          <div className="card-front" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 800, fontSize: 20, color: "#fff", textAlign: "center" }}>{card.front}</div>
          </div>
          <div className="card-back" style={{ background: "var(--card2)", border: "2px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ fontSize: 14, color: "var(--text)", textAlign: "center", lineHeight: 1.7, whiteSpace: "pre-line" }}>{card.back}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn ghost full onClick={() => setState(p => ({ ...p, idx: p.idx + 1, flipped: false }))}>⏭ Suivante</Btn>
        <Btn primary full onClick={() => { addXP(15); setState(p => ({ ...p, idx: p.idx + 1, flipped: false })); }}>✅ Mémorisée (+15 XP)</Btn>
      </div>
    </div>
  );
}

// ─── EXAM SHARED COMPONENTS ───────────────────────────────────────────────────
function ExamEntryScreen({ icon, subjectLabel, mode, questionCount, durationMin, isPaid, freeCount, premiumCount, onStart, onClose, setScreen }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 22, color: "var(--text)", marginBottom: 4 }}>{mode}</div>
      <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>{subjectLabel}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        <div style={{ background: "var(--card2)", borderRadius: 16, padding: "16px 10px" }}>
          <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 28, color: "var(--text)" }}>{questionCount}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Questions</div>
        </div>
        <div style={{ background: "var(--card2)", borderRadius: 16, padding: "16px 10px" }}>
          <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 28, color: "var(--text)" }}>{durationMin} min</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Durée</div>
        </div>
      </div>

      {!isPaid && premiumCount > freeCount && (
        <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid var(--accent-glow)", borderRadius: 12, padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, textAlign: "left" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            🔒 Premium : {premiumCount} questions + corrections détaillées
          </div>
          <button onClick={() => setScreen && setScreen("pricing")}
            style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
            Débloquer
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Btn primary full onClick={onStart}>Commencer l'examen →</Btn>
        <Btn ghost full onClick={onClose}>Annuler</Btn>
      </div>
    </div>
  );
}

function ExamResultScreen({ correctCount, totalCount, wrongItems, isPaid, setScreen, addXP, unlockBadge, onRetry, onClose }) {
  const pct = Math.round((correctCount / totalCount) * 100);
  const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "⭐" : pct >= 40 ? "💪" : "📚";
  const scoreColor = pct >= 70 ? "var(--success)" : pct >= 50 ? "var(--warn)" : "var(--danger)";
  const xpEarned = correctCount * 15 + 10;
  const topics = [...new Set(wrongItems.map(x => x.topic).filter(Boolean))];

  useEffect(() => { addXP(xpEarned); unlockBadge("exam_passed"); }, []);

  return (
    <div>
      {/* Score hero */}
      <div style={{ textAlign: "center", marginBottom: 22, padding: "4px 0 12px" }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>{emoji}</div>
        <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 38, color: scoreColor, lineHeight: 1 }}>{correctCount}/{totalCount}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: scoreColor, marginTop: 4 }}>{pct}%</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>+{xpEarned} XP · Badge Champion débloqué !</div>
      </div>

      {/* Mistakes breakdown */}
      {wrongItems.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", marginBottom: 10 }}>
            ❌ {wrongItems.length} erreur{wrongItems.length > 1 ? "s" : ""}
          </div>
          {wrongItems.map((item, i) => (
            <div key={i} style={{ background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 12, padding: "11px 14px", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 5, lineHeight: 1.4 }}>Q{item.idx + 1}. {item.qText}</div>
              <div style={{ fontSize: 12, color: "var(--danger)" }}>✗ {item.userAnswer || "Non répondu"}</div>
              <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 700, marginTop: 2 }}>✓ {item.correct}</div>
              {isPaid && item.hint && (
                <div style={{ marginTop: 8, background: "var(--accent-soft)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "var(--accent)", lineHeight: 1.5 }}>
                  💡 {item.hint}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Premium recommendation */}
      {isPaid && topics.length > 0 && (
        <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.05))", border: "1px solid var(--accent-glow)", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "var(--accent)", marginBottom: 5 }}>✦ Recommandation IA</div>
          <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
            Tu dois revoir : <strong>{topics.join(", ")}</strong>. Utilise les flashcards pour ces chapitres.
          </div>
        </div>
      )}

      {/* Free lock CTA for explanations */}
      {!isPaid && wrongItems.length > 0 && (
        <div style={{ background: "var(--card2)", border: "1px dashed var(--accent-glow)", borderRadius: 12, padding: "12px 14px", marginBottom: 14, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
            🔒 Explications détaillées et recommandations IA disponibles avec Premium
          </div>
          <button onClick={() => setScreen && setScreen("pricing")}
            style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "7px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            Débloquer Premium →
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Btn primary full onClick={onRetry}>🔄 Réessayer</Btn>
        <Btn ghost onClick={onClose}>Terminer</Btn>
      </div>
    </div>
  );
}

// ─── EXAM UI (generic quiz exam via panel overlay) ────────────────────────────
function ExamUI({ state, addXP, unlockBadge, onAskAI, onClose, isPaid, setScreen }) {
  const subjectId = state?.subjectId || "maths";
  const subjectLabel = state?.subject || "Examen";
  const questionCount = isPaid ? 10 : 5;
  const questions = useMemo(() => buildMCQ(subjectId, questionCount), [subjectId, questionCount]);
  const duration = isPaid ? 20 * 60 : 10 * 60;

  const [phase, setPhase]       = useState("entry");
  const [current, setCurrent]   = useState(0);
  const [answers, setAnswers]   = useState({});
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(duration);
  const timerRef = useRef(null);

  useEffect(() => {
    if (phase !== "exam") return;
    timerRef.current = setInterval(() => setTimeLeft(t => {
      if (t <= 1) { clearInterval(timerRef.current); setPhase("result"); return 0; }
      return t - 1;
    }), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const handleAnswer = (choice) => {
    if (feedback) return;
    const correct = questions[current].card.front === choice;
    setAnswers(a => ({ ...a, [current]: choice }));
    setFeedback(correct ? "correct" : "wrong");
    setTimeout(() => {
      setFeedback(null);
      if (current < questions.length - 1) setCurrent(i => i + 1);
      else { clearInterval(timerRef.current); setPhase("result"); }
    }, 900);
  };

  const retry = () => { setCurrent(0); setAnswers({}); setFeedback(null); setTimeLeft(duration); setPhase("exam"); };

  if (phase === "entry") return (
    <ExamEntryScreen icon="🧪" subjectLabel={subjectLabel} mode="Examen Quiz"
      questionCount={questions.length} durationMin={isPaid ? 20 : 10}
      isPaid={isPaid} freeCount={5} premiumCount={10}
      onStart={() => setPhase("exam")} onClose={onClose} setScreen={setScreen} />
  );

  if (phase === "result") {
    const correctCount = questions.filter((q, i) => answers[i] === q.card.front).length;
    const wrongItems = questions.map((q, i) => ({
      idx: i, qText: q.card.back, correct: q.card.front, userAnswer: answers[i] || null, hint: null, topic: null,
    })).filter(x => x.userAnswer !== x.correct);
    return (
      <ExamResultScreen correctCount={correctCount} totalCount={questions.length}
        wrongItems={wrongItems} isPaid={isPaid} setScreen={setScreen}
        addXP={addXP} unlockBadge={unlockBadge} onRetry={retry} onClose={onClose} />
    );
  }

  const q = questions[current];
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");
  const timerPct = (timeLeft / duration) * 100;
  const timerColor = timerPct > 50 ? "var(--success)" : timerPct > 20 ? "var(--warn)" : "var(--danger)";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
          {subjectLabel} · <strong style={{ color: "var(--text)" }}>{current + 1} / {questions.length}</strong>
        </div>
        <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 20, color: timerColor }}>{mins}:{secs}</div>
      </div>
      <ProgressBar value={current + 1} max={questions.length} color="var(--accent)" />
      <div style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", margin: "14px 0" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Quel est ce concept ?</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", lineHeight: 1.6 }}>{q.card.back}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {q.opts.map((choice, i) => {
          const letter = ["A","B","C","D"][i];
          const selected = answers[current] === choice;
          const isCorrect = choice === q.card.front;
          let bg = "var(--card2)", bdr = "1.5px solid var(--border)";
          if (feedback && selected) {
            bg = feedback === "correct" ? "rgba(16,185,129,0.12)" : "rgba(220,38,38,0.10)";
            bdr = `1.5px solid ${feedback === "correct" ? "var(--success)" : "var(--danger)"}`;
          }
          if (feedback === "wrong" && isCorrect) { bg = "rgba(16,185,129,0.08)"; bdr = "1.5px solid var(--success)"; }
          return (
            <button key={choice} onClick={() => handleAnswer(choice)} disabled={!!feedback}
              style={{ background: bg, border: bdr, borderRadius: 12, padding: "12px 16px", textAlign: "left", cursor: feedback ? "default" : "pointer", display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s" }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0, color: "var(--text-muted)" }}>{letter}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{choice}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── PROGRESS PAGE VIEW ───────────────────────────────────────────────────────
function ProgressPageView({ progress, game, onAskAI, compact, activeSubjects: propSubjects }) {
  const { activeSubjects: ctxSubjects, effectiveProfile, setScreen } = useApp();
  const subjects = propSubjects || ctxSubjects;
  const grades = effectiveProfile?.grades || {};

  // Stats derived from profile.grades (single source of truth)
  const gradedSubjects = subjects.filter(s => grades[s.id] !== undefined && !s.noAI);
  const mean = gradedSubjects.length
    ? (gradedSubjects.reduce((sum, s) => sum + grades[s.id], 0) / gradedSubjects.length).toFixed(1)
    : null;
  const weak = gradedSubjects.filter(s => grades[s.id] < 10).map(s => s.label);
  const totalSessions = Object.values(progress).reduce((s, p) => s + (p.sessions || 0), 0);

  return (
    <div style={{ padding: compact ? "0" : "28px 32px", maxWidth: compact ? "none" : 800, margin: "0 auto" }}>
      {!compact && <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 800, fontSize: 22, color: "var(--text)", marginBottom: 20 }}>📊 Progression</div>}

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { icon: "📈", val: mean ? `${mean}/20` : "—", label: "Moyenne" },
          { icon: "🔥", val: totalSessions, label: "Sessions" },
          { icon: "⭐", val: game.xp, label: "XP total" },
        ].map((s, i) => (
          <div key={i} style={{ background: "var(--card2)", borderRadius: 14, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 18, color: "var(--text)" }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {weak.length > 0 && (
        <InfoBox icon="🎯" color="var(--danger)" title="Points à renforcer"
          msg={`Difficultés en : ${weak.join(", ")}. Entraîne-toi avec des quiz !`}
          action="Demander un plan"
          onAction={() => onAskAI && onAskAI(`Crée un plan de révision pour : ${weak.join(", ")}`)} />
      )}

      {/* Per-subject rows */}
      <div style={{ marginTop: 14 }}>
        {subjects.filter(s => s.id !== "general" && !s.noAI).map(s => {
          const grade = grades[s.id];
          const sessions = progress[s.id]?.sessions || 0;
          const hasGrade = grade !== undefined;
          const c = hasGrade
            ? grade >= 14 ? "var(--success)" : grade >= 10 ? "var(--warn)" : "var(--danger)"
            : "var(--text-muted)";
          return (
            <div key={s.id} style={{ background: "var(--card2)", borderRadius: 16, padding: "13px 14px", marginBottom: 8, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 13 }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {sessions > 0 ? `${sessions} session${sessions > 1 ? "s" : ""}` : "Pas encore commencé"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {hasGrade
                    ? <div style={{ fontWeight: 900, fontSize: 16, color: c }}>{grade}<span style={{ fontSize: 10, color: "var(--text-muted)" }}>/20</span></div>
                    : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                  }
                </div>
              </div>
              {hasGrade && (
                <div style={{ marginTop: 8 }}>
                  <ProgressBar value={grade} max={20} color={c} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Link to settings for grade editing */}
      {!compact && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => setScreen("settings")}
            style={{ background: "transparent", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
            ✏️ Modifier mes notes dans les Paramètres
          </button>
        </div>
      )}
    </div>
  );
}

// ─── PLANNER PAGE VIEW ────────────────────────────────────────────────────────
function PlannerPageView({ progress, genContent, genLoading, handleGenPlan, handleGenExercises, onGenPlan, onGenExercises, subject, examDates, saveExamDates, compact }) {
  const genP = onGenPlan || handleGenPlan;
  const genE = onGenExercises || handleGenExercises;
  return (
    <div style={{ padding: compact ? "0" : "28px 32px", maxWidth: compact ? "none" : 800, margin: "0 auto" }}>
      {!compact && <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 800, fontSize: 22, color: "var(--text)", marginBottom: 20 }}>📅 Plan de Révision</div>}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Btn primary loading={genLoading} onClick={genP}>📅 Générer mon planning</Btn>
        <Btn ghost loading={genLoading} onClick={genE}>✏️ Exercices sur mesure</Btn>
      </div>
      {genContent ? (
        <div style={{ background: "var(--card2)", borderRadius: 16, padding: "16px", fontSize: 13, color: "var(--text-soft)", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 400, overflow: "auto", border: "1px solid var(--border)" }}>
          {genContent.type === "error" ? <div style={{ color: "var(--danger)" }}>⚠️ {genContent.content}</div> : genContent.content}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
          L'IA analyse tes notes et crée un plan de révision adapté à toi.<br />Clique sur un bouton pour commencer.
        </div>
      )}
      {!compact && examDates && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 12 }}>Mes examens planifiés</div>
          {examDates.length === 0 ? (
            <div style={{ background: "var(--card2)", borderRadius: 14, padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13, border: "1px solid var(--border)" }}>
              Aucun examen planifié. Ajoute tes prochaines dates via le widget à droite.
            </div>
          ) : examDates.map((e, i) => {
            const days = Math.ceil((new Date(e.date) - new Date()) / 86400000);
            const past = days < 0;
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: past ? "var(--text-muted)" : "var(--text)", fontSize: 14 }}>{e.label}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: past ? "var(--text-muted)" : days <= 7 ? "var(--danger)" : "var(--warn)", fontWeight: 700 }}>{past ? "Passé" : `J-${days}`}</span>
                  <button onClick={() => saveExamDates(examDates.filter((_, j) => j !== i))} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── BADGES PAGE VIEW ─────────────────────────────────────────────────────────
function BadgesPageView({ game, compact, isPaid, setScreen }) {
  const FREE_BADGES = [
    { id: "first_msg",    icon: "💬", label: "Premier pas",     desc: "Premier message envoyé"         },
    { id: "quiz_5",       icon: "🎯", label: "Quizmaster",      desc: "5 quiz complétés"               },
    { id: "exam_passed",  icon: "🏆", label: "Champion",        desc: "Mode examen soumis"             },
    { id: "perfect_quiz", icon: "⭐", label: "Perfectionniste", desc: "Quiz parfait (5/5)"             },
    { id: "streak_3",     icon: "🔥", label: "En feu",          desc: "3 jours consécutifs"            },
    { id: "flashcard_10", icon: "🃏", label: "Mémoriseur",      desc: "10 flashcards mémorisées"       },
    { id: "notes_all",    icon: "📊", label: "Analyste",        desc: "Notes dans toutes les matières" },
    { id: "week_active",  icon: "📅", label: "Régulier",        desc: "Actif 7 jours de suite"         },
  ];
  const PREMIUM_BADGES = [
    { id: "boss_win",     icon: "🐉", label: "Dragon Slayer",   desc: "Gagner un Boss Battle"          },
    { id: "speed_5",      icon: "⚡", label: "Éclair",          desc: "5 Speed Quiz complétés"         },
    { id: "streak_30",    icon: "💪", label: "Infatigable",     desc: "30 jours consécutifs"           },
    { id: "perfect_boss", icon: "💎", label: "Diamant",         desc: "Boss Battle 10/10"              },
    { id: "match_10",     icon: "🔗", label: "Maître des liens",desc: "10 Associer complétés"          },
    { id: "xp_500",       icon: "🌟", label: "Expert",          desc: "Atteindre 500 XP"               },
  ];
  const HIDDEN_BADGES = [
    { id: "secret_1", icon: "🌙", label: "Noctambule",     desc: "Message envoyé après minuit"     },
    { id: "secret_2", icon: "🎲", label: "Chanceux",       desc: "Quiz parfait au premier essai"   },
    { id: "secret_3", icon: "🚀", label: "Hypervitesse",   desc: "Répondre en moins de 2 secondes" },
  ];

  const SectionLabel = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 18 }}>{children}</div>
  );

  const BadgeCard = ({ b, unlocked, locked }) => (
    <div style={{
      background: unlocked ? "var(--accent-soft)" : locked ? "var(--card2)" : "var(--card2)",
      border: `1px solid ${unlocked ? "var(--accent-glow)" : locked ? "var(--border)" : "var(--border)"}`,
      borderRadius: 14, padding: "14px 10px", textAlign: "center",
      opacity: locked ? 0.6 : unlocked ? 1 : 0.5,
      transition: "all 0.2s", position: "relative",
    }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{locked ? "🔒" : b.icon}</div>
      <div style={{ fontWeight: 700, fontSize: 12, color: locked ? "var(--text-muted)" : "var(--text)" }}>
        {locked ? b.label : b.label}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.3 }}>{locked ? b.desc : b.desc}</div>
      {unlocked && <div style={{ fontSize: 10, color: "var(--success)", fontWeight: 700, marginTop: 5 }}>✅ Débloqué</div>}
      {locked && <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, marginTop: 5 }}>Premium</div>}
    </div>
  );

  const HiddenCard = ({ b, unlocked }) => (
    <div style={{
      background: unlocked ? "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08))" : "var(--card2)",
      border: `1px solid ${unlocked ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 14, padding: "14px 10px", textAlign: "center", transition: "all 0.2s",
    }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{unlocked ? b.icon : "❓"}</div>
      <div style={{ fontWeight: 700, fontSize: 12, color: unlocked ? "var(--text)" : "var(--text-muted)" }}>
        {unlocked ? b.label : "???"}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{unlocked ? b.desc : "Achievement secret"}</div>
      {unlocked && <div style={{ fontSize: 10, color: "var(--success)", fontWeight: 700, marginTop: 5 }}>✅ Débloqué</div>}
    </div>
  );

  const unlockedCount = (game.badges || []).length;
  const totalCount = FREE_BADGES.length + PREMIUM_BADGES.length + HIDDEN_BADGES.length;

  return (
    <div style={{ padding: compact ? "0" : "28px 32px", maxWidth: compact ? "none" : 800, margin: "0 auto" }}>
      {!compact && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 800, fontSize: 22, color: "var(--text)" }}>🏆 Mes Badges</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{unlockedCount} / {totalCount} débloqués</div>
        </div>
      )}

      {!isPaid && (
        <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.05))", border: "1px solid var(--accent-glow)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>🔒 {PREMIUM_BADGES.length + HIDDEN_BADGES.length} badges Premium non débloqués</div>
          {setScreen && <button onClick={() => setScreen("pricing")} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Débloquer →</button>}
        </div>
      )}

      <SectionLabel>Badges gratuits</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
        {FREE_BADGES.map(b => <BadgeCard key={b.id} b={b} unlocked={(game.badges || []).includes(b.id)} locked={false} />)}
      </div>

      <SectionLabel>Badges Premium ✦</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
        {PREMIUM_BADGES.map(b => (
          <BadgeCard key={b.id} b={b} unlocked={isPaid && (game.badges || []).includes(b.id)} locked={!isPaid} />
        ))}
      </div>

      <SectionLabel>Achievements secrets</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {HIDDEN_BADGES.map(b => (
          <HiddenCard key={b.id} b={b} unlocked={(game.badges || []).includes(b.id)} />
        ))}
      </div>
    </div>
  );
}

// ─── GAMES PAGE VIEW ──────────────────────────────────────────────────────────
const GAME_CATALOG = [
  { id: "quiz",    icon: "🎯", label: "Quiz Flash",      desc: "5 questions · QCM sur tes flashcards", xp: 10,  premium: false, color: "#6366f1" },
  { id: "speed",   icon: "⚡", label: "Speed Quiz",      desc: "15 sec par question · Chrono !",       xp: 15,  premium: true,  color: "#f59e0b" },
  { id: "tf",      icon: "✅", label: "Vrai ou Faux",    desc: "Rapide · Parfait pour réviser vite",   xp: 8,   premium: true,  color: "#10b981" },
  { id: "boss",    icon: "🐉", label: "Boss Battle",     desc: "10 questions · Double XP si 7/10+",    xp: 20,  premium: true,  color: "#ef4444" },
  { id: "match",   icon: "🔗", label: "Associer",        desc: "Relie chaque terme à sa définition",   xp: 12,  premium: true,  color: "#8b5cf6" },
];

function GamesPageView({ subject, addXP, isPaid, setScreen }) {
  const [activeGame, setActiveGame] = useState(null);

  if (activeGame) {
    const onDone = () => setActiveGame(null);
    if (activeGame === "quiz")  return <QuizGame  subject={subject} addXP={addXP} onBack={onDone} xpPer={10} count={5}  />;
    if (activeGame === "speed") return <SpeedGame subject={subject} addXP={addXP} onBack={onDone} />;
    if (activeGame === "tf")    return <TrueFalseGame subject={subject} addXP={addXP} onBack={onDone} />;
    if (activeGame === "boss")  return <BossGame  subject={subject} addXP={addXP} onBack={onDone} unlockBadge={() => {}} />;
    if (activeGame === "match") return <MatchGame subject={subject} addXP={addXP} onBack={onDone} />;
  }

  return (
    <div style={{ padding: "28px 24px", maxWidth: 700, margin: "0 auto" }} className="fade-in">
      <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 22, color: "var(--text)", marginBottom: 6 }}>🎮 Mini-Jeux</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        Joue pour gagner de l'XP — les abonnés Premium profitent de {isPaid ? "tous les jeux débloqués 🔓" : "5 jeux (4 en Premium 🔒)"}
      </div>

      {isPaid && (
        <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08))", border: "1px solid var(--accent-glow)", borderRadius: 14, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>
          ✦ XP ×1.5 actif · Tous les jeux débloqués
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {GAME_CATALOG.map(g => {
          const locked = g.premium && !isPaid;
          return (
            <div key={g.id}
              style={{ background: "var(--card)", border: `1.5px solid ${locked ? "var(--border)" : g.color + "35"}`, borderRadius: 18, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, opacity: locked ? 0.75 : 1, transition: "all 0.2s", position: "relative", overflow: "hidden" }}>

              {/* Game icon */}
              <div style={{ width: 48, height: 48, borderRadius: 14, background: locked ? "var(--card2)" : g.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                {locked ? "🔒" : g.icon}
              </div>

              {/* Game info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: locked ? "var(--text-muted)" : "var(--text)" }}>{g.label}</span>
                  {g.premium && <span style={{ fontSize: 10, fontWeight: 700, background: locked ? "var(--card2)" : g.color + "18", color: locked ? "var(--text-muted)" : g.color, border: `1px solid ${locked ? "var(--border)" : g.color + "40"}`, borderRadius: 20, padding: "1px 7px" }}>PREMIUM</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{g.desc}</div>
                <div style={{ fontSize: 11, color: g.color, fontWeight: 700, marginTop: 3 }}>+{isPaid ? Math.round(g.xp * 1.5) : g.xp} XP par bonne réponse</div>
              </div>

              {/* CTA */}
              {locked ? (
                <button onClick={() => setScreen("pricing")}
                  style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
                  Débloquer →
                </button>
              ) : (
                <button onClick={() => setActiveGame(g.id)}
                  style={{ background: g.color, color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
                  Jouer →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared MCQ quiz used by QuizGame and BossGame ─────────────────────────────
function buildMCQ(subject, count) {
  const allCards = Object.values(FLASHCARDS_DB).flat();
  const subCards = FLASHCARDS_DB[subject]?.length >= 4 ? FLASHCARDS_DB[subject] : allCards;
  const shuffled = [...subCards].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map(c => {
    const wrongs = allCards.filter(x => x.front !== c.front).sort(() => Math.random() - 0.5).slice(0, 3);
    return { card: c, opts: [...wrongs.map(x => x.front), c.front].sort(() => Math.random() - 0.5) };
  });
}

function MCQQuestionUI({ q, chosen, onAnswer }) {
  const { card, opts } = q;
  return (
    <>
      <div style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px", marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Quel est ce concept ?</div>
        <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.65, whiteSpace: "pre-line" }}>{card.back}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {opts.map((opt, i) => {
          const isCorrect = opt === card.front;
          const isChosen  = opt === chosen;
          const bg = chosen ? (isCorrect ? "rgba(16,185,129,0.1)" : isChosen ? "rgba(220,38,38,0.08)" : "transparent") : "transparent";
          const border = chosen ? (isCorrect ? "var(--success)" : isChosen ? "var(--danger)" : "var(--border)") : "var(--border)";
          const color = chosen ? (isCorrect ? "var(--success)" : isChosen ? "var(--danger)" : "var(--text-muted)") : "var(--text-soft)";
          return (
            <button key={i} onClick={() => onAnswer(opt)}
              style={{ padding: "10px 14px", borderRadius: 12, textAlign: "left", fontSize: 13, fontWeight: 600, cursor: chosen ? "default" : "pointer", transition: "all 0.2s", border: `1.5px solid ${border}`, background: bg, color }}>
              {chosen && isCorrect ? "✅ " : chosen && isChosen ? "❌ " : ""}{opt}
            </button>
          );
        })}
      </div>
    </>
  );
}

function GameResultScreen({ score, total, xpEarned, onReplay, onBack, title }) {
  const emoji = score >= total * 0.8 ? "🏆" : score >= total * 0.5 ? "⭐" : "💪";
  return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div style={{ fontSize: 56, marginBottom: 10 }}>{emoji}</div>
      <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 22, color: "var(--text)", marginBottom: 6 }}>{score}/{total} {title || "bonnes réponses"}</div>
      <div style={{ fontSize: 14, color: "var(--warn)", fontWeight: 700, marginBottom: 18 }}>+{xpEarned} XP gagnés !</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Btn primary onClick={onReplay}>🔄 Rejouer</Btn>
        <Btn ghost onClick={onBack}>← Retour aux jeux</Btn>
      </div>
    </div>
  );
}

// ── Game 1: Quiz Flash (FREE) ─────────────────────────────────────────────────
function QuizGame({ subject, addXP, onBack, count = 5 }) {
  const [questions, setQs] = useState(() => buildMCQ(subject, count));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [done, setDone] = useState(false);
  const [xpEarned, setXpE] = useState(0);

  const replay = () => { setQs(buildMCQ(subject, count)); setIdx(0); setScore(0); setChosen(null); setDone(false); setXpE(0); };

  const handleAnswer = opt => {
    if (chosen) return;
    setChosen(opt);
    if (opt === questions[idx].card.front) {
      setScore(s => s + 1);
      addXP(10);
      setXpE(e => e + 10);
    }
    setTimeout(() => {
      if (idx + 1 >= questions.length) setDone(true);
      else { setIdx(i => i + 1); setChosen(null); }
    }, 1100);
  };

  if (done) return <GameResultScreen score={score} total={questions.length} xpEarned={xpEarned} onReplay={replay} onBack={onBack} />;

  return (
    <div style={{ padding: "0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>← Jeux</button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Question {idx + 1}/{questions.length}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--warn)" }}>⭐ {xpEarned} XP</span>
      </div>
      <MCQQuestionUI q={questions[idx]} chosen={chosen} onAnswer={handleAnswer} />
    </div>
  );
}

// ── Game 2: Speed Quiz (PREMIUM) ──────────────────────────────────────────────
function SpeedGame({ subject, addXP, onBack }) {
  const COUNT = 5;
  const TIME_PER_Q = 15;
  const [questions, setQs] = useState(() => buildMCQ(subject, COUNT));
  const [idx, setIdx]     = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [done, setDone]   = useState(false);
  const [xpEarned, setXpE] = useState(0);
  const [timeLeft, setTime] = useState(TIME_PER_Q);
  const timerRef = useRef(null);

  const next = useCallback((wasCorrect, opt) => {
    clearInterval(timerRef.current);
    if (wasCorrect) { setScore(s => s + 1); addXP(15); setXpE(e => e + 15); }
    setChosen(opt || "timeout");
    setTimeout(() => {
      if (idx + 1 >= COUNT) { setDone(true); }
      else { setIdx(i => i + 1); setChosen(null); setTime(TIME_PER_Q); }
    }, 900);
  }, [idx, addXP]);

  useEffect(() => {
    if (done || chosen) return;
    timerRef.current = setInterval(() => {
      setTime(t => {
        if (t <= 1) { next(false, null); return TIME_PER_Q; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [idx, chosen, done, next]);

  const replay = () => { setQs(buildMCQ(subject, COUNT)); setIdx(0); setScore(0); setChosen(null); setDone(false); setXpE(0); setTime(TIME_PER_Q); };

  if (done) return <GameResultScreen score={score} total={COUNT} xpEarned={xpEarned} onReplay={replay} onBack={onBack} />;

  const urgent = timeLeft <= 5;
  return (
    <div style={{ padding: "0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>← Jeux</button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Question {idx + 1}/{COUNT}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: urgent ? "var(--danger)" : "var(--success)", fontFamily: "Space Grotesk,sans-serif" }}>{timeLeft}s</span>
          <span style={{ fontSize: 12, color: "var(--warn)", fontWeight: 700 }}>⭐ {xpEarned} XP</span>
        </div>
      </div>
      {/* Timer bar */}
      <div style={{ height: 4, background: "var(--border)", borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: "100%", width: `${(timeLeft / TIME_PER_Q) * 100}%`, background: urgent ? "var(--danger)" : "var(--success)", transition: "width 1s linear, background 0.3s" }} />
      </div>
      <MCQQuestionUI q={questions[idx]} chosen={chosen} onAnswer={opt => next(opt === questions[idx].card.front, opt)} />
    </div>
  );
}

// ── Game 3: Vrai ou Faux (PREMIUM) ────────────────────────────────────────────
function TrueFalseGame({ subject, addXP, onBack }) {
  const buildTF = () => {
    const allCards = Object.values(FLASHCARDS_DB).flat();
    const subCards = FLASHCARDS_DB[subject]?.length >= 4 ? FLASHCARDS_DB[subject] : allCards;
    const pool = [...subCards].sort(() => Math.random() - 0.5).slice(0, 8);
    return pool.map((c, i) => {
      const isTrue = i % 2 === 0;
      const fakeCard = !isTrue ? allCards.filter(x => x.front !== c.front).sort(() => Math.random() - 0.5)[0] : null;
      return { front: c.front, back: isTrue ? c.back : fakeCard?.back || c.back, answer: isTrue };
    });
  };
  const [questions, setQs] = useState(buildTF);
  const [idx, setIdx]     = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [done, setDone]   = useState(false);
  const [xpEarned, setXpE] = useState(0);

  const handleAnswer = (val) => {
    if (chosen !== null) return;
    setChosen(val);
    if (val === questions[idx].answer) { setScore(s => s + 1); addXP(8); setXpE(e => e + 8); }
    setTimeout(() => {
      if (idx + 1 >= questions.length) setDone(true);
      else { setIdx(i => i + 1); setChosen(null); }
    }, 1000);
  };

  const replay = () => { setQs(buildTF()); setIdx(0); setScore(0); setChosen(null); setDone(false); setXpE(0); };

  if (done) return <GameResultScreen score={score} total={questions.length} xpEarned={xpEarned} onReplay={replay} onBack={onBack} />;

  const q = questions[idx];
  const correct = q.answer;
  return (
    <div style={{ padding: "0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>← Jeux</button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Question {idx + 1}/{questions.length}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--warn)" }}>⭐ {xpEarned} XP</span>
      </div>
      <div style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 16px", marginBottom: 18, textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>La définition correspond à "{q.front}" ?</div>
        <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-line" }}>{q.back}</div>
      </div>
      {chosen !== null && (
        <div style={{ textAlign: "center", marginBottom: 12, fontSize: 14, fontWeight: 700, color: chosen === correct ? "var(--success)" : "var(--danger)" }}>
          {chosen === correct ? "✅ Correct !" : `❌ Faux — c'était "${correct ? "VRAI" : "FAUX"}"`}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[{ val: true, label: "✅ VRAI" }, { val: false, label: "❌ FAUX" }].map(btn => {
          const picked = chosen === btn.val;
          const rightAnswer = btn.val === correct;
          const bg = chosen !== null
            ? (rightAnswer ? "rgba(16,185,129,0.15)" : picked ? "rgba(220,38,38,0.1)" : "transparent")
            : "transparent";
          const border = chosen !== null
            ? (rightAnswer ? "var(--success)" : picked ? "var(--danger)" : "var(--border)")
            : "var(--border)";
          return (
            <button key={String(btn.val)} onClick={() => handleAnswer(btn.val)}
              style={{ padding: "16px", borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: chosen !== null ? "default" : "pointer", transition: "all 0.2s", border: `2px solid ${border}`, background: bg, color: chosen !== null ? (rightAnswer ? "var(--success)" : "var(--text-muted)") : "var(--text)" }}>
              {btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Game 4: Boss Battle (PREMIUM) — 10 questions, 2x XP if 7+ ────────────────
function BossGame({ subject, addXP, onBack }) {
  const COUNT = 10;
  const [questions, setQs] = useState(() => buildMCQ(subject, COUNT));
  const [idx, setIdx]     = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [done, setDone]   = useState(false);
  const [xpEarned, setXpE] = useState(0);

  const handleAnswer = opt => {
    if (chosen) return;
    setChosen(opt);
    if (opt === questions[idx].card.front) {
      setScore(s => s + 1);
      addXP(20);
      setXpE(e => e + 20);
    }
    setTimeout(() => {
      if (idx + 1 >= COUNT) setDone(true);
      else { setIdx(i => i + 1); setChosen(null); }
    }, 1000);
  };

  const replay = () => { setQs(buildMCQ(subject, COUNT)); setIdx(0); setScore(0); setChosen(null); setDone(false); setXpE(0); };

  if (done) {
    const won = score >= 7;
    const bonusXP = won ? 100 : 0;
    if (won) addXP(100);
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={{ fontSize: 56, marginBottom: 10 }}>{won ? "🐉" : "😤"}</div>
        <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 22, color: "var(--text)", marginBottom: 6 }}>{won ? "Boss vaincu !" : "Boss résiste..."}</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 4 }}>{score}/{COUNT} bonnes réponses</div>
        {won && <div style={{ fontSize: 14, color: "var(--success)", fontWeight: 700, marginBottom: 4 }}>+100 XP bonus Boss !</div>}
        <div style={{ fontSize: 14, color: "var(--warn)", fontWeight: 700, marginBottom: 18 }}>Total : +{xpEarned + bonusXP} XP</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Btn primary onClick={replay}>🔄 Réessayer</Btn>
          <Btn ghost onClick={onBack}>← Jeux</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>← Jeux</button>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18 }}>🐉</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{idx + 1}/{COUNT}</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--warn)" }}>⭐ {xpEarned} XP</span>
      </div>
      {/* Health bar */}
      <div style={{ height: 6, background: "var(--border)", borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: "100%", width: `${((COUNT - idx) / COUNT) * 100}%`, background: "linear-gradient(90deg,#ef4444,#f97316)", transition: "width 0.5s" }} />
      </div>
      <MCQQuestionUI q={questions[idx]} chosen={chosen} onAnswer={handleAnswer} />
    </div>
  );
}

// ── Game 5: Match (PREMIUM) — pair term ↔ definition ─────────────────────────
function MatchGame({ subject, addXP, onBack }) {
  const buildPairs = () => {
    const allCards = Object.values(FLASHCARDS_DB).flat();
    const subCards = FLASHCARDS_DB[subject]?.length >= 4 ? FLASHCARDS_DB[subject] : allCards;
    return [...subCards].sort(() => Math.random() - 0.5).slice(0, 4);
  };
  const [pairs, setPairs]         = useState(buildPairs);
  const [leftSel, setLeftSel]     = useState(null);
  const [rightSel, setRightSel]   = useState(null);
  const [matched, setMatched]     = useState([]);
  const [errors, setErrors]       = useState(0);
  const [done, setDone]           = useState(false);
  const [xpEarned, setXpE]        = useState(0);
  const rights = useState(() => [...pairs].sort(() => Math.random() - 0.5))[0];

  useEffect(() => {
    if (leftSel === null || rightSel === null) return;
    const correct = pairs[leftSel]?.front === rights[rightSel]?.front;
    if (correct) {
      const newMatched = [...matched, leftSel];
      setMatched(newMatched);
      addXP(12); setXpE(e => e + 12);
      if (newMatched.length === pairs.length) setTimeout(() => setDone(true), 400);
    } else {
      setErrors(e => e + 1);
    }
    setTimeout(() => { setLeftSel(null); setRightSel(null); }, 600);
  }, [leftSel, rightSel]);

  const replay = () => { const p = buildPairs(); setPairs(p); setLeftSel(null); setRightSel(null); setMatched([]); setErrors(0); setDone(false); setXpE(0); };

  if (done) return <GameResultScreen score={pairs.length} total={pairs.length} xpEarned={xpEarned} onReplay={replay} onBack={onBack} title={`associations correctes (${errors} erreur${errors !== 1 ? "s" : ""})`} />;

  const isMatchedLeft = (i) => matched.includes(i);
  const isMatchedRight = (i) => matched.some(mi => pairs[mi]?.front === rights[i]?.front);

  return (
    <div style={{ padding: "0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>← Jeux</button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Associer les paires</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--warn)" }}>⭐ {xpEarned} XP</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>Terme</div>
          {pairs.map((p, i) => {
            const ml = isMatchedLeft(i);
            const sel = leftSel === i;
            return (
              <button key={i} onClick={() => !ml && setLeftSel(i === leftSel ? null : i)}
                style={{ padding: "10px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: ml ? "default" : "pointer", textAlign: "left", border: `2px solid ${ml ? "var(--success)" : sel ? "var(--accent)" : "var(--border)"}`, background: ml ? "rgba(16,185,129,0.1)" : sel ? "var(--accent-soft)" : "var(--card2)", color: ml ? "var(--success)" : sel ? "var(--accent)" : "var(--text)", transition: "all 0.15s" }}>
                {p.front}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>Définition</div>
          {rights.map((p, i) => {
            const mr = isMatchedRight(i);
            const sel = rightSel === i;
            return (
              <button key={i} onClick={() => !mr && setRightSel(i === rightSel ? null : i)}
                style={{ padding: "10px 12px", borderRadius: 12, fontSize: 11, fontWeight: 500, cursor: mr ? "default" : "pointer", textAlign: "left", border: `2px solid ${mr ? "var(--success)" : sel ? "var(--accent)" : "var(--border)"}`, background: mr ? "rgba(16,185,129,0.1)" : sel ? "var(--accent-soft)" : "var(--card2)", color: mr ? "var(--success)" : sel ? "var(--accent)" : "var(--text-muted)", transition: "all 0.15s", lineHeight: 1.4, whiteSpace: "pre-line" }}>
                {p.back.split("\n")[0]}
              </button>
            );
          })}
        </div>
      </div>
      {errors > 0 && <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--danger)" }}>❌ {errors} mauvaise{errors > 1 ? "s" : ""} association{errors > 1 ? "s" : ""}</div>}
    </div>
  );
}

// ─── STATS PAGE VIEW ──────────────────────────────────────────────────────────
function StatsPageView({ progress, game }) {
  const { effectiveProfile, setScreen } = useApp();
  const info = lvlInfo(game.xp);
  const sessions = Object.values(progress).reduce((s, p) => s + (p.sessions || 0), 0);
  const grades = effectiveProfile?.grades || {};
  // Build avgs from profile.grades (single source of truth)
  const avgs = Object.entries(grades)
    .filter(([id]) => ALL_SUBJECTS[id])
    .sort(([, a], [, b]) => b - a);
  const log = getActivityLog();
  const activeDays = Object.keys(log).length;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 800, fontSize: 22, color: "var(--text)", marginBottom: 20 }}>📈 Statistiques</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { icon: "⭐", label: "XP Total",        val: game.xp,              color: "#f59e0b" },
          { icon: "🏆", label: "Niveau",           val: `Niv. ${info.level}`, color: "#6366f1" },
          { icon: "🔥", label: "Streak actuel",    val: `${game.streak}j`,    color: "#ef4444" },
          { icon: "📅", label: "Jours actifs",     val: activeDays,           color: "#10b981" },
          { icon: "💬", label: "Sessions totales", val: sessions,             color: "#3b82f6" },
          { icon: "📊", label: "Matières notées",  val: avgs.length,          color: "#8b5cf6" },
        ].map((s, i) => (
          <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: "18px 16px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 22, color: "var(--text)" }}>{s.val}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      {avgs.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: "18px 20px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 14 }}>Mes notes par matière</div>
          {avgs.map(([id, grade]) => {
            const s = ALL_SUBJECTS[id];
            if (!s) return null;
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 18, width: 24 }}>{s.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: grade >= 14 ? "var(--success)" : grade >= 10 ? "var(--warn)" : "var(--danger)" }}>{grade}/20</span>
                  </div>
                  <ProgressBar value={grade} max={20} color={grade >= 14 ? "var(--success)" : grade >= 10 ? "var(--warn)" : "var(--danger)"} height={5} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {avgs.length === 0 && (
        <div style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 18, padding: "32px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 6 }}>Pas encore de notes</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
            Renseigne tes moyennes dans les Paramètres pour voir tes statistiques.
          </div>
          <button onClick={() => setScreen("settings")}
            style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Renseigner mes notes →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── PARENT DASHBOARD ─────────────────────────────────────────────────────────
function ParentDashboard({ familyProfiles, allProfiles, allGameData, allProgress, isMobile }) {
  const { setActiveProfileId, setScreen } = useApp();

  const getChildStats = (childId) => {
    const game     = allGameData[childId] || { xp: 0, streak: 0, badges: [] };
    const profile  = allProfiles[childId] || {};
    const grades   = profile.grades || {};
    const prog     = allProgress[childId] || {};
    const sessions = Object.values(prog).reduce((s, p) => s + (p.sessions || 0), 0);
    const level    = calcLvl(game.xp);

    const gradedEntries = Object.entries(grades).filter(([, v]) => v !== undefined);
    const avgGrade = gradedEntries.length
      ? (gradedEntries.reduce((s, [, v]) => s + v, 0) / gradedEntries.length).toFixed(1)
      : null;
    const weakSubjects = gradedEntries
      .filter(([, v]) => v < 10)
      .map(([id]) => ALL_SUBJECTS[id]?.label)
      .filter(Boolean);

    return { game, level, avgGrade, weakSubjects, sessions };
  };

  return (
    <div style={{ padding: isMobile ? "16px 14px 24px" : "28px 32px", maxWidth: 900, margin: "0 auto", width: "100%" }} className="fade-in">

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: isMobile ? 22 : 26, color: "var(--text)", marginBottom: 6, letterSpacing: "-0.4px" }}>
          👨‍👩‍👧 Tableau de bord famille
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Suivez la progression de chaque enfant en temps réel
        </div>
      </div>

      {/* No children yet */}
      {familyProfiles.length === 0 && (
        <div style={{ background: "var(--card)", border: "2px dashed var(--border)", borderRadius: 20, padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>👨‍👩‍👧</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text)", marginBottom: 8 }}>Aucun enfant ajouté</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 22, lineHeight: 1.6, maxWidth: 320, margin: "0 auto 22px" }}>
            Ajoutez des profils enfants pour suivre leur progression et leurs résultats scolaires.
          </div>
          <Btn primary onClick={() => setScreen("profileselect")}>+ Ajouter un profil enfant</Btn>
        </div>
      )}

      {/* Child cards grid */}
      {familyProfiles.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(260px,1fr))", gap: 16, marginBottom: 20 }}>
            {familyProfiles.map(child => {
              const { game, level, avgGrade, weakSubjects, sessions } = getChildStats(child.id);
              const gradeColor = avgGrade
                ? parseFloat(avgGrade) >= 14 ? "var(--success)" : parseFloat(avgGrade) >= 10 ? "var(--warn)" : "var(--danger)"
                : "var(--text-muted)";

              return (
                <div key={child.id}
                  style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "20px", transition: "all 0.2s" }}
                  onMouseOver={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseOut={e => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}>

                  {/* Child header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--card2)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
                      {child.avatar || "🧑‍🎓"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>{child.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                        {child.classe} · Niv.{level} · {game.xp} XP
                      </div>
                    </div>
                    {game.streak > 0 && (
                      <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 16, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "var(--warn)", flexShrink: 0 }}>
                        🔥 {game.streak}j
                      </div>
                    )}
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    {[
                      { icon: "📊", label: "Moyenne",  val: avgGrade ? `${avgGrade}/20` : "—", color: gradeColor },
                      { icon: "📚", label: "Sessions", val: sessions,                          color: "var(--text)" },
                      { icon: "🏆", label: "Badges",   val: (game.badges || []).length,        color: "var(--text)" },
                    ].map((stat, i) => (
                      <div key={i} style={{ background: "var(--card2)", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                        <div style={{ fontSize: 16, marginBottom: 3 }}>{stat.icon}</div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: stat.color }}>{stat.val}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Weak subjects warning */}
                  {weakSubjects.length > 0 && (
                    <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 12 }}>
                      <span style={{ color: "var(--danger)", fontWeight: 700 }}>⚠️ À renforcer : </span>
                      <span style={{ color: "var(--text-soft)" }}>{weakSubjects.slice(0, 3).join(", ")}</span>
                    </div>
                  )}

                  {/* No data yet */}
                  {sessions === 0 && !avgGrade && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "4px 0 10px", fontStyle: "italic" }}>
                      Aucune activité encore
                    </div>
                  )}

                  {/* Switch to profile button */}
                  <button
                    onClick={() => { setActiveProfileId(child.id); }}
                    style={{ width: "100%", background: "var(--accent-soft)", border: "1px solid var(--accent-glow)", borderRadius: 12, padding: "9px", fontSize: 13, fontWeight: 700, color: "var(--accent)", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseOver={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#fff"; }}
                    onMouseOut={e => { e.currentTarget.style.background = "var(--accent-soft)"; e.currentTarget.style.color = "var(--accent)"; }}>
                    Voir le profil de {child.name?.split(" ")[0]} →
                  </button>
                </div>
              );
            })}
          </div>

          {/* Manage profiles */}
          <div style={{ textAlign: "center" }}>
            <button onClick={() => setScreen("profileselect")}
              style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}>
              ⚙️ Gérer les profils
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── FAMILY PROFILES PANEL ────────────────────────────────────────────────────
const AVATARS = ["🧑‍🎓", "👧", "👦", "👩", "👨", "🧒", "👩‍💼", "👨‍💼", "🧑", "👩‍🏫", "👨‍🏫"];

function FamilyProfilesPanel({ familyProfiles, activeProfileId, setActiveProfileId, addFamilyProfile, removeFamilyProfile, currentUser, onClose }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("eleve");
  const [newClasse, setNewClasse] = useState("3e");
  const [newAvatar, setNewAvatar] = useState("🧑‍🎓");

  const handleAdd = () => {
    if (!newName.trim()) return;
    addFamilyProfile({ name: newName.trim(), role: newRole, classe: newClasse, avatar: newAvatar, plan: currentUser?.plan || "free" });
    setNewName(""); setAdding(false);
  };

  const classeOpts = ["6e","5e","4e","3e","2nde","1ere","terminale","superieur"];

  return (
    <div>
      {/* Main account */}
      <div style={{ background: "linear-gradient(135deg,var(--accent-soft),rgba(124,58,237,0.04))", border: "1px solid var(--accent-glow)", borderRadius: 16, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),var(--accent2))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>{currentUser?.name?.[0]?.toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{currentUser?.name} <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>· Compte principal</span></div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{currentUser?.classe} · {currentUser?.plan === "premium" ? "Premium" : "Gratuit"}</div>
        </div>
        {activeProfileId !== null && (
          <button onClick={() => { setActiveProfileId(null); onClose(); }}
            style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-glow)", borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "var(--accent)", cursor: "pointer" }}>
            Utiliser
          </button>
        )}
        {activeProfileId === null && <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 700 }}>✅ Actif</span>}
      </div>

      {/* Family profiles */}
      <div style={{ marginBottom: 14 }}>
        {familyProfiles.length === 0 && !adding && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👨‍👩‍👧</div>
            Aucun profil famille.<br />Ajoute jusqu'à 5 profils pour partager l'abonnement.
          </div>
        )}
        {familyProfiles.map(p => (
          <div key={p.id} style={{ background: "var(--card2)", border: `1.5px solid ${activeProfileId === p.id ? "var(--accent)" : "var(--border)"}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{p.avatar || "👤"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{p.classe} · {p.role === "prof" ? "Professeur" : "Élève"}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {activeProfileId !== p.id ? (
                <button onClick={() => { setActiveProfileId(p.id); onClose(); }}
                  style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-glow)", borderRadius: 9, padding: "5px 10px", fontSize: 12, fontWeight: 700, color: "var(--accent)", cursor: "pointer" }}>
                  Utiliser
                </button>
              ) : <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 700, padding: "0 4px" }}>✅</span>}
              <button onClick={() => removeFamilyProfile(p.id)}
                style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 9, padding: "5px 9px", fontSize: 12, color: "var(--danger)", cursor: "pointer" }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* Add profile form */}
      {adding ? (
        <div style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 12 }}>Nouveau profil</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Prénom"
              style={{ flex: 1, background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--text)" }} />
            <select value={newClasse} onChange={e => setNewClasse(e.target.value)}
              style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "8px 10px", fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
              {classeOpts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Avatar :</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {AVATARS.map(a => (
                <button key={a} onClick={() => setNewAvatar(a)}
                  style={{ width: 36, height: 36, borderRadius: 10, border: `2px solid ${newAvatar === a ? "var(--accent)" : "var(--border)"}`, background: newAvatar === a ? "var(--accent-soft)" : "transparent", fontSize: 20, cursor: "pointer" }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn primary onClick={handleAdd} disabled={!newName.trim()}>✓ Ajouter</Btn>
            <Btn ghost onClick={() => setAdding(false)}>Annuler</Btn>
          </div>
        </div>
      ) : (
        familyProfiles.length < 5 && (
          <button onClick={() => setAdding(true)}
            style={{ width: "100%", background: "var(--card2)", border: "1.5px dashed var(--border)", borderRadius: 14, padding: "14px", fontSize: 13, color: "var(--text-muted)", cursor: "pointer", fontWeight: 600 }}>
            + Ajouter un profil famille ({familyProfiles.length}/5)
          </button>
        )
      )}
    </div>
  );
}

// ─── BREVET / BAC STRUCTURED EXAM ────────────────────────────────────────────
const BREVET_QUESTIONS = {
  maths: [
    { topic: "Équations",    q: "Résoudre : 3x + 5 = 20",                                         choices: ["x = 3","x = 4","x = 5","x = 6"],                              a: "x = 5",                              hint: "Soustrais 5 des deux membres : 3x = 15, puis divise par 3" },
    { topic: "Pythagore",    q: "Hypoténuse d'un triangle rectangle avec les côtés 3 et 4 cm ?",  choices: ["4 cm","5 cm","6 cm","7 cm"],                                   a: "5 cm",                               hint: "c² = 3² + 4² = 9 + 16 = 25 → c = 5" },
    { topic: "Fractions",    q: "Calculer : 2/3 + 1/4",                                           choices: ["3/7","8/12","11/12","10/12"],                                  a: "11/12",                              hint: "LCD = 12 : 8/12 + 3/12 = 11/12" },
    { topic: "Pourcentages", q: "Un article coûte 80€ avec -15%. Prix final ?",                   choices: ["64€","68€","72€","76€"],                                       a: "68€",                                hint: "80 × (1 − 0.15) = 80 × 0.85 = 68" },
    { topic: "Géométrie",    q: "Aire d'un cercle de rayon 5 cm (π ≈ 3,14) ?",                   choices: ["≈ 65,5 cm²","≈ 78,5 cm²","≈ 88,5 cm²","≈ 95,5 cm²"],          a: "≈ 78,5 cm²",                        hint: "A = π × r² = 3.14 × 25 ≈ 78,5" },
    { topic: "Puissances",   q: "Calculer : 5² + 12²",                                            choices: ["144","169","196","225"],                                       a: "169",                                hint: "25 + 144 = 169 (triplet 5-12-13)" },
    { topic: "Volumes",      q: "Volume d'un cube de côté 4 cm ?",                                choices: ["16 cm³","32 cm³","48 cm³","64 cm³"],                           a: "64 cm³",                             hint: "V = côté³ = 4³ = 64" },
    { topic: "Équations",    q: "Résoudre : x² − 9 = 0",                                         choices: ["x = 3","x = ±3","x = ±9","x = 9"],                            a: "x = ±3",                             hint: "x² = 9 → x = ±√9 = ±3" },
    { topic: "Géométrie",    q: "Périmètre d'un rectangle 6 cm × 4 cm ?",                        choices: ["24 cm","20 cm","14 cm","48 cm"],                               a: "20 cm",                              hint: "P = 2 × (l + L) = 2 × 10 = 20" },
    { topic: "Pourcentages", q: "30% de 150 ?",                                                   choices: ["30","45","50","60"],                                           a: "45",                                 hint: "150 × 0.30 = 45" },
  ],
  francais: [
    { topic: "Figures de style", q: "« La vie est un long fleuve tranquille » — quelle figure ?", choices: ["Comparaison","Métaphore","Personnification","Hyperbole"],      a: "Métaphore",                          hint: "Comparaison SANS outil comparatif (sans comme / tel que)" },
    { topic: "Conjugaison",      q: "Subjonctif présent : « Il faut que tu __ (venir) »",         choices: ["viens","viennes","viendes","vient"],                           a: "viennes",                            hint: "Subjonctif présent irrégulier : que je vienne, que tu viennes" },
    { topic: "Grammaire",        q: "Nature de « rapidement » dans : « Il court rapidement » ?", choices: ["Adjectif","Nom","Adverbe de manière","Verbe"],                  a: "Adverbe de manière",                 hint: "Modifie le verbe, formé avec -ment à partir d'un adjectif" },
    { topic: "Grammaire",        q: "Subordonnée relative dans : « Le livre que j'ai lu est passionnant »", choices: ["Le livre","que j'ai lu","est passionnant","j'ai lu"], a: "que j'ai lu",                        hint: "Introduite par le pronom relatif « que »" },
    { topic: "Rhétorique",       q: "L'anaphore est :",                                           choices: ["Répétition en fin de vers","Répétition en début de phrase","Absence de ponctuation","Inversion sujet-verbe"], a: "Répétition en début de phrase", hint: "Du grec ana — ex : « I have a dream... I have a dream... »" },
    { topic: "Types de textes",  q: "But d'un texte argumentatif ?",                              choices: ["Raconter une histoire","Décrire un lieu","Convaincre le lecteur","Expliquer un phénomène"], a: "Convaincre le lecteur", hint: "Thèse + arguments + exemples + conclusion" },
    { topic: "Homophones",       q: "Compléter : « Elle __ parti tôt » (a/à) ?",                 choices: ["à","a","est","et"],                                            a: "a",                                  hint: "Auxiliaire avoir (a) ≠ préposition (à). Test : remplace par « avait »" },
    { topic: "Genres littéraires", q: "Le roman appartient à quel genre ?",                       choices: ["Poésie","Théâtre","Prose narrative","Essai"],                  a: "Prose narrative",                    hint: "Récit de fiction écrit en prose (pas en vers)" },
    { topic: "Vocabulaire",      q: "Que signifie « prolixe » ?",                                 choices: ["Silencieux","Bavard","Intelligent","Courageux"],               a: "Bavard",                             hint: "Du latin prolixus = qui parle beaucoup" },
    { topic: "Ponctuation",      q: "Que marque le point-virgule ?",                              choices: ["Fin de phrase","Pause courte","Séparation entre deux idées liées","Citation"], a: "Séparation entre deux idées liées", hint: "Plus fort qu'une virgule, moins fort qu'un point" },
  ],
  hg: [
    { topic: "Révolution",       q: "Date de la prise de la Bastille ?",                          choices: ["1789","1792","1814","1848"],                                   a: "1789",                               hint: "14 juillet 1789 — début de la Révolution française" },
    { topic: "Guerres mondiales",q: "Dates de la 1ère Guerre mondiale ?",                         choices: ["1870-1871","1914-1918","1939-1945","1905-1910"],               a: "1914-1918",                          hint: "Attentat de Sarajevo (1914) → armistice de Rethondes (1918)" },
    { topic: "Institutions",     q: "De Gaulle fonde quelle République en 1958 ?",                choices: ["IIIe République","IVe République","Ve République","VIe République"], a: "Ve République",              hint: "Constitution de 1958, régime semi-présidentiel encore en vigueur" },
    { topic: "Décolonisation",   q: "La décolonisation correspond à quelle période ?",            choices: ["1920-1940","1945-1975","1980-2000","1900-1920"],               a: "1945-1975",                          hint: "Après la 2e Guerre mondiale — indépendances en Asie puis en Afrique" },
    { topic: "Guerre froide",    q: "Date de la chute du mur de Berlin ?",                        choices: ["1987","1989","1991","1993"],                                   a: "1989",                               hint: "9 novembre 1989 — symbole de la fin de la Guerre froide" },
    { topic: "Géographie",       q: "Quel est le fleuve le plus long du monde ?",                 choices: ["L'Amazone","Le Nil","Le Yangtsé","Le Mississippi"],            a: "Le Nil",                             hint: "6 650 km — coule de l'Afrique subsaharienne vers la Méditerranée" },
    { topic: "Révolution",       q: "Qui condamne Louis XVI à mort en 1793 ?",                    choices: ["Napoléon","La Convention","Le Directoire","Le Sénat"],         a: "La Convention",                      hint: "21 janvier 1793 — condamné par la Convention nationale" },
    { topic: "Guerres mondiales",q: "Le Traité de Versailles (1919) met fin à :",                 choices: ["2e Guerre mondiale","Guerre de Crimée","1ère Guerre mondiale","Guerre d'Algérie"], a: "1ère Guerre mondiale", hint: "Signé le 28 juin 1919, imposé à l'Allemagne" },
    { topic: "Géographie",       q: "Quel continent est traversé par l'équateur ?",               choices: ["Europe","Asie","Afrique","Océanie"],                           a: "Afrique",                            hint: "L'équateur traverse l'Afrique en son milieu, de l'est à l'ouest" },
    { topic: "Institutions",     q: "Quelle institution représente directement les citoyens ?",   choices: ["Le Sénat","L'Assemblée nationale","Le Conseil d'État","La Cour des comptes"], a: "L'Assemblée nationale", hint: "577 députés élus au suffrage universel direct" },
  ],
  svt: [
    { topic: "Photosynthèse",    q: "Réactifs de la photosynthèse ?",                             choices: ["O₂ et glucose","CO₂ et H₂O","N₂ et H₂O","CO₂ et O₂"],       a: "CO₂ et H₂O",                        hint: "6CO₂ + 6H₂O + lumière → glucose + 6O₂" },
    { topic: "Génétique",        q: "Nombre de chromosomes dans une cellule humaine ?",           choices: ["23","46","48","92"],                                           a: "46",                                 hint: "23 paires dont les chromosomes sexuels XX ou XY" },
    { topic: "ADN",              q: "L'ADN se trouve principalement dans :",                      choices: ["Le cytoplasme","Le noyau","La membrane","Les mitochondries"],  a: "Le noyau",                           hint: "Acide DésoxyriboNucléique dans le noyau des cellules eucaryotes" },
    { topic: "Écologie",         q: "Définition d'un écosystème ?",                               choices: ["Animaux uniquement","Plantes uniquement","Êtres vivants + milieu physique","Chaîne alimentaire"], a: "Êtres vivants + milieu physique", hint: "Biocénose (vivants) + biotope (milieu) en interaction" },
    { topic: "Division cellulaire", q: "La mitose produit :",                                     choices: ["2 cellules identiques","4 cellules différentes","1 cellule","2 cellules différentes"], a: "2 cellules identiques", hint: "Division asexuée : 2 cellules filles avec même nb de chromosomes" },
    { topic: "Classification",   q: "Les mammifères sont des animaux :",                          choices: ["À sang froid","Ovipares","À sang chaud","Invertébrés"],        a: "À sang chaud",                       hint: "Homéothermes — maintiennent leur température corporelle constante" },
    { topic: "Photosynthèse",    q: "Où a lieu la photosynthèse dans la cellule ?",               choices: ["Mitochondrie","Noyau","Chloroplaste","Ribosome"],              a: "Chloroplaste",                       hint: "Organite contenant la chlorophylle, pigment vert absorbant la lumière" },
    { topic: "Évolution",        q: "Qui propose la sélection naturelle en 1859 ?",               choices: ["Pasteur","Darwin","Mendel","Lamarck"],                         a: "Darwin",                             hint: "Charles Darwin, « De l'origine des espèces », 1859" },
    { topic: "Génétique",        q: "Un gène code pour :",                                        choices: ["Un chromosome","Une protéine","Un noyau","Une cellule"],      a: "Une protéine",                       hint: "ADN → ARNm → protéine (dogme central de la biologie)" },
    { topic: "Reproduction",     q: "La méiose produit :",                                        choices: ["2 cellules à 46 chr.","4 cellules à 23 chr.","2 cellules à 23 chr.","4 cellules à 46 chr."], a: "4 cellules à 23 chr.", hint: "Produit des gamètes (spermatozoïdes / ovules)" },
  ],
  physique: [
    { topic: "Électricité",      q: "Loi d'Ohm — relation entre U, I et R ?",                    choices: ["U = I + R","U = R / I","U = R × I","I = U × R"],               a: "U = R × I",                          hint: "Tension (V) = Résistance (Ω) × Intensité (A)" },
    { topic: "Optique",          q: "Vitesse de la lumière dans le vide ?",                       choices: ["3 × 10⁶ m/s","3 × 10⁸ m/s","3 × 10¹⁰ m/s","3 × 10⁴ m/s"],  a: "3 × 10⁸ m/s",                       hint: "c ≈ 300 000 km/s — constante fondamentale" },
    { topic: "Structure matière",q: "Composition d'un atome ?",                                   choices: ["Protons seulement","Protons + neutrons + électrons","Neutrons + électrons","Protons + électrons"], a: "Protons + neutrons + électrons", hint: "Noyau (protons Z + neutrons) + nuage d'électrons" },
    { topic: "Chimie",           q: "Formule chimique de l'eau ?",                                choices: ["HO","H₂O","H₂O₂","HO₂"],                                      a: "H₂O",                                hint: "2 atomes d'hydrogène + 1 atome d'oxygène" },
    { topic: "Thermodynamique",  q: "Loi de conservation de l'énergie ?",                        choices: ["L'énergie se crée","L'énergie se détruit","L'énergie se transforme sans se perdre","L'énergie diminue"], a: "L'énergie se transforme sans se perdre", hint: "1er principe : énergie totale d'un système isolé = constante" },
    { topic: "Mécanique",        q: "Unité de la force dans le SI ?",                             choices: ["Joule","Pascal","Newton","Watt"],                               a: "Newton",                             hint: "N = kg·m/s² — hommage à Isaac Newton" },
    { topic: "Électricité",      q: "Unité de la résistance électrique ?",                        choices: ["Ampère","Volt","Ohm","Watt"],                                  a: "Ohm",                                hint: "Ω (oméga) — hommage à Georg Simon Ohm" },
    { topic: "Optique",          q: "Un miroir plan forme une image :",                           choices: ["Réelle et droite","Virtuelle et droite","Réelle et inversée","Virtuelle et inversée"], a: "Virtuelle et droite", hint: "Symétrique à l'objet par rapport au miroir" },
    { topic: "Chimie",           q: "pH d'une solution neutre ?",                                 choices: ["0","7","10","14"],                                             a: "7",                                  hint: "pH < 7 acide, pH = 7 neutre, pH > 7 basique" },
    { topic: "Mécanique",        q: "Unité de l'énergie dans le SI ?",                            choices: ["Newton","Watt","Joule","Pascal"],                              a: "Joule",                              hint: "J = N·m = kg·m²/s²" },
  ],
};

function StructuredExamPanel({ subjectId, subjectLabel, onClose, addXP, unlockBadge, isPaid, setScreen }) {
  const { currentUser } = useApp();
  const isBac = currentUser?.classe === "terminale" || currentUser?.classe === "superieur";
  const examMode = isBac ? "Simulation BAC" : "Simulation Brevet";
  const allQs = BREVET_QUESTIONS[subjectId] || BREVET_QUESTIONS.maths;
  const questions = useMemo(() => allQs.slice(0, isPaid ? Math.min(allQs.length, 10) : 5), [subjectId, isPaid]);
  const duration = isPaid ? 25 * 60 : 15 * 60;

  const [phase, setPhase]       = useState("entry");
  const [current, setCurrent]   = useState(0);
  const [answers, setAnswers]   = useState({});
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(duration);
  const timerRef = useRef(null);

  useEffect(() => {
    if (phase !== "exam") return;
    timerRef.current = setInterval(() => setTimeLeft(t => {
      if (t <= 1) { clearInterval(timerRef.current); setPhase("result"); return 0; }
      return t - 1;
    }), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const handleAnswer = (choice) => {
    if (feedback) return;
    const correct = questions[current].a === choice;
    setAnswers(a => ({ ...a, [current]: choice }));
    setFeedback(correct ? "correct" : "wrong");
    setTimeout(() => {
      setFeedback(null);
      if (current < questions.length - 1) setCurrent(i => i + 1);
      else { clearInterval(timerRef.current); setPhase("result"); }
    }, 900);
  };

  const retry = () => { setCurrent(0); setAnswers({}); setFeedback(null); setTimeLeft(duration); setPhase("exam"); };

  if (phase === "entry") return (
    <ExamEntryScreen icon="📝" subjectLabel={subjectLabel} mode={examMode}
      questionCount={questions.length} durationMin={isPaid ? 25 : 15}
      isPaid={isPaid} freeCount={5} premiumCount={10}
      onStart={() => setPhase("exam")} onClose={onClose} setScreen={setScreen} />
  );

  if (phase === "result") {
    const correctCount = questions.filter((q, i) => answers[i] === q.a).length;
    const wrongItems = questions
      .map((q, i) => ({ idx: i, qText: q.q, correct: q.a, userAnswer: answers[i] || null, hint: q.hint, topic: q.topic }))
      .filter(x => x.userAnswer !== x.correct);
    return (
      <ExamResultScreen correctCount={correctCount} totalCount={questions.length}
        wrongItems={wrongItems} isPaid={isPaid} setScreen={setScreen}
        addXP={addXP} unlockBadge={unlockBadge} onRetry={retry} onClose={onClose} />
    );
  }

  const q = questions[current];
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");
  const timerPct = (timeLeft / duration) * 100;
  const timerColor = timerPct > 50 ? "var(--success)" : timerPct > 20 ? "var(--warn)" : "var(--danger)";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
          {subjectLabel} · <strong style={{ color: "var(--text)" }}>{current + 1} / {questions.length}</strong>
        </div>
        <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 20, color: timerColor }}>{mins}:{secs}</div>
      </div>
      <ProgressBar value={current + 1} max={questions.length} color="var(--accent)" />

      <div style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 20px", margin: "16px 0" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
          {q.topic} · Question {current + 1}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", lineHeight: 1.6 }}>{q.q}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {q.choices.map((choice, i) => {
          const letter = ["A","B","C","D"][i];
          const selected = answers[current] === choice;
          const isCorrect = choice === q.a;
          let bg = "var(--card2)", bdr = "1.5px solid var(--border)";
          if (feedback && selected) {
            bg = feedback === "correct" ? "rgba(16,185,129,0.12)" : "rgba(220,38,38,0.10)";
            bdr = `1.5px solid ${feedback === "correct" ? "var(--success)" : "var(--danger)"}`;
          }
          if (feedback === "wrong" && isCorrect) { bg = "rgba(16,185,129,0.08)"; bdr = "1.5px solid var(--success)"; }
          return (
            <button key={choice} onClick={() => handleAnswer(choice)} disabled={!!feedback}
              style={{ background: bg, border: bdr, borderRadius: 13, padding: "13px 16px", textAlign: "left", cursor: feedback ? "default" : "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s" }}>
              <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0, color: "var(--text-muted)" }}>{letter}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{choice}</span>
            </button>
          );
        })}
      </div>

      {/* Question navigator */}
      <div style={{ display: "flex", gap: 5, marginTop: 14, flexWrap: "wrap" }}>
        {questions.map((_, i) => (
          <button key={i} onClick={() => { if (!feedback) setCurrent(i); }}
            style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${i === current ? "var(--accent)" : answers[i] ? (answers[i] === questions[i].a ? "var(--success)" : "var(--danger)") : "var(--border)"}`, background: i === current ? "var(--accent-soft)" : answers[i] ? (answers[i] === questions[i].a ? "rgba(16,185,129,0.08)" : "rgba(220,38,38,0.06)") : "transparent", color: i === current ? "var(--accent)" : "var(--text-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
