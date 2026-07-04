import React, { useState } from "react";
import IntroScreen from "./components/intro/IntroScreen";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import { useAuth } from "./hooks/useAuth";

const App = () => {
  const [showIntro, setShowIntro] = useState(true);
  const { isAuthenticated, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#02050b",
          color: "#eef4ff",
        }}
      >
        Loading Quantix...
      </div>
    );
  }

  return (
    <>
      {showIntro && <IntroScreen onFinish={() => setShowIntro(false)} />}
      {!showIntro && (isAuthenticated ? <HomePage /> : <AuthPage />)}
    </>
  );
};

export default App;