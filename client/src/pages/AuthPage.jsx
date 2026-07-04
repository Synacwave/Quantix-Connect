import React, { useState } from "react";
import LoginForm from "../components/auth/LoginForm";
import RegisterForm from "../components/auth/RegisterForm";
import "../styles/auth.css";

const AuthPage = () => {
  const [mode, setMode] = useState("login");

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <span className="auth-orb auth-orb-1"></span>
        <span className="auth-orb auth-orb-2"></span>
        <span className="auth-grid"></span>
      </div>

      <div className="auth-shell">
        <section className="auth-left-panel">
          <div className="brand-badge">QC</div>

          <p className="brand-mini">REAL-TIME. DARK. CLEAN.</p>
          <h1>
            Quantix <span>Connect</span>
          </h1>
          <p className="brand-copy">
            A dark glass real-time chat experience built for direct messages,
            group spaces, and clean motion.
          </p>

          <div className="brand-pills">
            <span>Realtime Messaging</span>
            <span>Groups</span>
            <span>Secure Login</span>
            <span>Dark Glass UI</span>
          </div>

          <div className="brand-credit">
            Powered by <strong>Expectations × Dark Heart</strong>
          </div>
        </section>

        <section className="auth-right-panel">
          {mode === "login" ? (
            <LoginForm switchMode={() => setMode("register")} />
          ) : (
            <RegisterForm switchMode={() => setMode("login")} />
          )}
        </section>
      </div>
    </div>
  );
};

export default AuthPage;