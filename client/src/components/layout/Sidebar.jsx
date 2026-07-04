import React from "react";
import quantixMark from "../../assets/quantix-mark.svg";

export default function Sidebar({
  user,
  chats = [],
  selectedChat,
  onSelectChat,
  onOpenNewChat,
  onLogout,
}) {
  const activeChatId = selectedChat?._id || selectedChat?.id;

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <img src={quantixMark} alt="Quantix" className="qx-mark" />
          <div className="sidebar-brand-copy">
            <h2>Quantix</h2>
            <span>Connect</span>
          </div>
        </div>

        <button className="new-chat-btn" onClick={onOpenNewChat}>
          + New Chat
        </button>
      </div>

      <div className="sidebar-search">
        <div className="sidebar-search-box">
          <span className="sidebar-search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search chats..."
            disabled
          />
        </div>
      </div>

      <div className="chat-list">
        {chats.length === 0 ? (
          <div className="empty-chat-state">
            <div className="empty-chat-icon">💬</div>
            <h4>No chats yet</h4>
            <p>Start a DM or create a group to begin.</p>
          </div>
        ) : (
          chats.map((chat) => {
            const chatId = chat._id || chat.id;
            const isActive = String(chatId) === String(activeChatId);

            return (
              <button
                key={chatId}
                className={`chat-list-item ${isActive ? "active" : ""}`}
                onClick={() => onSelectChat(chat)}
              >
                <div className="chat-avatar">
                  {chat.avatarLetter || chat.displayName?.[0] || "Q"}
                </div>

                <div className="chat-meta">
                  <div className="chat-meta-top">
                    <h4>{chat.displayName || "Unnamed Chat"}</h4>
                    <span>{chat.displayTime || ""}</span>
                  </div>

                  <div className="chat-meta-bottom">
                    <p>{chat.previewText || "No messages yet."}</p>
                    {chat.unreadCount > 0 ? (
                      <div className="chat-unread-badge">
                        {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                      </div>
                    ) : null}
                  </div>

                  {chat.displaySubtitle ? (
                    <small className="chat-subtitle">{chat.displaySubtitle}</small>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="sidebar-user glass-subpanel">
        <div className="sidebar-user-avatar">
          {user?.fullName?.[0] || user?.username?.[0] || "Q"}
        </div>

        <div className="sidebar-user-meta">
          <h4>{user?.fullName || "Quantix User"}</h4>
          <span>
            {user?.username ? `@${user.username}` : "Connected"}
          </span>
        </div>

        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}