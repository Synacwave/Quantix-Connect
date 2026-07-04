import React from "react";
import quantixLogo from "../../assets/quantix-logo.svg";

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <div className="auth-shell">
      <div className="auth-bg-orb auth-bg-orb-1" />
      <div className="auth-bg-orb auth-bg-orb-2" />
      <div className="auth-grid-lines" />

      <div className="auth-card glass-card">
        <div className="auth-brand">
          <img
            src={quantixLogo}
            alt="Quantix Connect"
            className="qx-logo auth-logo"
          />
        </div>

        <div className="auth-copy">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        <div className="auth-body">{children}</div>

        {footer ? <div className="auth-footer">{footer}</div> : null}
      </div>
    </div>
  );
}