import React from "react";

const Topbar = ({ chat, onToggleMobileSidebar }) => {
  if (!chat) return null;

  return (
    <div className="qx-topbar">
      <div className="qx-topbar-left">
        <button className="qx-mobile-menu" onClick={onToggleMobileSidebar}>
          ☰
        </button>

        <div className="qx-chat-avatar large">
          {chat.avatarLetter || "Q"}
          {chat.isOnline ? <span className="online-dot" /> : null}
        </div>

        <div className="qx-topbar-meta">
          <h3>{chat.displayName}</h3>
          <span>
            {chat.type === "group"
              ? `${chat.participants?.length || 0} members`
              : chat.displaySubtitle || "Direct Message"}
          </span>
        </div>
      </div>

      <div className="qx-topbar-actions">
        <button>🔍</button>
        <button>📞</button>
        <button>⋯</button>
      </div>
    </div>
  );
};

export default Topbar;