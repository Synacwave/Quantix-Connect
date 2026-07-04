import React, { useState } from "react";

const MessageInput = ({ onSend, disabled }) => {
  const [message, setMessage] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmed = message.trim();
    if (!trimmed) return;

    onSend(trimmed);
    setMessage("");
  };

  return (
    <form className="qx-message-input-wrap" onSubmit={handleSubmit}>
      <button type="button" className="qx-input-icon">
        ＋
      </button>

      <input
        type="text"
        placeholder="Type something reckless..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={disabled}
      />

      <button type="submit" className="qx-send-btn" disabled={disabled}>
        Send
      </button>
    </form>
  );
};

export default MessageInput;