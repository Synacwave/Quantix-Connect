import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import IntroSplash from "../components/intro/IntroSplash";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();

  const [showSplash, setShowSplash] = useState(true);
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2600);

    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e) => {
    setError("");
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.email.trim() || !form.password.trim()) {
      setError("Enter your email and password.");
      return;
    }

    try {
      setSubmitting(true);
      await login({
        email: form.email.trim(),
        password: form.password,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Couldn’t sign you in. Check your details and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (showSplash) {
    return <IntroSplash />;
  }

  if (!loading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log into Quantix Connect and step back into the signal."
      footer={
        <p className="auth-switch-text">
          Don’t have an account? <Link to="/register">Create one</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error ? <div className="auth-error">{error}</div> : null}

        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className="auth-submit-btn"
          disabled={submitting}
        >
          {submitting ? "Signing in..." : "Login"}
        </button>
      </form>
    </AuthLayout>
  );
}