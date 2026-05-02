// ─── src/pages/ProfileSelect.jsx ─────────────────────────────────────────────
// Netflix-style profile selection screen for family plan users.
// Shown on app start when plan === "famille" and multiple profiles exist.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { Logo, Btn } from "../components/SharedUI.jsx";

const AVATARS = ["🧑‍🎓","👧","👦","👩","👨","🧒","🎓","📚","🧑","👩‍🏫","👨‍🏫","⭐"];
const CLASSE_OPTS = ["6e","5e","4e","3e","2nde","1ere","terminale","superieur"];

export default function ProfileSelect() {
  const { user, familyProfiles, setActiveProfileId, setScreen, addFamilyProfile, removeFamilyProfile } = useApp();

  const [adding,        setAdding]        = useState(false);
  const [newName,       setNewName]       = useState("");
  const [newClasse,     setNewClasse]     = useState("3e");
  const [newAvatar,     setNewAvatar]     = useState("🧑‍🎓");
  const [err,           setErr]           = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const pick = (id) => {
    setActiveProfileId(id);
    setScreen("chat");
  };

  const handleAdd = () => {
    if (!newName.trim()) { setErr("Prénom requis."); return; }
    const fp = addFamilyProfile({
      name:    newName.trim(),
      role:    "eleve",
      classe:  newClasse,
      avatar:  newAvatar,
      plan:    user?.plan || "famille",
    });
    if (!fp) { setErr("Maximum 5 profils atteint."); return; }
    setNewName(""); setAdding(false); setErr("");
  };

  const handleDelete = (id) => {
    removeFamilyProfile(id);
    setConfirmDelete(null);
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <Logo />
        <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 900, fontSize: 28, color: "var(--text)", marginTop: 28, marginBottom: 8, letterSpacing: "-0.5px" }}>
          Qui utilise l'application ?
        </div>
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Chaque profil a ses propres cours, notes et progression
        </div>
      </div>

      {/* Profile cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", maxWidth: 640, marginBottom: 24 }}>

        {/* Parent card */}
        <ProfileCard
          name={user?.name || "Parent"}
          avatarText={user?.name?.[0]?.toUpperCase() || "P"}
          isParent
          subtitle="Tableau parent"
          onClick={() => pick(null)}
        />

        {/* Child cards */}
        {familyProfiles.map(p => (
          <ProfileCard
            key={p.id}
            name={p.name}
            avatarEmoji={p.avatar}
            subtitle={p.classe}
            onClick={() => pick(p.id)}
            onDelete={() => setConfirmDelete(p.id)}
          />
        ))}

        {/* Add profile card */}
        {familyProfiles.length < 4 && !adding && (
          <AddProfileCard onClick={() => setAdding(true)} />
        )}
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div style={{ background: "var(--card)", border: "1px solid var(--danger)", borderRadius: 16, padding: "18px 22px", marginBottom: 16, maxWidth: 340, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>
            Supprimer ce profil ? Toutes ses données seront perdues.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <Btn danger onClick={() => handleDelete(confirmDelete)}>Supprimer</Btn>
            <Btn ghost  onClick={() => setConfirmDelete(null)}>Annuler</Btn>
          </div>
        </div>
      )}

      {/* Add profile form */}
      {adding && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "24px", width: "100%", maxWidth: 360, marginBottom: 16 }}>
          <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 800, fontSize: 17, color: "var(--text)", marginBottom: 18 }}>
            Nouveau profil enfant
          </div>

          {/* Avatar picker */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.7 }}>Avatar</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {AVATARS.map(av => (
                <button key={av} onClick={() => setNewAvatar(av)}
                  style={{ width: 40, height: 40, borderRadius: 10, border: `2px solid ${newAvatar === av ? "var(--accent)" : "var(--border)"}`, background: newAvatar === av ? "var(--accent-soft)" : "var(--card2)", fontSize: 20, cursor: "pointer", transition: "all 0.15s" }}>
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.7 }}>Prénom</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              maxLength={20}
              placeholder="Lucas, Emma..."
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              autoFocus
              style={{ width: "100%", background: "var(--card2)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 14, color: "var(--text)", boxSizing: "border-box" }}
            />
          </div>

          {/* Class */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.7 }}>Classe</label>
            <select
              value={newClasse}
              onChange={e => setNewClasse(e.target.value)}
              style={{ width: "100%", background: "var(--card2)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 14, color: "var(--text)", cursor: "pointer", boxSizing: "border-box" }}>
              {CLASSE_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {err && <div style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <Btn primary full onClick={handleAdd}>Créer le profil</Btn>
            <Btn ghost onClick={() => { setAdding(false); setErr(""); }}>Annuler</Btn>
          </div>
        </div>
      )}

      <button
        onClick={() => { setActiveProfileId(null); setScreen("chat"); }}
        style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: "8px 16px", marginTop: 4 }}>
        Continuer en mode parent →
      </button>
    </div>
  );
}

// ── Profile card (parent or child) ───────────────────────────────────────────
function ProfileCard({ name, avatarText, avatarEmoji, isParent, subtitle, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={onClick}
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          background: "var(--card)",
          border: `2px solid ${hovered ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 20, padding: "24px 16px", width: 124, cursor: "pointer",
          transition: "all 0.2s", outline: "none",
          transform: hovered ? "translateY(-4px)" : "none",
          boxShadow: hovered ? "0 8px 32px var(--accent-glow)" : "none",
        }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: isParent ? "linear-gradient(135deg,var(--accent),var(--accent2))" : "var(--card2)",
          border: isParent ? "none" : "2px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: avatarEmoji ? 34 : 26,
          color: isParent ? "#fff" : undefined,
          fontWeight: isParent ? 800 : undefined,
          boxShadow: isParent ? "0 4px 16px var(--accent-glow)" : undefined,
          flexShrink: 0,
        }}>
          {avatarEmoji || avatarText}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{name}</div>
          <div style={{ fontSize: 11, color: isParent ? "var(--accent)" : "var(--text-muted)", fontWeight: isParent ? 700 : 500, marginTop: 2 }}>{subtitle}</div>
        </div>
      </button>

      {/* Delete button (visible on hover) */}
      {onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{
            position: "absolute", top: 6, right: 6,
            width: 22, height: 22, borderRadius: "50%",
            background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)",
            color: "var(--danger)", fontSize: 11, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            opacity: hovered ? 1 : 0, transition: "opacity 0.2s",
          }}>
          ✕
        </button>
      )}
    </div>
  );
}

// ── Add profile dashed card ───────────────────────────────────────────────────
function AddProfileCard({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        background: hovered ? "var(--accent-soft)" : "transparent",
        border: `2px dashed ${hovered ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 20, padding: "24px 16px", width: 124, cursor: "pointer",
        transition: "all 0.2s", outline: "none",
      }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--card2)", border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "var(--text-muted)" }}>
        +
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
        Ajouter un profil
      </div>
    </button>
  );
}
