// ─── src/App.jsx ──────────────────────────────────────────────────────────────
// Routeur principal — délègue aux pages
// Handles Stripe payment return via URL params (?payment_success=1&session_id=...)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";
import { useApp } from "./context/AppContext.jsx";
import { XpPopup } from "./components/SharedUI.jsx";
import Landing       from "./pages/Landing.jsx";
import Auth          from "./pages/Auth.jsx";
import Chat          from "./pages/Chat.jsx";
import Onboarding    from "./pages/Onboarding.jsx";
import ProfileSelect from "./pages/ProfileSelect.jsx";
import { Pricing, Payment, Settings } from "./pages/Pricing.jsx";

export default function App() {
  const { screen, setScreen, xpPopup, currentUser, hasProfile, updateUser } = useApp();

  // ── Onboarding guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "chat") return;
    if (currentUser && !hasProfile) {
      setScreen("onboarding");
    }
  }, [screen, currentUser, hasProfile]);

  // ── Stripe payment return handler ──────────────────────────────────────────
  // Stripe redirects back to /?payment_success=1&session_id=cs_xxx&plan=premium
  // We verify server-side via /api/verify-payment before granting premium.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentSuccess = params.get("payment_success");
    const sessionId      = params.get("session_id");
    const plan           = params.get("plan");

    if (paymentSuccess !== "1" || !sessionId) return;

    // Clean the URL immediately so a refresh doesn't re-trigger
    window.history.replaceState({}, "", window.location.pathname);

    if (!currentUser) return; // user must be logged in

    (async () => {
      try {
        const res = await fetch(`/api/verify-payment?session_id=${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.verified && ["premium", "famille"].includes(data.plan)) {
          updateUser({ plan: data.plan });
          setScreen("chat");
        }
      } catch {
        // Silently ignore — user stays on current screen
      }
    })();
  }, []); // runs once on mount

  return (
    <>
      <XpPopup popup={xpPopup} />

      {screen === "landing"       && <Landing />}
      {screen === "auth"          && <Auth />}
      {screen === "chat"          && <Chat />}
      {screen === "onboarding"    && <Onboarding />}
      {screen === "profileselect" && <ProfileSelect />}
      {screen === "pricing"       && <Pricing />}
      {screen === "payment"       && <Payment />}
      {screen === "settings"      && <Settings />}
    </>
  );
}
