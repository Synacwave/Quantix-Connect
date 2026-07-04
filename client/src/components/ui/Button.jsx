import React from "react";

const Button = ({
  children,
  type = "button",
  onClick,
  className = "",
  disabled = false,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`qx-btn ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;