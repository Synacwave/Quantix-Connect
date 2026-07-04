import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import Button from "../ui/Button";

const LoginForm = ({ switchMode }) => {
  const { login, authError, setAuthError } = useAuth();

  const [form, setForm] = useState({
    emailOrUsername: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setAuthError("");
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    await login(form);

    setLoading(false);
  };

  return (
    <div className="auth-card">
      <div className="auth-card-glow auth-glow-blue"></div>

      <div className="auth-card-head">
        <p className="auth-kicker">WELCOME BACK</p>
        <h2>Login to Quantix</h2>
        <span>Slide back into your chats.</span>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Email or Username</label>
          <input
            type="text"
            name="emailOrUsername"
            placeholder="great_expectations"
            value={form.emailOrUsername}
            onChange={handleChange}
            required
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>

        {authError ? <div className="auth-error">{authError}</div> : null}

        <Button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </Button>
      </form>

      <p className="auth-switch">
        New here?{" "}
        <button type="button" onClick={switchMode}>
          Create account
        </button>
      </p>
    </div>
  );
};

export default LoginForm;