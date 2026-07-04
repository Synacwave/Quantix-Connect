import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import ChatWindow from "../components/layout/ChatWindow";
import NewChatModal from "../components/modals/NewChatModal";
import "../styles/chat.css";
import { useAuth } from "../hooks/useAuth";
import { getUserChats } from "../services/chatService";
import { getChatMessages, sendChatMessage } from "../services/messageService";

const formatChatTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const mapChatForUI = (chat, currentUser) => {
  const isGroup = chat.type === "group";

  if (isGroup) {
    return {
      ...chat,
      displayName: chat.name || "Unnamed Group",
      displaySubtitle: chat.description || "Group chat",
      previewText: chat.lastMessage?.text || "No messages yet.",
      displayTime: formatChatTime(chat.lastMessage?.createdAt || chat.updatedAt),
      avatarLetter: (chat.name?.[0] || "G").toUpperCase(),
      isOnline: false,
    };
  }

  const otherUser =
    chat.participants?.find((p) => String(p._id) !== String(currentUser?._id)) ||
    null;

  return {
    ...chat,
    displayName: otherUser?.fullName || otherUser?.username || "Unknown User",
    displaySubtitle: otherUser?.username ? `@${otherUser.username}` : "Direct Message",
    previewText: chat.lastMessage?.text || "No messages yet.",
    displayTime: formatChatTime(chat.lastMessage?.createdAt || chat.updatedAt),
    avatarLetter: (
      otherUser?.fullName?.[0] ||
      otherUser?.username?.[0] ||
      "Q"
    ).toUpperCase(),
    isOnline: false,
  };
};

const HomePage = () => {
  const { user, logout } = useAuth();

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);

  const loadChats = async (preferredChatId = null) => {
    try {
      setLoadingChats(true);
      const data = await getUserChats();

      const mappedChats = (data.chats || []).map((chat) => mapChatForUI(chat, user));
      setChats(mappedChats);

      if (preferredChatId) {
        setActiveChatId(preferredChatId);
        return;
      }

      setActiveChatId((prev) => {
        if (prev && mappedChats.some((chat) => chat._id === prev)) return prev;
        return mappedChats[0]?._id || null;
      });
    } catch (error) {
      console.error("Load chats error:", error);
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    if (user?._id) {
      loadChats();
    }
  }, [user?._id]);

  const activeChat = useMemo(
    () => chats.find((chat) => chat._id === activeChatId) || null,
    [chats, activeChatId]
  );

  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeChatId) {
        setMessages([]);
        return;
      }

      try {
        setLoadingMessages(true);
        const data = await getChatMessages(activeChatId);
        setMessages(data.messages || []);
      } catch (error) {
        console.error("Load messages error:", error);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [activeChatId]);

  const handleSelectChat = (chat) => {
    setActiveChatId(chat._id);
    setMobileSidebarOpen(false);
  };

  const handleSendMessage = async (text) => {
    if (!activeChatId || !text.trim()) return;

    try {
      setSendingMessage(true);
      const data = await sendChatMessage(activeChatId, { text });
      const newMessage = data.data;

      setMessages((prev) => [...prev, newMessage]);

      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat._id === activeChatId
            ? {
                ...chat,
                previewText: newMessage.text,
                displayTime: formatChatTime(newMessage.createdAt),
                lastMessage: newMessage,
              }
            : chat
        )
      );
    } catch (error) {
      console.error("Send message error:", error);
      alert(error?.response?.data?.message || "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleChatCreated = async (newChat) => {
    const newId = newChat._id;
    await loadChats(newId);
    setNewChatOpen(false);
  };

  return (
    <div className="qx-app-shell">
      <div className="qx-bg">
        <span className="qx-orb qx-orb-1"></span>
        <span className="qx-orb qx-orb-2"></span>
        <span className="qx-grid"></span>
      </div>

      <div className="qx-main-layout">
        <div className={`qx-sidebar-wrap ${mobileSidebarOpen ? "mobile-open" : ""}`}>
          <Sidebar
            chats={chats}
            activeChatId={activeChatId}
            onSelectChat={handleSelectChat}
            onOpenNewChat={() => setNewChatOpen(true)}
          />
        </div>

        {mobileSidebarOpen ? (
          <button
            className="qx-mobile-overlay"
            onClick={() => setMobileSidebarOpen(false)}
          />
        ) : null}

        <div className="qx-chat-wrap">
          <div className="qx-app-top-strip">
            <div className="qx-app-top-left">
              <span className="qx-dot live"></span>
              <span>Quantix Connect</span>
            </div>

            <div className="qx-app-top-right">
              <button className="qx-strip-btn" onClick={() => setNewChatOpen(true)}>
                New Chat
              </button>
              <button className="qx-strip-btn" onClick={logout}>
                Logout
              </button>
            </div>
          </div>

          {loadingChats ? (
            <div className="qx-chat-window empty">
              <div className="qx-empty-state">
                <div className="qx-empty-logo">QC</div>
                <h2>Loading Quantix...</h2>
                <p>Pulling your conversations from the abyss.</p>
              </div>
            </div>
          ) : (
            <ChatWindow
              chat={activeChat}
              messages={messages}
              currentUserId={user?._id}
              onSendMessage={handleSendMessage}
              onToggleMobileSidebar={() =>
                setMobileSidebarOpen((prev) => !prev)
              }
              sendingMessage={sendingMessage}
              loadingMessages={loadingMessages}
            />
          )}
        </div>
      </div>

      <NewChatModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onChatCreated={handleChatCreated}
      />
    </div>
  );
};

export default HomePage;