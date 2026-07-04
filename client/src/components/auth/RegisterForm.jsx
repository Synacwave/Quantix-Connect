import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import Button from "../ui/Button";

const RegisterForm = ({ switchMode }) => {
  const { register, authError, setAuthError } = useAuth();

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
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

    await register(form);

    setLoading(false);
  };

  return (
    <div className="auth-card">
      <div className="auth-card-glow auth-glow-purple"></div>

      <div className="auth-card-head">
        <p className="auth-kicker">JOIN QUANTIX</p>
        <h2>Create your account</h2>
        <span>Lock in a username and start talking reckless.</span>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Full Name</label>
          <input
            type="text"
            name="fullName"
            placeholder="David Synac"
            value={form.fullName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="input-group">
          <label>Username</label>
          <input
            type="text"
            name="username"
            placeholder="great_expectations"
            value={form.username}
            onChange={handleChange}
            required
          />
        </div>

        <div className="input-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            placeholder="Minimum 6 characters"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>

        {authError ? <div className="auth-error">{authError}</div> : null}

        <Button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>

      <p className="auth-switch">
        Already got an account?{" "}
        <button type="button" onClick={switchMode}>
          Login
        </button>
      </p>
    </div>
  );
};

export default RegisterForm;