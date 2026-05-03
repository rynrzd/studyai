// ─── src/components/SharedUI.jsx ─────────────────────────────────────────────
// Composants UI réutilisables dans toute l'app
// ─────────────────────────────────────────────────────────────────────────────

// ── Logo ──────────────────────────────────────────────────────────────────────
export function Logo({ size = "md" }) {
  const s = size === "lg" ? { icon: 32, text: 26 }
          : size === "sm" ? { icon: 18, text: 15 }
          :                 { icon: 24, text: 19 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: s.icon + 8, height: s.icon + 8, borderRadius: "40%", background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: s.icon * 0.65, boxShadow: "0 4px 12px var(--accent-glow)" }}>✦</div>
      <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: s.text, color: "var(--text)", letterSpacing: "-0.4px" }}>
        Study<span style={{ color: "var(--accent)" }}>AI</span>
      </span>
    </div>
  );
}

// ── Btn ───────────────────────────────────────────────────────────────────────
export function Btn({ children, primary, ghost, danger, full, large, sm, loading, onClick, disabled, style: sx }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        fontWeight: 700, borderRadius: 14, cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.75 : 1, border: "none", transition: "all 0.18s",
        width: full ? "100%" : "auto",
        padding: large ? "14px 28px" : sm ? "7px 14px" : "10px 20px",
        fontSize: large ? 16 : sm ? 13 : 14,
        ...(primary ? { background: "linear-gradient(135deg, var(--accent), var(--accent2))", color: "#fff", boxShadow: "0 4px 16px var(--accent-glow)" } : {}),
        ...(ghost   ? { background: "transparent", color: "var(--text-soft)", border: "1.5px solid var(--border)" } : {}),
        ...(danger  ? { background: "transparent", color: "var(--danger)", border: "1.5px solid var(--danger)" } : {}),
        ...(!primary && !ghost && !danger ? { background: "var(--card)", color: "var(--text)", border: "1.5px solid var(--border)" } : {}),
        ...sx,
      }}>
      {loading ? "⏳ Chargement..." : children}
    </button>
  );
}

// ── ErrBox ────────────────────────────────────────────────────────────────────
export function ErrBox({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "var(--danger)", fontWeight: 600, marginBottom: 14 }}>
      ⚠️ {msg}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-soft)", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ type = "text", placeholder, value, onChange, onKeyDown, disabled }) {
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange} onKeyDown={onKeyDown} disabled={disabled}
      style={{ width: "100%", background: "var(--card2)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "12px 14px", fontSize: 14, color: "var(--text)", boxSizing: "border-box" }} />
  );
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ value, onChange, children, placeholder }) {
  return (
    <select value={value} onChange={onChange}
      style={{ width: "100%", background: "var(--card2)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "12px 14px", fontSize: 14, color: "var(--text)", cursor: "pointer", boxSizing: "border-box" }}>
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ on, onClick, label, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={onClick} style={{ width: 50, height: 27, borderRadius: 14, background: on ? "var(--accent)" : "var(--border)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 3.5, left: on ? 26 : 3.5, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
      </button>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style: sx, onClick, hover }) {
  return (
    <div onClick={onClick}
      style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: 22, cursor: onClick ? "pointer" : "default", transition: hover ? "all 0.2s" : "none", ...sx }}
      onMouseOver={hover ? e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)"; } : undefined}
      onMouseOut={hover  ? e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; } : undefined}>
      {children}
    </div>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = "var(--accent)", height = 7 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="progress-bar" style={{ height }}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ── Badge chip ────────────────────────────────────────────────────────────────
export function BadgeChip({ icon, label, color = "var(--accent)" }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: color + "18", border: `1px solid ${color}35`, borderRadius: 20, padding: "4px 11px", fontSize: 12, fontWeight: 700, color }}>
      <span>{icon}</span><span>{label}</span>
    </div>
  );
}

// ── InfoBox (coach / tip) ──────────────────────────────────────────────────────
export function InfoBox({ icon, title, msg, color = "var(--accent)", action, onAction }) {
  return (
    <div style={{ background: color + "10", border: `1px solid ${color}30`, borderRadius: 16, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color, fontSize: 14, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.55 }}>{msg}</div>
          {action && (
            <button onClick={onAction}
              style={{ marginTop: 10, background: color, color: "#fff", border: "none", borderRadius: 10, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {action}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── XP Popup ──────────────────────────────────────────────────────────────────
export function XpPopup({ popup }) {
  if (!popup) return null;
  return (
    <div className="xp-popup" style={{ left: popup.x, top: popup.y }}>
      +{popup.amount} XP ⭐
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 20 }) {
  return (
    <div style={{ width: size, height: size, border: `2px solid var(--border)`, borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
  );
}

// ── formatAI — rendu du texte IA ──────────────────────────────────────────────
export function fmtAI(text) {
  // Strip all HTML tags so they never show as raw text
  const clean = text
    .replace(/<details[^>]*>/gi, "")
    .replace(/<\/details>/gi, "")
    .replace(/<summary[^>]*>(.*?)<\/summary>/gi, "▸ $1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1")
    .replace(/<\/?(ul|ol|p|div|span|b|strong|em|i|h[1-6]|code|pre|blockquote)[^>]*>/gi, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");

  return clean.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: 5 }} />;
    if (line.startsWith("## ")) return <h3 key={i} style={{ color: "var(--accent)", margin: "12px 0 4px", fontSize: 15, fontWeight: 800 }}>{line.slice(3)}</h3>;
    if (line.startsWith("# "))  return <h2 key={i} style={{ color: "var(--accent)", margin: "14px 0 6px", fontSize: 17, fontWeight: 800 }}>{line.slice(2)}</h2>;
    if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("▸ ")) return (
      <div key={i} style={{ display: "flex", gap: 9, margin: "3px 0", alignItems: "flex-start" }}>
        <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}>▸</span>
        <span style={{ color: "var(--text-soft)" }}>{inlineBold(line.replace(/^[-•▸]\s/, ""))}</span>
      </div>
    );
    if (/^\d+\./.test(line)) return <div key={i} style={{ margin: "3px 0", color: "var(--text-soft)" }}>{inlineBold(line)}</div>;
    return <p key={i} style={{ margin: "3px 0", color: "var(--text-soft)", lineHeight: 1.7 }}>{inlineBold(line)}</p>;
  });
}

function inlineBold(text) {
  return text.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} style={{ color: "var(--text)", fontWeight: 700 }}>{p.slice(2, -2)}</strong>
      : p
  );
}
