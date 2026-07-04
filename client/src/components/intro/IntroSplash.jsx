import React from "react";
import quantixLogo from "../../assets/quantix-logo.svg";

export default function IntroSplash() {
  return (
    <div className="intro-splash">
      <div className="intro-noise" />
      <div className="intro-glow intro-glow-1" />
      <div className="intro-glow intro-glow-2" />

      <div className="intro-content">
        <div className="intro-logo-wrap">
          <img
            src={quantixLogo}
            alt="Quantix Connect"
            className="qx-logo intro-logo"
          />
        </div>

        <div className="intro-copy">
          <p className="intro-tagline">Secure chats. Dark glass. Clean signal.</p>
          <span className="intro-powered">
            Powered by Expectations × Dark Heart
          </span>
        </div>
      </div>
    </div>
  );
}