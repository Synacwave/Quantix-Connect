import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Zap, Github, ArrowUpRight, Lock, Send } from "lucide-react";
import { User, Chat, Message } from "./types";
import LoginScreen from "./components/LoginScreen";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import SettingsModal from "./components/SettingsModal";
import ProfileModal from "./components/ProfileModal";
import AdminModal from "./components/AdminModal";

function playNotificationSound(type: "incoming" | "outgoing" = "incoming") {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === "incoming") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1);
      gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc2.start(ctx.currentTime + 0.1);
      osc2.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch (e) {
    // Context blocked or unsupported
  }
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Track typing states: userId -> boolean
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  
  const [showSettings, setShowSettings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3800);
    return () => clearTimeout(timer);
  }, []);
  
  const socketRef = useRef<any>(null);

  // 1. Initial auth fetch
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
        } else {
          // Token expired or invalid
          handleLogout();
        }
      } catch (err) {
        console.error("Failed to fetch user details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, [token]);

  // 2. Fetch chats once authenticated
  const fetchChats = async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/chats", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const chatsData = await response.json();
        setChats(chatsData);
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchChats();
    }
  }, [currentUser]);

  // Keep activeChat updated when chats array changes (e.g. metadata updates)
  useEffect(() => {
    if (activeChat) {
      const updatedChat = chats.find(c => c.id === activeChat.id);
      if (updatedChat) {
        if (
          updatedChat.name !== activeChat.name ||
          updatedChat.description !== activeChat.description ||
          updatedChat.avatarUrl !== activeChat.avatarUrl ||
          updatedChat.participants?.length !== activeChat.participants?.length ||
          updatedChat.admins?.length !== activeChat.admins?.length ||
          JSON.stringify(updatedChat.participants?.map((p: any) => p.id)) !== JSON.stringify(activeChat.participants?.map((p: any) => p.id)) ||
          JSON.stringify(updatedChat.admins) !== JSON.stringify(activeChat.admins)
        ) {
          setActiveChat(updatedChat);
        }
      }
    }
  }, [chats, activeChat]);

  // 3. Socket connection management
  useEffect(() => {
    if (!currentUser || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Initialize socket connection
    const socketUrl = window.location.origin;
    const socket = io(socketUrl, {
      auth: { token }
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("🟢 Quantix Socket: Connected to real-time server!");
    });

    // Real-time user presence updates
    socket.on("user_status", ({ userId, status, lastSeen }: { userId: string; status: "online" | "offline"; lastSeen: string }) => {
      // Update status in current chats list
      setChats((prevChats) => 
        prevChats.map((c) => {
          if (c.otherParticipant?.id === userId) {
            return {
              ...c,
              otherParticipant: {
                ...c.otherParticipant,
                status,
                lastSeen
              }
            };
          }
          return c;
        })
      );

      // If viewing a chat with this user, update active chat details too
      setActiveChat((prevActive) => {
        if (prevActive?.otherParticipant?.id === userId) {
          return {
            ...prevActive,
            otherParticipant: {
              ...prevActive.otherParticipant,
              status,
              lastSeen
            }
          };
        }
        return prevActive;
      });
    });

    // Receive live messages
    socket.on("new_message", (message: Message) => {
      if (message.senderId === "000000000000000000000000") {
        fetchChats();
      }

      if (currentUser && message.senderId !== currentUser.id) {
        playNotificationSound("incoming");
      }

      setActiveChat((prevActive) => {
        if (prevActive && prevActive.id === message.chatId) {
          // If viewing this chat, add message to log and mark read
          setMessages((prevMsgs) => {
            // Guard against duplicates (idempotency)
            if (prevMsgs.some((m) => m.id === message.id)) return prevMsgs;
            return [...prevMsgs, message];
          });

          // Trigger read receipt on server via socket
          socket.emit("read_chat", { chatId: prevActive.id });
          return prevActive;
        }
        return prevActive;
      });

      // Update unread counts and last message in recent list
      setChats((prevChats) => {
        const idx = prevChats.findIndex((c) => c.id === message.chatId);
        if (idx === -1) {
          // If chat doesn't exist, reload chats list
          fetchChats();
          return prevChats;
        }

        const updatedChats = [...prevChats];
        const chat = updatedChats[idx];
        const isCurrentlyOpen = activeChat?.id === message.chatId;

        updatedChats[idx] = {
          ...chat,
          updatedAt: message.createdAt,
          lastMessage: {
            id: message.id,
            text: message.text,
            mediaType: message.mediaType,
            senderId: message.senderId,
            createdAt: message.createdAt
          },
          unreadCount: isCurrentlyOpen || message.senderId === currentUser.id
            ? 0 
            : chat.unreadCount + 1
        };

        return updatedChats;
      });
    });

    // Chat list updates (re-order, notifications)
    socket.on("chat_update", ({ chatId, message }: { chatId: string; message: any }) => {
      setChats((prevChats) => {
        const idx = prevChats.findIndex((c) => c.id === chatId);
        if (idx === -1) {
          fetchChats();
          return prevChats;
        }

        const updated = [...prevChats];
        updated[idx] = {
          ...updated[idx],
          updatedAt: message.createdAt,
          lastMessage: message,
          unreadCount: activeChat?.id === chatId || message.senderId === currentUser.id
            ? 0
            : (updated[idx].unreadCount || 0) + 1
        };
        return updated;
      });
    });

    // Live typing indicators
    socket.on("user_typing", ({ chatId, userId, displayName, isTyping }: { chatId: string; userId: string; displayName: string; isTyping: boolean }) => {
      if (activeChat && activeChat.id === chatId) {
        setTypingUsers((prev) => ({
          ...prev,
          [userId]: isTyping
        }));
      }
    });

    // Mark messages read receipts
    socket.on("messages_read", ({ chatId, readBy }: { chatId: string; readBy: string }) => {
      if (activeChat && activeChat.id === chatId) {
        setMessages((prevMsgs) => 
          prevMsgs.map((m) => {
            if (!m.readBy.includes(readBy)) {
              return { ...m, readBy: [...m.readBy, readBy] };
            }
            return m;
          })
        );
      }
    });

    // Delete message event
    socket.on("message_deleted", ({ chatId, messageId }: { chatId: string; messageId: string }) => {
      if (activeChat && activeChat.id === chatId) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      
      // Update last message snippet if it was deleted
      setChats((prevChats) => 
        prevChats.map((c) => {
          if (c.id === chatId && c.lastMessage?.id === messageId) {
            return {
              ...c,
              lastMessage: null // Simplified reload, or can let backend re-evaluate
            };
          }
          return c;
        })
      );
    });

    // Edit message event
    socket.on("message_edited", ({ chatId, messageId, text }: { chatId: string; messageId: string; text: string }) => {
      setMessages((prevMsgs) =>
        prevMsgs.map((m) => {
          if (m.id === messageId) {
            return { ...m, text };
          }
          return m;
        })
      );

      // Also update last message in sidebar
      setChats((prevChats) => 
        prevChats.map((c) => {
          if (c.id === chatId && c.lastMessage?.id === messageId) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                text
              }
            };
          }
          return c;
        })
      );
    });

    // Receive message updates (reactions, poll votes)
    socket.on("message_updated", ({ messageId, update }: { messageId: string; update: Partial<Message> }) => {
      setMessages((prevMsgs) =>
        prevMsgs.map((m) => {
          if (m.id === messageId) {
            return { ...m, ...update };
          }
          return m;
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser, token, activeChat]);

  // 4. Handle active chat selection and load messages
  const handleSelectChat = async (chat: Chat) => {
    setActiveChat(chat);
    setTypingUsers({});

    // Mark locally as read
    setChats((prevChats) => 
      prevChats.map((c) => c.id === chat.id ? { ...c, unreadCount: 0 } : c)
    );

    try {
      const response = await fetch(`/api/chats/${chat.id}/messages`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const messagesData = await response.json();
        setMessages(messagesData);
        
        // Let server and other client know these messages are read
        if (socketRef.current) {
          socketRef.current.emit("join_chat", chat.id);
          socketRef.current.emit("read_chat", { chatId: chat.id });
        }
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  // Close active chat room listeners when going back
  const handleBackToSidebar = () => {
    if (activeChat && socketRef.current) {
      socketRef.current.emit("leave_chat", activeChat.id);
    }
    setActiveChat(null);
  };

  const handleSendMessage = async (
    text: string, 
    mediaUrl?: string, 
    mediaType?: "text" | "image" | "voice" | "file" | "poll",
    replyTo?: any,
    poll?: any,
    selfDestructIn?: number
  ) => {
    if (!activeChat || !token) return;

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          chatId: activeChat.id,
          text,
          mediaUrl,
          mediaType: mediaType || "text",
          replyTo,
          poll,
          selfDestructIn
        })
      });

      if (response.ok) {
        const savedMsg = await response.json();
        
        playNotificationSound("outgoing");

        if (savedMsg.senderId === "000000000000000000000000") {
          fetchChats();
        }
        
        // Optimistic / Direct update to messages list (duplicate checks are run in Socket listener)
        setMessages((prev) => {
          if (prev.some((m) => m.id === savedMsg.id)) return prev;
          return [...prev, savedMsg];
        });

        // Trigger local recent chats list update
        setChats((prevChats) => 
          prevChats.map((c) => {
            if (c.id === activeChat.id) {
              return {
                ...c,
                updatedAt: savedMsg.createdAt,
                lastMessage: {
                  id: savedMsg.id,
                  text: savedMsg.text,
                  mediaType: savedMsg.mediaType,
                  senderId: savedMsg.senderId,
                  createdAt: savedMsg.createdAt
                }
              };
            }
            return c;
          })
        );
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!token || !activeChat) return;
    try {
      const response = await fetch("/api/messages/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ messageId })
      });

      if (response.ok) {
        // Remove locally
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        
        // Notify socket so other tabs/devices of current user filter it out
        if (socketRef.current) {
          socketRef.current.emit("delete_message", { chatId: activeChat.id, messageId });
        }
      }
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const handleTogglePinChat = async (chatId: string) => {
    if (!token) return;
    try {
      const response = await fetch("/api/chats/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ chatId })
      });

      if (response.ok) {
        const data = await response.json();
        setChats((prev) => 
          prev.map((c) => c.id === chatId ? { ...c, isPinned: data.isPinned } : c)
        );
        if (activeChat?.id === chatId) {
          setActiveChat((prev) => prev ? { ...prev, isPinned: data.isPinned } : null);
        }
      }
    } catch (err) {
      console.error("Failed to pin/unpin chat:", err);
    }
  };

  const handleStartDirectChat = async (partner: User) => {
    if (!token) return;
    try {
      const response = await fetch("/api/chats/direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ partnerId: partner.id })
      });

      if (response.ok) {
        const chat = await response.json();
        
        // Add chat to sidebar if not present
        setChats((prev) => {
          if (prev.some((c) => c.id === chat.id)) return prev;
          return [chat, ...prev];
        });

        // Open chat immediately
        handleSelectChat(chat);
      }
    } catch (err) {
      console.error("Failed to establish direct chat:", err);
    }
  };

  const handleAuthSuccess = (newToken: string, authenticatedUser: User) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setCurrentUser(authenticatedUser);
  };

  const handleLogout = async () => {
    localStorage.removeItem("token");
    setToken(null);
    setCurrentUser(null);
    setActiveChat(null);
    setChats([]);
    setMessages([]);
    setShowSettings(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse mb-6">
          <MessageSquare className="w-8 h-8 text-white" />
        </div>
        <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full w-1/2 animate-[shimmer_1.5s_infinite_linear]"></div>
        </div>
      </div>
    );
  }

  if (showSplash) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-black text-slate-100 flex flex-col relative select-none">
        <AnimatePresence mode="wait">
          <motion.div
            key="splash-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -50, transition: { duration: 0.8, ease: "easeInOut" } }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
          >
            {/* Ambient Background Glows */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_50%)] pointer-events-none opacity-80" />
            
            {/* Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.01)_1px,transparent_1px)] bg-[size:40px_40px] opacity-70" />

            <div className="relative flex flex-col items-center max-w-lg text-center px-6">
              
              {/* Logo icon */}
              <motion.div
                initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
                animate={{ scale: [0.3, 1.1, 1], opacity: 1, rotate: 0 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="w-20 h-20 bg-blue-600 rounded-[28px] flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.4)] border border-blue-400/30 mb-8 relative"
              >
                <MessageSquare className="w-10 h-10 text-white fill-white/10" />
                <motion.div 
                  className="absolute inset-0 rounded-[28px] border border-blue-400"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                />
              </motion.div>

              {/* Quantix Connect Title */}
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                className="text-4xl font-extrabold tracking-tighter text-white uppercase drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]"
              >
                Quantix Connect
              </motion.h1>

              {/* Glowing divider line */}
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 140, opacity: 1 }}
                transition={{ delay: 0.8, duration: 1, ease: "easeInOut" }}
                className="h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent my-6"
              />

              {/* Built by expectations subtitle */}
              <motion.div
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.6, duration: 0.8, ease: "easeOut" }}
                className="space-y-2"
              >
                <span className="text-[10px] font-mono tracking-[0.25em] text-slate-500 uppercase block">
                  Secure Protocol Core
                </span>
                <p className="text-xs text-blue-400 font-medium tracking-wide">
                  built by <span className="text-white font-semibold">Expectations</span> for <span className="text-blue-400 font-bold">Quantix Tech</span>
                </p>
              </motion.div>
            </div>

            {/* Bottom Version Indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.2, duration: 0.6 }}
              className="absolute bottom-6 text-[9px] font-mono tracking-widest text-slate-600 uppercase"
            >
              System Ver: v3.4.1 // SECURE_LINK
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="h-[100dvh] w-full max-w-full overflow-hidden bg-slate-950 text-slate-100 flex flex-col relative select-none">
      
      {/* Real-time full-page messaging content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar Left Pane */}
        <div className={`${activeChat ? "hidden md:flex" : "flex"} w-full md:w-auto`}>
          <Sidebar
            currentUser={currentUser}
            chats={chats}
            activeChatId={activeChat?.id || null}
            onSelectChat={handleSelectChat}
            onOpenSettings={() => setShowSettings(true)}
            onStartDirectChat={handleStartDirectChat}
            onViewUserProfile={setSelectedProfileUser}
            onOpenAdmin={() => setShowAdmin(true)}
          />
        </div>

        {/* Chat Logs Pane */}
        <div className={`${activeChat ? "flex" : "hidden md:flex"} flex-1 h-full min-w-0`}>
          {activeChat ? (
            <ChatView
              currentUser={currentUser}
              activeChat={activeChat}
              messages={messages}
              typingUsers={typingUsers}
              socket={socketRef.current}
              onBack={handleBackToSidebar}
              onSendMessage={handleSendMessage}
              onDeleteMessage={handleDeleteMessage}
              onTogglePin={handleTogglePinChat}
            />
          ) : (
            // EMPTY CHAT VIEW
            <div className="flex-1 h-full bg-radial from-slate-950 via-slate-950 to-black flex flex-col items-center justify-center p-8 select-none text-center">
              <div className="w-20 h-20 bg-blue-950/40 border border-blue-500/10 rounded-3xl flex items-center justify-center mb-6 shadow-inner animate-pulse">
                <Lock className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">End-to-End Encrypted Sandbox</h2>
              <p className="text-slate-500 text-xs max-w-sm mt-2 leading-relaxed">
                Welcome to <strong className="text-blue-500 font-extrabold">Quantix Connect</strong>. Select a chat in the left panel or type in the search bar to locate other users and start messaging securely.
              </p>
              
              <div className="mt-10 flex gap-6 items-center justify-center text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-500" />
                  <span>Real-time Websockets</span>
                </span>
                <span className="w-1.5 h-1.5 bg-slate-800 rounded-full"></span>
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-500" />
                  <span>Audio & Media uploads</span>
                </span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Settings Panel Modal */}
      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            user={currentUser}
            onClose={() => setShowSettings(false)}
            onUpdateUser={(updated) => setCurrentUser(updated)}
            onLogout={handleLogout}
          />
        )}
      </AnimatePresence>

      {/* Profile Detail Modal Layer */}
      <AnimatePresence>
        {selectedProfileUser && (
          <ProfileModal
            user={selectedProfileUser}
            onClose={() => setSelectedProfileUser(null)}
            onStartDirectChat={(partnerId) => {
              const partner = chats.flatMap(c => c.participants).find(p => p.id === partnerId) || selectedProfileUser;
              handleStartDirectChat(partner);
            }}
          />
        )}
      </AnimatePresence>

      {/* Admin Panel Modal Layer */}
      <AnimatePresence>
        {showAdmin && (
          <AdminModal
            onClose={() => setShowAdmin(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
