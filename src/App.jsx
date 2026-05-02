// ─── src/App.jsx ──────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { useApp } from "./context/AppContext.jsx";
import { XpPopup } from "./components/SharedUI.jsx";
import Landing       from "./pages/Landing.jsx";
import Auth          from "./pages/Auth.jsx";
import Chat          from "./pages/Chat.jsx";
import Onboarding    from "./pages/Onboarding.jsx";
import ProfileSelect from "./pages/ProfileSelect.jsx";
import { Pricing, Settings } from "./pages/Pricing.jsx";

export default function App() {
  const { screen, setScreen, xpPopup, currentUser, hasProfile } = useApp();

  // ── Onboarding guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "chat") return;
    if (currentUser && !hasProfile) {
      setScreen("onboarding");
    }
  }, [screen, currentUser, hasProfile]);

  return (
    <div style={{ width: "100%", maxWidth: "100%", margin: 0, padding: 0, overflowX: "hidden" }}>
      <XpPopup popup={xpPopup} />

      {screen === "landing"       && <Landing />}
      {screen === "auth"          && <Auth />}
      {screen === "chat"          && <Chat />}
      {screen === "onboarding"    && <Onboarding />}
      {screen === "profileselect" && <ProfileSelect />}
      {screen === "pricing"       && <Pricing />}
      {screen === "settings"      && <Settings />}
    </div>
  );
}
