import React from "react";

const MessageBubble = ({ message, isMe }) => {
  return (
    <div className={`qx-message-row ${isMe ? "me" : "them"}`}>
      <div className={`qx-message-bubble ${isMe ? "me" : "them"}`}>
        <p>{message.text}</p>
        <span>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;