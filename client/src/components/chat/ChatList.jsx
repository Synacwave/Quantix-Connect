import React from "react";

const ChatList = ({ chats, activeChatId, onSelectChat }) => {
  if (!chats.length) {
    return <div className="qx-chatlist-empty">No chats yet. Start one.</div>;
  }

  return (
    <div className="qx-chat-list">
      {chats.map((chat) => (
        <button
          key={chat._id}
          className={`qx-chat-item ${activeChatId === chat._id ? "active" : ""}`}
          onClick={() => onSelectChat(chat)}
        >
          <div className="qx-chat-avatar">
            {chat.avatarLetter || "Q"}
            {chat.isOnline ? <span className="online-dot" /> : null}
          </div>

          <div className="qx-chat-body">
            <div className="qx-chat-row">
              <strong>{chat.displayName}</strong>
              <span>{chat.displayTime || ""}</span>
            </div>

            <div className="qx-chat-row qx-chat-subrow">
              <p>{chat.previewText || "No messages yet."}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ChatList;