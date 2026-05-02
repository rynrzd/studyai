// ─── src/pages/Pricing.jsx ───────────────────────────────────────────────────
import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { Logo, Btn, ErrBox, Select } from "../components/SharedUI.jsx";
import { PROMO_CODES, CLASSES } from "../data/constants.js";

export function Pricing() {
  const { setScreen, setPayPlan, currentUser } = useApp();

  const plans = [
    {
      id:"free", name:"Gratuit", price:"0€", period:"", color:"#6366f1",
      features:["20 questions / jour","4 photos / jour","Flashcards","Mode Examen","Mode sombre","Historique 7 jours"],
      cta:"Commencer gratuitement", popular:false,
    },
    {
      id:"premium", name:"Premium", price:"6,99€", period:"/mois", color:"#f59e0b", popular:true, badge:"✦ Plus populaire",
      features:["Questions illimitées","Photos illimitées","Réponses ultra-détaillées","Plan de révision IA","Génération d'exercices","Codes promo","Support prioritaire"],
      cta:"Essai 7 jours — 0€ aujourd'hui", note:"Puis 6,99€/mois · Annulable à tout moment",
    },
    {
      id:"famille", name:"Famille", price:"9,99€", period:"/mois", color:"#10b981",
      features:["Jusqu'à 5 profils","Tout Premium pour chaque profil","Tableau de bord famille","Suivi des enfants"],
      cta:"Choisir Famille", note:"9,99€/mois · 4 enfants inclus · +2,80€ par enfant suppl.",
    },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", background:"var(--card)", borderBottom:"1px solid var(--border)" }}>
        <Logo />
        <button onClick={() => setScreen(currentUser?"chat":"landing")} style={{ background:"transparent", border:"none", color:"var(--text-muted)", fontWeight:600, fontSize:14, cursor:"pointer" }}>← Retour</button>
      </div>
      <div style={{ textAlign:"center", padding:"48px 20px 28px" }}>
        <div style={{ display:"inline-block", background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:50, padding:"6px 16px", fontSize:13, fontWeight:700, color:"var(--warn)", marginBottom:18 }}>🔥 Offre de lancement limitée</div>
        <h1 style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:900, fontSize:30, color:"var(--text)", marginBottom:10, letterSpacing:"-0.6px" }}>Choisis ton accès</h1>
        <p style={{ color:"var(--text-muted)", fontSize:15 }}>Commence gratuitement · Annule à tout moment · Sans engagement</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:18, padding:"0 22px 20px", maxWidth:920, margin:"0 auto" }}>
        {plans.map((plan,i) => (
          <div key={i} style={{ background:"var(--card)", border:`${plan.popular?"2.5px solid var(--accent)":"1.5px solid var(--border)"}`, borderRadius:24, padding:"30px 24px", position:"relative", display:"flex", flexDirection:"column", gap:16, boxShadow:plan.popular?"0 8px 40px var(--accent-glow)":"none" }}>
            {plan.popular && <div style={{ position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)", background:"linear-gradient(135deg,var(--accent),var(--accent2))", color:"#fff", padding:"4px 18px", borderRadius:20, fontSize:12, fontWeight:800, whiteSpace:"nowrap" }}>{plan.badge}</div>}
            <div style={{ fontWeight:800, fontSize:19, color:plan.color }}>{plan.name}</div>
            <div style={{ fontSize:36, fontWeight:900, color:"var(--text)", fontFamily:"Space Grotesk,sans-serif" }}>{plan.price}<span style={{ fontSize:14, fontWeight:500, color:"var(--text-muted)" }}>{plan.period}</span></div>
            {plan.id==="premium" && <div style={{ fontSize:12, color:"var(--warn)", fontWeight:700 }}>Prix normal 12,99€ — économisez 46% !</div>}
            <div style={{ height:1, background:"var(--border)" }}/>
            <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:9, flex:1 }}>
              {plan.features.map((f,j)=><li key={j} style={{ fontSize:13, color:"var(--text-soft)", display:"flex", gap:8 }}><span style={{ color:plan.color, fontWeight:700 }}>✓</span>{f}</li>)}
            </ul>
            <button onClick={() => { if(plan.id==="free"){setScreen("chat");}else{setPayPlan(plan.id);setScreen("payment");} }}
              style={{ padding:"13px", borderRadius:14, fontWeight:800, fontSize:14, cursor:"pointer", background:plan.popular?"linear-gradient(135deg,var(--accent),var(--accent2))":"transparent", color:plan.popular?"#fff":plan.color, border:plan.popular?"none":`2px solid ${plan.color}`, transition:"all 0.2s" }}>
              {plan.cta}
            </button>
            {plan.note && <div style={{ textAlign:"center", fontSize:11, color:"var(--text-muted)" }}>{plan.note}</div>}
            {plan.id==="premium" && <div style={{ textAlign:"center", fontSize:12, color:"var(--success)", fontWeight:700 }}>✓ Aucune CB requise pour l'essai</div>}
          </div>
        ))}
      </div>
      <div style={{ textAlign:"center", padding:"12px 20px 44px", color:"var(--text-muted)", fontSize:12 }}>🔒 Paiement sécurisé · SSL 256-bit · Annulation en 1 clic</div>
    </div>
  );
}

