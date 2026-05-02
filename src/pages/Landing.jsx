// ─── src/pages/Landing.jsx ────────────────────────────────────────────────────
import { useApp } from "../context/AppContext.jsx";
import { Logo, Btn } from "../components/SharedUI.jsx";
import { SUBJECTS, CLASSES } from "../data/constants.js";

export default function Landing() {
  const { setScreen, setAuthMode, dark, setDark } = useApp();
  const go = (mode) => { setAuthMode(mode); setScreen("auth"); };

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:"var(--bg)" }}>
      {/* Nav */}
      <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 18px", background:"var(--card)", borderBottom:"1px solid var(--border)", flexWrap:"wrap", gap:8 }}>
        <Logo />
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"nowrap" }}>
          <button onClick={() => setDark(!dark)} style={{ background:"var(--card2)", border:"1px solid var(--border)", borderRadius:10, padding:"7px 10px", fontSize:15, cursor:"pointer", flexShrink:0 }}>{dark?"☀️":"🌙"}</button>
          <Btn ghost sm onClick={() => go("login")}>Connexion</Btn>
          <Btn primary sm onClick={() => go("signup")}>S'inscrire →</Btn>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ textAlign:"center", padding:"70px 24px 50px", background:dark?"linear-gradient(180deg,#0f0c29,var(--bg))":"linear-gradient(180deg,#eef0ff,var(--bg))", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"-80px", left:"50%", transform:"translateX(-50%)", width:500, height:500, background:"radial-gradient(circle, var(--accent-soft) 0%, transparent 70%)", pointerEvents:"none" }}/>
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:50, padding:"6px 16px", fontSize:13, fontWeight:700, color:"var(--warn)", marginBottom:22 }}>
          🚀 Offre de lancement — Essai 7 jours gratuit
        </div>
        <h1 style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:900, fontSize:"clamp(30px,6vw,54px)", lineHeight:1.1, color:"var(--text)", marginBottom:18, letterSpacing:"-1.5px" }}>
          Ton assistant scolaire IA<br/>
          <span style={{ background:"linear-gradient(135deg,var(--accent),var(--accent2),#ec4899)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            disponible 24h/24
          </span>
        </h1>
        <p style={{ color:"var(--text-muted)", fontSize:17, lineHeight:1.7, maxWidth:520, margin:"0 auto 34px" }}>
          Résumés, fiches de révision, quiz, flashcards et mode examen — adaptés à ta classe. Pas une copie de ChatGPT, une vraie expérience éducative.
        </p>
        <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap", marginBottom:40 }}>
          <Btn primary large onClick={() => go("signup")}>✦ Commencer gratuitement</Btn>
          <Btn ghost large onClick={() => setScreen("chat")}>Essayer sans compte</Btn>
        </div>
        <div style={{ display:"flex", gap:24, justifyContent:"center", flexWrap:"wrap" }}>
          {[["🎓","6ème → Supérieur"],["⚡","Réponse < 5s"],["🃏","Flashcards"],["🧪","Mode Examen"],["🏆","Gamification"]].map(([ic,lb],i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:7, color:"var(--text-muted)", fontSize:13, fontWeight:600 }}><span style={{ fontSize:18 }}>{ic}</span>{lb}</div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:14, padding:"44px 24px", maxWidth:1000, margin:"0 auto", width:"100%" }}>
        {[
          { icon:"📝", title:"Résumés intelligents", desc:"Ton cours condensé en points clés adaptés à ton niveau", color:"#6366f1" },
          { icon:"🃏", title:"Flashcards", desc:"Mémorise avec des cartes interactives à retourner", color:"#ec4899" },
          { icon:"🧪", title:"Mode Examen", desc:"Chrono, réponse libre, correction par l'IA", color:"#f59e0b" },
          { icon:"🏆", title:"Gamification", desc:"XP, niveaux et badges pour rester motivé", color:"#10b981" },
          { icon:"📊", title:"Suivi de progression", desc:"Notes, statistiques et coach IA personnalisé", color:"#3b82f6" },
          { icon:"📅", title:"Plan de révision", desc:"Planning automatique basé sur tes points faibles", color:"#8b5cf6" },
        ].map((f,i)=>(
          <div key={i} style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:20, padding:"22px 18px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:-12, right:-12, width:60, height:60, background:f.color+"14", borderRadius:"50%" }}/>
            <div style={{ fontSize:30, marginBottom:10 }}>{f.icon}</div>
            <div style={{ fontWeight:800, fontSize:15, color:"var(--text)", marginBottom:6 }}>{f.title}</div>
            <div style={{ fontSize:13, color:"var(--text-muted)", lineHeight:1.55 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Niveaux */}
      <div style={{ padding:"32px 24px 44px", background:"var(--card2)", borderTop:"1px solid var(--border)", borderBottom:"1px solid var(--border)" }}>
        <h2 style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:800, fontSize:22, color:"var(--text)", textAlign:"center", marginBottom:20 }}>Pour tous les niveaux</h2>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
          {CLASSES.map(c=>(
            <div key={c.v} style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:50, padding:"8px 18px", fontSize:13, fontWeight:600, color:"var(--text)" }}>{c.l}</div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ margin:"44px 24px 48px", borderRadius:24, background:"linear-gradient(135deg,#1a0f4e,#0d1a35)", padding:"48px 32px", textAlign:"center", maxWidth:920, alignSelf:"center", width:"calc(100% - 48px)", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 30% 50%,rgba(99,102,241,0.2) 0%,transparent 60%)", pointerEvents:"none" }}/>
        <div style={{ position:"relative" }}>
          <div style={{ fontSize:44, marginBottom:12 }}>✦</div>
          <h2 style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:900, fontSize:26, color:"#fff", marginBottom:10 }}>Prêt à avoir de meilleures notes ?</h2>
          <p style={{ color:"rgba(255,255,255,0.65)", marginBottom:24, fontSize:15 }}>Rejoins des élèves qui révisent mieux et qui progressent avec Study AI</p>
          <Btn primary large onClick={() => go("signup")}>Commencer — c'est gratuit !</Btn>
        </div>
      </div>

      <footer style={{ textAlign:"center", padding:"20px", color:"var(--text-muted)", fontSize:12, borderTop:"1px solid var(--border)" }}>
        © 2025 Study AI · Pour les élèves de 11 à 25 ans · Un outil pour apprendre, pas pour tricher
      </footer>
    </div>
  );
}
