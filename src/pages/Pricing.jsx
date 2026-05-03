// ─── src/pages/Pricing.jsx ───────────────────────────────────────────────────
import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { Logo, Btn, Select } from "../components/SharedUI.jsx";
import { CLASSES } from "../data/constants.js";

// ─── Pricing ──────────────────────────────────────────────────────────────────
export function Pricing() {
  const { setScreen, currentUser, updateUser } = useApp();

  const plans = [
    {
      id: "free", name: "Gratuit", price: "0€", period: "", color: "#6366f1",
      features: ["20 questions / jour", "4 photos / jour", "Flashcards", "Mode Examen", "Mode sombre"],
      cta: "Continuer gratuitement",
    },
    {
      id: "premium", name: "Premium", price: "6,99€", period: "/mois", color: "#f59e0b", popular: true, badge: "✦ Plus populaire",
      features: ["Questions illimitées", "Photos illimitées", "Plan de révision IA", "Génération d'exercices", "XP x1.5", "Support prioritaire"],
      cta: "Activer Premium",
    },
    {
      id: "famille", name: "Famille", price: "9,99€", period: "/mois", color: "#10b981",
      features: ["Jusqu'à 5 profils", "Tout Premium pour chaque profil", "Tableau de bord famille", "Suivi des enfants"],
      cta: "Activer Famille",
    },
  ];

  const apply = (planId) => {
    if (currentUser) updateUser({ plan: planId });
    setScreen(currentUser ? "chat" : "auth");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
        <Logo />
        <button onClick={() => setScreen(currentUser ? "chat" : "landing")} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>← Retour</button>
      </div>
      <div style={{ textAlign: "center", padding: "48px 20px 28px" }}>
        <h1 style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 30, color: "var(--text)", marginBottom: 10, letterSpacing: "-0.6px" }}>Choisis ton plan</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>Change de plan à tout moment depuis tes paramètres</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, padding: "0 14px 40px", maxWidth: 920, margin: "0 auto" }}>
        {plans.map((plan) => {
          const active = (currentUser?.plan || "free") === plan.id;
          return (
            <div key={plan.id} style={{ background: "var(--card)", border: `${active ? "2.5px solid var(--accent)" : plan.popular ? "2px solid rgba(99,102,241,0.4)" : "1.5px solid var(--border)"}`, borderRadius: 24, padding: "30px 24px", position: "relative", display: "flex", flexDirection: "column", gap: 16, boxShadow: active ? "0 8px 40px var(--accent-glow)" : "none" }}>
              {plan.popular && !active && <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,var(--accent),var(--accent2))", color: "#fff", padding: "4px 18px", borderRadius: 20, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>{plan.badge}</div>}
              {active && <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "var(--success)", color: "#fff", padding: "4px 18px", borderRadius: 20, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>✓ Plan actuel</div>}
              <div style={{ fontWeight: 800, fontSize: 19, color: plan.color }}>{plan.name}</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "var(--text)", fontFamily: "Space Grotesk,sans-serif" }}>
                {plan.price}<span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted)" }}>{plan.period}</span>
              </div>
              <div style={{ height: 1, background: "var(--border)" }} />
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                {plan.features.map((f, j) => <li key={j} style={{ fontSize: 13, color: "var(--text-soft)", display: "flex", gap: 8 }}><span style={{ color: plan.color, fontWeight: 700 }}>✓</span>{f}</li>)}
              </ul>
              <button
                onClick={() => apply(plan.id)}
                disabled={active}
                style={{ padding: "13px", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: active ? "default" : "pointer", background: active ? "var(--card2)" : plan.popular ? "linear-gradient(135deg,var(--accent),var(--accent2))" : "transparent", color: active ? "var(--text-muted)" : plan.popular ? "#fff" : plan.color, border: active ? "1.5px solid var(--border)" : plan.popular ? "none" : `2px solid ${plan.color}`, opacity: active ? 0.7 : 1, transition: "all 0.2s" }}>
                {active ? "✓ Actif" : plan.cta}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export function Settings() {
  const { currentUser, updateUser, dark, setDark, logout, setScreen, effectiveProfile, activeSubjects, updateProfileGrade } = useApp();
  const isMobile = window.innerWidth < 900;
  const BAD = ["merde", "putain", "connard", "salope", "bite", "couille"];

  const [aiName,       setAiName]       = useState(currentUser?.aiName || "Study AI");
  const [savedAI,      setSavedAI]      = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName,     setEditName]     = useState(currentUser?.name || "");
  const [editClasse,   setEditClasse]   = useState(currentUser?.classe || "");
  const [savedProfile, setSavedProfile] = useState(false);

  const [notifs, setNotifs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sai_notifs") || "null") || { daily: true, tips: false, weekly: false }; }
    catch { return { daily: true, tips: false, weekly: false }; }
  });
  const updateNotif = (key) => {
    const n = { ...notifs, [key]: !notifs[key] };
    setNotifs(n);
    localStorage.setItem("sai_notifs", JSON.stringify(n));
  };

  const saveAI = () => {
    const n = aiName.trim();
    if (!n) return;
    if (BAD.some(w => n.toLowerCase().includes(w))) { alert("Nom inapproprié 😊 Choisis un autre !"); return; }
    updateUser({ aiName: n });
    setSavedAI(true); setTimeout(() => setSavedAI(false), 2000);
  };

  const saveProfile = () => {
    if (!editName.trim()) return;
    const cls = CLASSES.find(c => c.v === editClasse);
    updateUser({ name: editName.trim(), classe: editClasse, age: cls?.age || currentUser?.age, role: editClasse === "prof" ? "prof" : "eleve" });
    setEditingProfile(false); setSavedProfile(true); setTimeout(() => setSavedProfile(false), 2000);
  };

  const Toggle = ({ on, onClick, label, sub }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={onClick} style={{ width: 46, height: 25, borderRadius: 13, background: on ? "var(--accent)" : "var(--border)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 3, left: on ? 24 : 3, width: 19, height: 19, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
      </button>
    </div>
  );

  // Plan data
  const PLANS = [
    { id: "free",    label: "🆓 Gratuit",  color: "#6366f1", sub: "20 questions/jour · 4 photos/jour" },
    { id: "premium", label: "✦ Premium",   color: "#f59e0b", sub: "Questions illimitées · XP x1.5 · Toutes les fonctionnalités" },
    { id: "famille", label: "👨‍👩‍👧 Famille", color: "#10b981", sub: "Jusqu'à 5 profils · Tableau de bord famille" },
  ];
  const currentPlan = currentUser?.plan || "free";

  const sections = [
    // ── PROFIL ────────────────────────────────────────────────────────────────
    {
      title: "👤 Profil", content: currentUser && (
        <div>
          {!editingProfile ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: "40%", background: "linear-gradient(135deg,var(--accent),var(--accent2))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 22, boxShadow: "0 4px 16px var(--accent-glow)", flexShrink: 0 }}>
                  {currentUser.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 16 }}>{currentUser.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{currentUser.email}</div>
                  <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, marginTop: 2 }}>
                    {currentUser.classe === "prof" ? "Professeur" : `Classe : ${currentUser.classe}`}
                    {currentUser.matierePref && <span style={{ marginLeft: 6 }}>· {activeSubjects.find(s => s.id === currentUser.matierePref)?.label}</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => setEditingProfile(true)} style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 12px", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", cursor: "pointer", flexShrink: 0 }}>
                ✏️ Modifier
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-soft)", marginBottom: 5 }}>Prénom</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={30}
                    style={{ width: "100%", background: "var(--card2)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 14, color: "var(--text)", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-soft)", marginBottom: 5 }}>Classe</label>
                  <Select value={editClasse} onChange={e => setEditClasse(e.target.value)}>
                    {CLASSES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                  </Select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn primary onClick={saveProfile}>Sauvegarder</Btn>
                <Btn ghost onClick={() => { setEditingProfile(false); setEditName(currentUser.name || ""); setEditClasse(currentUser.classe || ""); }}>Annuler</Btn>
              </div>
            </div>
          )}
          {savedProfile && <div style={{ fontSize: 13, color: "var(--success)", fontWeight: 700, marginTop: 8 }}>✅ Profil mis à jour !</div>}
        </div>
      )
    },

    // ── PLAN ─────────────────────────────────────────────────────────────────
    {
      title: "💎 Plan", content: (
        <div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
            Ton plan actuel. Change-le pour tester toutes les fonctionnalités.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PLANS.map(p => {
              const active = currentPlan === p.id;
              return (
                <button key={p.id} onClick={() => !active && updateUser({ plan: p.id })}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 14, border: active ? `2px solid ${p.color}` : "1.5px solid var(--border)", background: active ? `${p.color}18` : "var(--card2)", cursor: active ? "default" : "pointer", transition: "all 0.18s", textAlign: "left" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: active ? p.color : "var(--text)" }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{p.sub}</div>
                  </div>
                  {active && <span style={{ fontSize: 12, fontWeight: 700, color: p.color, background: `${p.color}22`, border: `1px solid ${p.color}44`, borderRadius: 20, padding: "3px 10px", flexShrink: 0 }}>✓ Actif</span>}
                </button>
              );
            })}
          </div>
        </div>
      )
    },

    // ── NOM DE L'IA ───────────────────────────────────────────────────────────
    {
      title: "🤖 Nom de l'IA", content: (
        <div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>Personnalise le nom de ton assistant. Pas de mots inappropriés 😊</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ flex: 1, background: "var(--card2)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "11px 14px", fontSize: 14, color: "var(--text)" }} placeholder="Study AI, Mentor, Prof..." value={aiName} onChange={e => setAiName(e.target.value)} maxLength={20} onKeyDown={e => e.key === "Enter" && saveAI()} />
            <Btn primary onClick={saveAI}>{savedAI ? "✅ Sauvé !" : "Sauvegarder"}</Btn>
          </div>
        </div>
      )
    },

    // ── MES NOTES ─────────────────────────────────────────────────────────────
    {
      title: "📊 Mes notes", content: currentUser && (() => {
        const grades = effectiveProfile?.grades || {};
        const gradeable = activeSubjects.filter(s => s.id !== "general" && !s.noAI);
        return (
          <div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
              Tes moyennes — utilisées pour personnaliser l'IA et tes statistiques.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {gradeable.map(s => {
                const grade = grades[s.id];
                const c = grade !== undefined ? grade >= 14 ? "var(--success)" : grade >= 10 ? "var(--warn)" : "var(--danger)" : "var(--border)";
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--card2)", borderRadius: 14, padding: "10px 14px" }}>
                    <span style={{ fontSize: 18, width: 26, textAlign: "center" }}>{s.icon}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="number" min="0" max="20" step="0.5" placeholder="—" value={grade ?? ""}
                        onChange={e => { const v = e.target.value; if (v === "") { updateProfileGrade(s.id, undefined); return; } const n = parseFloat(v); if (!isNaN(n) && n >= 0 && n <= 20) updateProfileGrade(s.id, n); }}
                        style={{ width: 56, background: "var(--card)", border: `1.5px solid ${c}`, borderRadius: 10, padding: "6px 8px", fontSize: 13, color: "var(--text)", textAlign: "center" }} />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/20</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>Les modifications sont enregistrées automatiquement.</p>
          </div>
        );
      })()
    },

    // ── PRÉFÉRENCES ───────────────────────────────────────────────────────────
    {
      title: "⚙️ Préférences", content: (
        <div>
          <Toggle on={dark} onClick={() => setDark(!dark)} label="Mode sombre" sub="Interface en couleurs sombres" />
          <div style={{ paddingTop: 10 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-soft)", marginBottom: 8 }}>Matière par défaut</label>
            <Select value={currentUser?.matierePref || ""} onChange={e => updateUser({ matierePref: e.target.value || undefined })}>
              <option value="">Toutes les matières</option>
              {activeSubjects.filter(s => s.id !== "general" && !s.noAI).map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
            </Select>
          </div>
        </div>
      )
    },

    // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
    {
      title: "🔔 Notifications", content: (
        <div>
          <Toggle on={notifs.daily}  onClick={() => updateNotif("daily")}  label="Défi du jour"        sub="Rappel quotidien pour relever le défi du jour" />
          <Toggle on={notifs.tips}   onClick={() => updateNotif("tips")}   label="Conseils de révision" sub="Astuces personnalisées selon tes résultats" />
          <Toggle on={notifs.weekly} onClick={() => updateNotif("weekly")} label="Rapport hebdomadaire" sub="Résumé de ta progression chaque semaine" />
        </div>
      )
    },

    // ── ZONE DANGER ───────────────────────────────────────────────────────────
    { title: "⚠️ Zone danger", danger: true, content: <Btn danger onClick={logout}>🚪 Se déconnecter</Btn> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
        <Logo />
        <button onClick={() => setScreen("chat")} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>← Retour au chat</button>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: isMobile ? "20px 14px 40px" : "36px 20px" }}>
        <h1 style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: isMobile ? 22 : 26, color: "var(--text)", marginBottom: 22, letterSpacing: "-0.4px" }}>⚙️ Paramètres</h1>
        {sections.map((sec, i) => (
          <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: isMobile ? "16px" : "22px", marginBottom: 10 }}>
            <h3 style={{ fontWeight: 800, fontSize: 15, color: sec.danger ? "var(--danger)" : "var(--text)", marginBottom: 14 }}>{sec.title}</h3>
            {sec.content}
          </div>
        ))}
      </div>
    </div>
  );
}
