// ─── src/pages/Auth.jsx ───────────────────────────────────────────────────────
import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { register, login } from "../services/auth.js";
import { CLASSES, SUBJECTS } from "../data/constants.js";
import { Logo, Btn, ErrBox, Field, Input, Select } from "../components/SharedUI.jsx";

export default function Auth() {
  const { authMode, setAuthMode, login: ctxLogin, setScreen } = useApp();
  const isLogin = authMode === "login";

  const [step,           setStep]           = useState("form");
  const [form,           setForm]           = useState({ name:"", email:"", pwd:"", pwd2:"", classe:"", matiere:"", note:"" });
  const [err,            setErr]            = useState("");
  const [loading,        setLoading]        = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = () => {
    setErr("");
    if (!form.email.includes("@") || !form.email.includes(".")) { setErr("Email invalide."); return; }
    if (form.pwd.length < 6) { setErr("Mot de passe : 6 caractères min."); return; }
    if (!isLogin) {
      if (!form.name.trim())      { setErr("Prénom requis."); return; }
      if (form.pwd !== form.pwd2) { setErr("Les mots de passe ne correspondent pas."); return; }
      if (!form.classe)           { setErr("Choisis ta classe."); return; }
    }
    setLoading(true);
    try {
      if (isLogin) {
        const user = login(form.email, form.pwd);
        ctxLogin(user);
      } else {
        const user = register({
          name:         form.name,
          email:        form.email,
          password:     form.pwd,
          classe:       form.classe,
          matiere:      form.matiere      || undefined,
          noteActuelle: form.note         || undefined,
        });
        setRegisteredUser(user);
        setStep("plan");
      }
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20, background:"var(--bg)" }}>
      <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:28, padding:"40px 34px", width:"100%", maxWidth:430, boxShadow:"0 24px 80px rgba(0,0,0,0.1)" }}>
        <button onClick={() => setScreen("landing")} style={{ background:"transparent", border:"none", color:"var(--text-muted)", fontSize:13, fontWeight:600, marginBottom:22, cursor:"pointer", padding:0 }}>← Retour</button>
        <Logo />
        <h2 style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:800, fontSize:24, color:"var(--text)", margin:"20px 0 4px", letterSpacing:"-0.4px" }}>
          {step === "form" ? (isLogin ? "Bon retour 👋" : "Créer un compte 🚀") : `Bienvenue ${registeredUser?.name?.split(" ")[0]} 🎉`}
        </h2>
        <p style={{ color:"var(--text-muted)", fontSize:14, marginBottom:26 }}>
          {step === "form" ? (isLogin ? "Connexion à ton compte StudyAI" : "Gratuit · Aucune CB requise") : "Ton compte est prêt. Quel accès veux-tu ?"}
        </p>

        {step === "form" ? (
          <>
            {!isLogin && <Field label="Prénom"><Input placeholder="Ton prénom" value={form.name} onChange={set("name")} /></Field>}
            <Field label="Email"><Input type="email" placeholder="ton@email.com" value={form.email} onChange={set("email")} /></Field>
            <Field label="Mot de passe"><Input type="password" placeholder="6 caractères minimum" value={form.pwd} onChange={set("pwd")} onKeyDown={e => e.key === "Enter" && handleSubmit()} /></Field>
            {!isLogin && (
              <>
                <Field label="Confirmer le mot de passe"><Input type="password" placeholder="••••••••" value={form.pwd2} onChange={set("pwd2")} /></Field>
                <Field label="Ta classe">
                  <Select value={form.classe} onChange={set("classe")} placeholder="-- Choisis ta classe --">
                    {CLASSES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                  </Select>
                </Field>
                <div style={{ background:"var(--card2)", border:"1px solid var(--border)", borderRadius:14, padding:"14px 16px", marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--text-muted)", marginBottom:10, textTransform:"uppercase", letterSpacing:0.6 }}>
                    Optionnel — pour personnaliser ton expérience
                  </div>
                  <Field label="Ta matière préférée">
                    <Select value={form.matiere} onChange={set("matiere")} placeholder="-- Choisis (facultatif) --">
                      {SUBJECTS.filter(s => s.id !== "general").map(s => (
                        <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Ta note actuelle dans cette matière (facultatif)">
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <input type="number" min="0" max="20" step="0.5" placeholder="Ex : 12" value={form.note} onChange={set("note")}
                        style={{ flex:1, background:"var(--card)", border:"1.5px solid var(--border)", borderRadius:12, padding:"11px 14px", fontSize:14, color:"var(--text)", boxSizing:"border-box" }} />
                      <span style={{ fontSize:14, color:"var(--text-muted)", fontWeight:600 }}>/20</span>
                    </div>
                  </Field>
                </div>
              </>
            )}
            <ErrBox msg={err} />
            <Btn primary full large loading={loading} onClick={handleSubmit}>
              {isLogin ? "Se connecter" : "Créer mon compte"}
            </Btn>
            <div style={{ textAlign:"center", fontSize:14, color:"var(--text-muted)", marginTop:18 }}>
              {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
              <span onClick={() => { setAuthMode(isLogin ? "signup" : "login"); setErr(""); setStep("form"); }}
                style={{ color:"var(--accent)", fontWeight:700, cursor:"pointer" }}>
                {isLogin ? "S'inscrire" : "Se connecter"}
              </span>
            </div>
          </>
        ) : (
          /* Plan selection after signup */
          <>
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20 }}>
              <button onClick={() => ctxLogin(registeredUser)}
                style={{ padding:"16px", borderRadius:16, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", textAlign:"left", cursor:"pointer" }}>
                <div style={{ fontWeight:800, fontSize:15, marginBottom:2 }}>🆓 Continuer gratuitement</div>
                <div style={{ fontSize:12, color:"var(--text-muted)" }}>20 questions/jour · Flashcards · Mode examen</div>
              </button>
              <button onClick={() => { ctxLogin(registeredUser); setScreen("pricing"); }}
                style={{ padding:"16px", borderRadius:16, border:"2px solid var(--accent)", background:"var(--accent-soft)", color:"var(--text)", textAlign:"left", cursor:"pointer", position:"relative" }}>
                <div style={{ position:"absolute", top:-10, right:14, background:"linear-gradient(135deg,var(--accent),var(--accent2))", color:"#fff", padding:"2px 12px", borderRadius:20, fontSize:11, fontWeight:800 }}>
                  ✦ Recommandé
                </div>
                <div style={{ fontWeight:800, fontSize:15, color:"var(--accent)", marginBottom:2 }}>✦ Découvrir Premium</div>
                <div style={{ fontSize:12, color:"var(--text-muted)" }}>Questions illimitées · Plan IA · Exercices sur mesure · Essai 7j gratuit</div>
              </button>
            </div>
            <div style={{ textAlign:"center", fontSize:12, color:"var(--text-muted)" }}>
              Tu pourras changer de plan à tout moment dans tes paramètres.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