// ─── Payment ──────────────────────────────────────────────────────────────────
// Redirects to Stripe's hosted checkout (PCI-compliant).
// Card data NEVER touches our server. Premium is activated only after
// server-side verification via /api/verify-payment.
export function Payment() {
  const { payPlan, currentUser, setScreen } = useApp();
  const [promo,    setPromo]    = useState("");
  const [promoMsg, setPromoMsg] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");

  const prices    = { premium: "6,99€", famille: "9,99€" };
  const planLabel = payPlan === "famille" ? "Famille" : "Premium";

  const applyPromo = () => {
    const p = promo.toUpperCase().trim();
    if (PROMO_CODES[p]) {
      setPromoMsg(`✅ Code accepté — remise appliquée par Stripe au moment du paiement.`);
    } else {
      setPromoMsg("❌ Code invalide.");
    }
  };

  const startCheckout = async () => {
    setErr(""); setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          plan:  payPlan,
          email: currentUser?.email || "",
          promoCode: promo.toUpperCase().trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setErr(data.error || "Impossible d'initier le paiement. Réessaie.");
        setLoading(false);
        return;
      }
      // Redirect to Stripe's hosted checkout page
      window.location.href = data.url;
    } catch {
      setErr("Une erreur est survenue. Vérifie ta connexion.");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", background:"var(--card)", borderBottom:"1px solid var(--border)" }}>
        <Logo />
        <button onClick={() => setScreen("pricing")} style={{ background:"transparent", border:"none", color:"var(--text-muted)", fontWeight:600, fontSize:14, cursor:"pointer" }}>← Retour</button>
      </div>
      <div style={{ display:"flex", justifyContent:"center", padding:"32px 16px 48px" }}>
        <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:28, padding:"38px 32px", width:"100%", maxWidth:480, boxShadow:"0 8px 40px rgba(0,0,0,0.06)" }}>

          {/* Security badge */}
          <div style={{ background:"rgba(5,150,105,0.1)", border:"1px solid rgba(5,150,105,0.25)", borderRadius:14, padding:"11px 16px", fontSize:13, color:"var(--success)", fontWeight:700, textAlign:"center", marginBottom:26 }}>
            🔒 Paiement sécurisé via Stripe · SSL 256-bit · PCI-DSS
          </div>

          <h2 style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:800, fontSize:20, color:"var(--text)", marginBottom:18 }}>
            Abonnement {planLabel}
          </h2>

          {/* Plan summary */}
          <div style={{ background:"var(--card2)", borderRadius:16, padding:"16px", marginBottom:22 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:700, color:"var(--text)" }}>Plan {planLabel}</div>
              <div style={{ fontWeight:900, color:"var(--accent)", fontSize:19, fontFamily:"Space Grotesk,sans-serif" }}>
                {prices[payPlan]}/mois
              </div>
            </div>
            {payPlan === "premium" && (
              <div style={{ fontSize:12, color:"var(--success)", fontWeight:700, marginTop:5 }}>
                🎁 Essai 7 jours gratuit — 0€ débité aujourd'hui
              </div>
            )}
          </div>

          {/* Promo code */}
          <div style={{ marginBottom:22 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:600, color:"var(--text-soft)", marginBottom:6 }}>
              Code promo (optionnel)
            </label>
            <div style={{ display:"flex", gap:8 }}>
              <input
                style={{ flex:1, background:"var(--card2)", border:"1.5px solid var(--border)", borderRadius:12, padding:"11px 14px", fontSize:14, color:"var(--text)" }}
                placeholder="Ex: STUDYAI"
                value={promo}
                onChange={e => { setPromo(e.target.value.toUpperCase()); setPromoMsg(""); }}
                maxLength={20}
              />
              <button
                onClick={applyPromo}
                style={{ background:"var(--accent)", color:"#fff", border:"none", borderRadius:12, padding:"0 16px", fontWeight:700, fontSize:14, cursor:"pointer" }}>
                OK
              </button>
            </div>
            {promoMsg && (
              <div style={{ fontSize:12, marginTop:5, color: promoMsg.startsWith("✅") ? "var(--success)" : "var(--danger)", fontWeight:700 }}>
                {promoMsg}
              </div>
            )}
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:4 }}>
              Codes disponibles : STUDYAI · RENTREE · BAC2025
            </div>
          </div>

          {/* How it works */}
          <div style={{ background:"var(--card2)", borderRadius:14, padding:"14px 16px", marginBottom:22, fontSize:13, color:"var(--text-soft)", lineHeight:1.6 }}>
            <div style={{ fontWeight:700, color:"var(--text)", marginBottom:6 }}>Comment ça marche ?</div>
            <div>Tu seras redirigé vers la page de paiement sécurisée de Stripe. Tes coordonnées bancaires ne transitent jamais par nos serveurs.</div>
          </div>

          {err && <ErrBox msg={err} />}

          <Btn primary full large loading={loading} onClick={startCheckout}>
            {loading ? "Redirection vers Stripe..." : `Procéder au paiement → ${payPlan === "premium" ? "0€ aujourd'hui" : prices[payPlan] + "/mois"}`}
          </Btn>

          <div style={{ display:"flex", justifyContent:"space-around", fontSize:11, color:"var(--text-muted)", fontWeight:600, marginTop:14 }}>
            <span>🔐 SSL 256-bit</span>
            <span>🛡️ 3D Secure</span>
            <span>↩️ Remboursable 30j</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export function Settings() {
  const { currentUser, updateUser, dark, setDark, logout, setScreen, effectiveProfile, activeSubjects, updateProfileGrade } = useApp();
  const BAD = ["merde","putain","connard","salope","bite","couille"];

  // ── Nom de l'IA ──────────────────────────────────────────────────────────────
  const [aiName,      setAiName]      = useState(currentUser?.aiName || "Study AI");
  const [savedAI,     setSavedAI]     = useState(false);

  // ── Profil éditable ──────────────────────────────────────────────────────────
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName,        setEditName]       = useState(currentUser?.name || "");
  const [editClasse,      setEditClasse]     = useState(currentUser?.classe || "");
  const [savedProfile,    setSavedProfile]   = useState(false);

  // ── Notifications (stockées en localStorage) ─────────────────────────────────
  const [notifs, setNotifs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sai_notifs") || "null") || { daily:true, tips:false, weekly:false }; }
    catch { return { daily:true, tips:false, weekly:false }; }
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
    updateUser({ name: editName.trim(), classe: editClasse, age: cls?.age || currentUser?.age, role: editClasse==="prof"?"prof":"eleve" });
    setEditingProfile(false); setSavedProfile(true); setTimeout(() => setSavedProfile(false), 2000);
  };

  // ── Petit toggle helper ──────────────────────────────────────────────────────
  const Toggle = ({ on, onClick, label, sub }) => (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid var(--border)" }}>
      <div>
        <div style={{ fontWeight:600, fontSize:14, color:"var(--text)" }}>{label}</div>
        {sub && <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>{sub}</div>}
      </div>
      <button onClick={onClick} style={{ width:46, height:25, borderRadius:13, background:on?"var(--accent)":"var(--border)", border:"none", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
        <div style={{ position:"absolute", top:3, left:on?24:3, width:19, height:19, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
      </button>
    </div>
  );

  const sections = [
    // ── PROFIL ────────────────────────────────────────────────────────────────
    { title:"👤 Profil", content: currentUser && (
      <div>
        {!editingProfile ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:52, height:52, borderRadius:"40%", background:"linear-gradient(135deg,var(--accent),var(--accent2))", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:22, boxShadow:"0 4px 16px var(--accent-glow)", flexShrink:0 }}>
                {currentUser.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight:700, color:"var(--text)", fontSize:16 }}>{currentUser.name}</div>
                <div style={{ fontSize:13, color:"var(--text-muted)" }}>{currentUser.email}</div>
                <div style={{ fontSize:12, color:"var(--accent)", fontWeight:700, marginTop:2 }}>
                  {currentUser.classe==="prof"?"Professeur":`Classe : ${currentUser.classe}`}
                  {currentUser.matierePref && <span style={{ marginLeft:6 }}>· {activeSubjects.find(s=>s.id===currentUser.matierePref)?.label}</span>}
                </div>
              </div>
            </div>
            <button onClick={()=>setEditingProfile(true)} style={{ background:"var(--card2)", border:"1px solid var(--border)", borderRadius:10, padding:"6px 12px", fontSize:13, fontWeight:700, color:"var(--text-muted)", cursor:"pointer", flexShrink:0 }}>
              ✏️ Modifier
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:12 }}>
              <div>
                <label style={{ display:"block", fontSize:13, fontWeight:600, color:"var(--text-soft)", marginBottom:5 }}>Prénom</label>
                <input value={editName} onChange={e=>setEditName(e.target.value)} maxLength={30}
                  style={{ width:"100%", background:"var(--card2)", border:"1.5px solid var(--border)", borderRadius:12, padding:"10px 14px", fontSize:14, color:"var(--text)", boxSizing:"border-box" }}/>
              </div>
              <div>
                <label style={{ display:"block", fontSize:13, fontWeight:600, color:"var(--text-soft)", marginBottom:5 }}>Classe</label>
                <Select value={editClasse} onChange={e=>setEditClasse(e.target.value)}>
                  {CLASSES.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}
                </Select>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn primary onClick={saveProfile}>Sauvegarder</Btn>
              <Btn ghost onClick={()=>{setEditingProfile(false);setEditName(currentUser.name||"");setEditClasse(currentUser.classe||"");}}>Annuler</Btn>
            </div>
          </div>
        )}
        {savedProfile && <div style={{ fontSize:13, color:"var(--success)", fontWeight:700, marginTop:8 }}>✅ Profil mis à jour !</div>}
      </div>
    )},

    // ── NOM DE L'IA ───────────────────────────────────────────────────────────
    { title:"🤖 Nom de l'IA", content: (
      <div>
        <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:12, lineHeight:1.5 }}>Personnalise le nom de ton assistant. Pas de mots inappropriés 😊</p>
        <div style={{ display:"flex", gap:8 }}>
          <input style={{ flex:1, background:"var(--card2)", border:"1.5px solid var(--border)", borderRadius:12, padding:"11px 14px", fontSize:14, color:"var(--text)" }} placeholder="Study AI, Mentor, Prof..." value={aiName} onChange={e=>setAiName(e.target.value)} maxLength={20} onKeyDown={e=>e.key==="Enter"&&saveAI()} />
          <Btn primary onClick={saveAI}>{savedAI?"✅ Sauvé !":"Sauvegarder"}</Btn>
        </div>
      </div>
    )},

    // ── MES NOTES ─────────────────────────────────────────────────────────────
    { title:"📊 Mes notes", content: currentUser && (() => {
      const grades = effectiveProfile?.grades || {};
      const gradeable = activeSubjects.filter(s => s.id !== "general" && !s.noAI);
      return (
        <div>
          <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:14, lineHeight:1.5 }}>
            Tes moyennes actuelles — utilisées pour personnaliser l'IA et tes statistiques.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {gradeable.map(s => {
              const grade = grades[s.id];
              const c = grade !== undefined
                ? grade >= 14 ? "var(--success)" : grade >= 10 ? "var(--warn)" : "var(--danger)"
                : "var(--border)";
              return (
                <div key={s.id} style={{ display:"flex", alignItems:"center", gap:12, background:"var(--card2)", borderRadius:14, padding:"10px 14px" }}>
                  <span style={{ fontSize:18, width:26, textAlign:"center" }}>{s.icon}</span>
                  <span style={{ flex:1, fontSize:13, fontWeight:600, color:"var(--text)" }}>{s.label}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <input
                      type="number" min="0" max="20" step="0.5"
                      placeholder="—"
                      value={grade ?? ""}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === "") { updateProfileGrade(s.id, undefined); return; }
                        const n = parseFloat(v);
                        if (!isNaN(n) && n >= 0 && n <= 20) updateProfileGrade(s.id, n);
                      }}
                      style={{ width:56, background:"var(--card)", border:`1.5px solid ${c}`, borderRadius:10, padding:"6px 8px", fontSize:13, color:"var(--text)", textAlign:"center" }}
                    />
                    <span style={{ fontSize:12, color:"var(--text-muted)" }}>/20</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:10 }}>
            Les modifications sont enregistrées automatiquement.
          </p>
        </div>
      );
    })()},

    // ── PRÉFÉRENCES ───────────────────────────────────────────────────────────
    { title:"⚙️ Préférences", content: (
      <div>
        <Toggle on={dark} onClick={()=>setDark(!dark)} label="Mode sombre" sub="Interface en couleurs sombres" />
        <Toggle on={true} onClick={()=>{}} label="Suggestions de questions" sub="Affiche des questions d'exemple sur l'écran d'accueil" />
        <Toggle on={true} onClick={()=>{}} label="Effets sonores" sub="Sons de réussite sur les quiz (navigateur)" />
        <div style={{ paddingTop:10 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:600, color:"var(--text-soft)", marginBottom:8 }}>Matière par défaut</label>
          <Select value={currentUser?.matierePref||""} onChange={e=>updateUser({matierePref:e.target.value||undefined})}>
            <option value="">Toutes les matières</option>
            {activeSubjects.filter(s=>s.id!=="general"&&!s.noAI).map(s=><option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
          </Select>
        </div>
      </div>
    )},

    // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
    { title:"🔔 Notifications", content: (
      <div>
        <Toggle on={notifs.daily}  onClick={()=>updateNotif("daily")}  label="Défi du jour"       sub="Rappel quotidien pour relever le défi du jour" />
        <Toggle on={notifs.tips}   onClick={()=>updateNotif("tips")}   label="Conseils de révision" sub="Astuces personnalisées selon tes résultats" />
        <Toggle on={notifs.weekly} onClick={()=>updateNotif("weekly")} label="Rapport hebdomadaire" sub="Résumé de ta progression chaque semaine" />
        <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:10, lineHeight:1.5 }}>
          Les notifications utilisent les alertes du navigateur. Active-les dans tes paramètres système si besoin.
        </p>
      </div>
    )},

    // ── ABONNEMENT ────────────────────────────────────────────────────────────
    { title:"💎 Mon abonnement", content: (
      <div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <div>
            <div style={{ fontWeight:800, color: ["premium","famille"].includes(currentUser?.plan) ? "var(--accent)" : "var(--text)", fontSize:16 }}>
              {currentUser?.plan==="premium"?"✦ Premium":currentUser?.plan==="famille"?"👨‍👩‍👧 Famille":"🆓 Gratuit"}
            </div>
            {currentUser?.plan==="premium" && <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>Questions illimitées · Essai 7j · 6,99€/mois</div>}
            {currentUser?.plan==="famille" && <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>Jusqu'à 5 profils · 9,99€/mois</div>}
            {!["premium","famille"].includes(currentUser?.plan) && <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>20 questions/jour · 4 photos/jour</div>}
          </div>
          {["premium","famille"].includes(currentUser?.plan) && (
            <span style={{ fontSize:12, fontWeight:700, color:"var(--success)", background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:20, padding:"3px 10px" }}>✓ Actif</span>
          )}
        </div>
        {!["premium","famille"].includes(currentUser?.plan) && (
          <Btn primary full onClick={()=>setScreen("pricing")}>✦ Passer Premium — Essai 7j gratuit →</Btn>
        )}
        {["premium","famille"].includes(currentUser?.plan) && (
          <Btn ghost full onClick={()=>setScreen("pricing")}>Gérer mon abonnement</Btn>
        )}
      </div>
    )},

    // ── ZONE DANGER ───────────────────────────────────────────────────────────
    { title:"⚠️ Zone danger", danger:true, content: <Btn danger onClick={logout}>🚪 Se déconnecter</Btn> },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", background:"var(--card)", borderBottom:"1px solid var(--border)" }}>
        <Logo />
        <button onClick={()=>setScreen("chat")} style={{ background:"transparent", border:"none", color:"var(--text-muted)", fontWeight:600, fontSize:14, cursor:"pointer" }}>← Retour au chat</button>
      </div>
      <div style={{ maxWidth:640, margin:"0 auto", padding:"36px 20px" }}>
        <h1 style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:900, fontSize:26, color:"var(--text)", marginBottom:28, letterSpacing:"-0.4px" }}>⚙️ Paramètres</h1>
        {sections.map((sec,i)=>(
          <div key={i} style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:20, padding:"22px", marginBottom:13 }}>
            <h3 style={{ fontWeight:800, fontSize:15, color:sec.danger?"var(--danger)":"var(--text)", marginBottom:14 }}>{sec.title}</h3>
            {sec.content}
          </div>
        ))}
      </div>
    </div>
  );
}
