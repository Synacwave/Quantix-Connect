import React, { useEffect, useState } from "react";
import "./IntroScreen.css";

const IntroScreen = ({ onFinish }) => {
  const [hide, setHide] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setHide(true), 3200);
    const doneTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 4000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div className={`intro-screen ${hide ? "fade-out" : ""}`}>
      <div className="intro-bg">
        <span className="orb orb-1"></span>
        <span className="orb orb-2"></span>
        <span className="orb orb-3"></span>
      </div>

      <div className="intro-content">
        <div className="intro-logo-wrap">
          <div className="intro-logo-ring"></div>
          <h1 className="intro-title">QUANTIX CONNECT</h1>
        </div>

        <div className="intro-line"></div>

        <p className="intro-subtitle">
          Powered by <span>Expectations × Dark Heart</span>
        </p>
      </div>
    </div>
  );
};

export default IntroScreen;