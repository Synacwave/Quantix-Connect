import React from "react";
import Topbar from "./Topbar";
import MessageBubble from "../chat/MessageBubble";
import MessageInput from "../chat/MessageInput";

const ChatWindow = ({
  chat,
  messages = [],
  currentUserId,
  onSendMessage,
  onToggleMobileSidebar,
  sendingMessage,
  loadingMessages,
}) => {
  if (!chat) {
    return (
      <section className="qx-chat-window empty">
        <div className="qx-empty-state">
          <div className="qx-empty-logo">QC</div>
          <h2>Select a chat</h2>
          <p>
            Pick a DM or group from the sidebar to start sending messages on
            Quantix Connect.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="qx-chat-window">
      <Topbar chat={chat} onToggleMobileSidebar={onToggleMobileSidebar} />

      <div className="qx-messages-area">
        {loadingMessages ? (
          <div className="qx-chatlist-empty">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="qx-chatlist-empty">No messages yet. Say something reckless.</div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message._id}
              message={message}
              isMe={message.sender?._id === currentUserId}
            />
          ))
        )}
      </div>

      <MessageInput onSend={onSendMessage} disabled={sendingMessage} />
    </section>
  );
};

export default ChatWindow;