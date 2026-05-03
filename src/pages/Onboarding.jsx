// ─── src/pages/Onboarding.jsx ─────────────────────────────────────────────────
// Profile onboarding: level → languages → [specialties for lycée] → sport → grades
// Triggered once after signup when no profile exists.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { CLASSES } from "../data/constants.js";
import { LANGUAGE_OPTIONS, generateSubjects } from "../services/subjectGenerator.js";
import { Logo, Btn } from "../components/SharedUI.jsx";

const COLLEGE_CLASSES = ["6e", "5e", "4e", "3e"];
const LYCEE_CLASSES   = ["2nde", "1ere", "terminale"];

// SNT is mandatory for 2nde (auto-added by generateSubjects) — not a selectable specialty
const LYCEE_SPECIALTIES = [
  { id: "ses", label: "SES — Sciences Éco. et Sociales", icon: "📊", levels: ["2nde","1ere","terminale"] },
];

export default function Onboarding() {
  const { currentUser, saveProfile, setScreen, updateUser, activeProfileId } = useApp();

  const [step,        setStep]        = useState(1);
  const [level,       setLevel]       = useState(currentUser?.classe || "3e");
  const [languages,   setLanguages]   = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [hasSport,    setHasSport]    = useState(false);
  const [grades,      setGrades]      = useState({});

  const isCollege    = COLLEGE_CLASSES.includes(level);
  const isLycee      = LYCEE_CLASSES.includes(level);
  const totalSteps   = isLycee ? 5 : 4;

  // Recompute after level changes
  const subjects  = generateSubjects({ level, languages, hasSport, specialties });
  const gradeable = subjects.filter(s => !s.noAI && s.id !== "general" && s.id !== "bac");

  const availableSpecialties = LYCEE_SPECIALTIES.filter(s => s.levels.includes(level));

  const toggleLanguage = (id) => {
    setLanguages(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);
  };

  const toggleSpecialty = (id) => {
    setSpecialties(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const setGrade = (id, val) => {
    setGrades(prev => ({ ...prev, [id]: val }));
  };

  // Step routing — lycée has an extra specialties step (step 3)
  const nextStep = () => {
    if (step === 2 && isLycee) { setStep(3); return; }   // languages → specialties
    if (step === 2 && isCollege) { setStep(3); return; }  // languages → sport (step 3 for both but step 3 = sport for college)
    setStep(s => s + 1);
  };
  const prevStep = () => {
    if (step === 3 && isLycee) { setStep(2); return; }   // specialties → languages
    if (step === 4 && isLycee) { setStep(3); return; }   // sport → specialties
    setStep(s => s - 1);
  };

  // Step numbers relative to UI labels
  // College:  1=level, 2=languages, 3=sport, 4=grades
  // Lycée:    1=level, 2=languages, 3=specialties, 4=sport, 5=grades
  const isSportStep  = isLycee ? step === 4 : step === 3;
  const isGradesStep = isLycee ? step === 5 : step === 4;

  const finish = (skip = false) => {
    saveProfile({ level, languages, specialties, hasSport, grades: skip ? {} : grades });
    if (!activeProfileId) updateUser({ onboardingDone: true });
    setScreen("chat");
  };

  const progress = (step / totalSteps) * 100;

  return (
    <div className="sai-full-height" style={{ background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Logo />
          <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
            Configuration rapide — étape {step} sur {totalSteps}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: "var(--border)", borderRadius: 4, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,var(--accent),var(--accent2))", transition: "width 0.4s ease", borderRadius: 4 }} />
        </div>

        {/* Card */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, padding: "28px 24px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>

          {/* ── STEP 1 : Level ───────────────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 24, marginBottom: 6, textAlign: "center" }}>🎓</div>
              <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 20, color: "var(--text)", textAlign: "center", marginBottom: 6 }}>Tu es en quelle classe ?</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginBottom: 22 }}>L'IA adaptera ses explications à ton niveau exactement</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {CLASSES.filter(c => c.v !== "prof").map(c => (
                  <button key={c.v} onClick={() => setLevel(c.v)}
                    style={{ padding: "12px 16px", borderRadius: 14, border: `2px solid ${level === c.v ? "var(--accent)" : "var(--border)"}`, background: level === c.v ? "var(--accent-soft)" : "transparent", color: level === c.v ? "var(--accent)" : "var(--text-soft)", fontWeight: level === c.v ? 700 : 500, fontSize: 14, cursor: "pointer", textAlign: "left", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>{c.l}</span>
                    {level === c.v && <span style={{ fontSize: 16 }}>✓</span>}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 20 }}>
                <Btn primary full onClick={() => setStep(2)}>Continuer →</Btn>
              </div>
            </div>
          )}

          {/* ── STEP 2 : Languages ───────────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 24, marginBottom: 6, textAlign: "center" }}>🌍</div>
              <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 20, color: "var(--text)", textAlign: "center", marginBottom: 6 }}>Quelle(s) langue(s) étudies-tu ?</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginBottom: 22 }}>En plus de l'anglais (déjà inclus)</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
                {LANGUAGE_OPTIONS.map(lang => (
                  <button key={lang.id} onClick={() => toggleLanguage(lang.id)}
                    style={{ padding: "14px 16px", borderRadius: 14, border: `2px solid ${languages.includes(lang.id) ? "var(--accent)" : "var(--border)"}`, background: languages.includes(lang.id) ? "var(--accent-soft)" : "transparent", color: languages.includes(lang.id) ? "var(--accent)" : "var(--text-soft)", fontWeight: languages.includes(lang.id) ? 700 : 500, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s" }}>
                    <span style={{ fontSize: 22 }}>{lang.icon}</span>
                    <span style={{ flex: 1, textAlign: "left" }}>{lang.label}</span>
                    {languages.includes(lang.id) && <span style={{ fontSize: 16 }}>✓</span>}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginBottom: 16 }}>Aucune sélection si tu n'étudies qu'anglais</div>

              <div style={{ display: "flex", gap: 10 }}>
                <Btn ghost onClick={() => setStep(1)}>← Retour</Btn>
                <Btn primary full onClick={nextStep}>Continuer →</Btn>
              </div>
            </div>
          )}

          {/* ── STEP 3 (lycée only) : Specialties ───────────────────────────── */}
          {step === 3 && isLycee && (
            <div>
              <div style={{ fontSize: 24, marginBottom: 6, textAlign: "center" }}>🗂️</div>
              <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 20, color: "var(--text)", textAlign: "center", marginBottom: 6 }}>Tes matières spéciales</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginBottom: 22 }}>Coche les matières supplémentaires que tu étudies</div>

              {availableSpecialties.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "20px 0" }}>
                  Aucune matière spéciale pour ton niveau.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  {availableSpecialties.map(sp => (
                    <button key={sp.id} onClick={() => toggleSpecialty(sp.id)}
                      style={{ padding: "14px 16px", borderRadius: 14, border: `2px solid ${specialties.includes(sp.id) ? "var(--accent)" : "var(--border)"}`, background: specialties.includes(sp.id) ? "var(--accent-soft)" : "transparent", color: specialties.includes(sp.id) ? "var(--accent)" : "var(--text-soft)", fontWeight: specialties.includes(sp.id) ? 700 : 500, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s" }}>
                      <span style={{ fontSize: 22 }}>{sp.icon}</span>
                      <span style={{ flex: 1, textAlign: "left" }}>{sp.label}</span>
                      {specialties.includes(sp.id) && <span style={{ fontSize: 16 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}

              {level === "2nde" && (
                <div style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>💡</span><span>SNT est déjà inclus automatiquement pour la 2nde</span>
                </div>
              )}
              <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginBottom: 16 }}>Ces matières supplémentaires s'ajouteront à ton profil</div>

              <div style={{ display: "flex", gap: 10 }}>
                <Btn ghost onClick={() => setStep(2)}>← Retour</Btn>
                <Btn primary full onClick={() => setStep(4)}>Continuer →</Btn>
              </div>
            </div>
          )}

          {/* ── SPORT STEP (step 3 for college, step 4 for lycée) ────────────── */}
          {isSportStep && (
            <div>
              <div style={{ fontSize: 24, marginBottom: 6, textAlign: "center" }}>⚽</div>
              <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 20, color: "var(--text)", textAlign: "center", marginBottom: 6 }}>Tu as sport au programme ?</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginBottom: 24 }}>Pour suivre ta note d'EPS (pas de cours IA)</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {[{ v: true, icon: "✅", label: "Oui, je fais du sport" }, { v: false, icon: "❌", label: "Non, pas de sport" }].map(opt => (
                  <button key={String(opt.v)} onClick={() => setHasSport(opt.v)}
                    style={{ padding: "18px 14px", borderRadius: 16, border: `2px solid ${hasSport === opt.v ? "var(--accent)" : "var(--border)"}`, background: hasSport === opt.v ? "var(--accent-soft)" : "transparent", color: hasSport === opt.v ? "var(--accent)" : "var(--text-soft)", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all 0.15s" }}>
                    <span style={{ fontSize: 24 }}>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <Btn ghost onClick={prevStep}>← Retour</Btn>
                <Btn primary full onClick={() => setStep(isLycee ? 5 : 4)}>Continuer →</Btn>
              </div>
            </div>
          )}

          {/* ── GRADES STEP (step 4 for college, step 5 for lycée) ───────────── */}
          {isGradesStep && (
            <div>
              <div style={{ fontSize: 24, marginBottom: 6, textAlign: "center" }}>📊</div>
              <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 20, color: "var(--text)", textAlign: "center", marginBottom: 6 }}>Tes moyennes actuelles</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginBottom: 20 }}>Optionnel — l'IA s'adapte à tes points forts et faibles</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, maxHeight: 260, overflowY: "auto" }}>
                {gradeable.map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--card2)", borderRadius: 12, padding: "10px 14px" }}>
                    <span style={{ fontSize: 18, width: 26, textAlign: "center" }}>{s.icon}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="number" min="0" max="20" step="0.5"
                        placeholder="—"
                        value={grades[s.id] ?? ""}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          if (e.target.value === "") setGrade(s.id, undefined);
                          else if (!isNaN(v) && v >= 0 && v <= 20) setGrade(s.id, v);
                        }}
                        style={{ width: 56, background: "var(--card)", border: `1.5px solid ${grades[s.id] !== undefined ? "var(--accent)" : "var(--border)"}`, borderRadius: 10, padding: "6px 8px", fontSize: 13, color: "var(--text)", textAlign: "center" }}
                      />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/20</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn ghost onClick={prevStep}>← Retour</Btn>
                <button onClick={() => finish(true)}
                  style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: "8px 12px" }}>
                  Passer
                </button>
                <Btn primary full onClick={() => finish(false)}>Commencer ! 🚀</Btn>
              </div>
            </div>
          )}
        </div>

        {/* Skip all */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => finish(true)}
            style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
            Configurer plus tard →
          </button>
        </div>
      </div>
    </div>
  );
}
