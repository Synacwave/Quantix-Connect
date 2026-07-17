import React, { useState, useEffect } from "react";
import { Search, Settings, Pin, MessageSquare, UserPlus, Circle, LogOut } from "lucide-react";
import { User, Chat } from "../types";

interface SidebarProps {
  currentUser: User;
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chat: Chat) => void;
  onOpenSettings: () => void;
  onStartDirectChat: (partner: User) => void;
}

export default function Sidebar({
  currentUser,
  chats,
  activeChatId,
  onSelectChat,
  onOpenSettings,
  onStartDirectChat
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  // Trigger search on query change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Separate pinned vs unpinned chats
  const sortedChats = [...chats].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleUserSearchResultClick = (user: User) => {
    onStartDirectChat(user);
    setSearchQuery("");
  };

  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    const now = new Date();
    // Check if today
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    // Return date
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full md:w-80 h-full bg-slate-950 border-r border-blue-500/10 flex flex-col select-none">
      {/* Search Header */}
      <div className="p-4 bg-slate-900/30 flex flex-col gap-3">
        {/* Logo or title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-5 h-5 text-blue-500 animate-pulse" />
            <span className="font-extrabold tracking-tight text-white text-base">Quantix Connect</span>
          </div>
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="Open Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users or username..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Dynamic List Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
        {searchQuery.trim() ? (
          // SEARCH RESULTS MODE
          <div className="p-2 space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
              Search Results
            </div>
            {searching ? (
              <div className="flex justify-center py-6">
                <span className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-4 text-xs text-slate-500 text-center">
                No users found matching "{searchQuery}"
              </div>
            ) : (
              searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleUserSearchResultClick(user)}
                  className="w-full p-2.5 rounded-xl hover:bg-slate-900 flex items-center gap-3 transition text-left cursor-pointer border border-transparent hover:border-blue-500/10"
                >
                  <div className="relative shrink-0">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.displayName} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-900/40 flex items-center justify-center text-blue-400 text-sm font-bold">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {user.status === "online" && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-950 rounded-full"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{user.displayName}</div>
                    <div className="text-[10px] text-slate-500 truncate">@{user.username}</div>
                  </div>
                  <UserPlus className="w-4 h-4 text-blue-500/60 shrink-0" />
                </button>
              ))
            )}
          </div>
        ) : (
          // RECENT CHATS MODE
          <div className="p-2 space-y-0.5">
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Chats</span>
              <span className="text-[9px] font-normal text-slate-600">
                {chats.length} active
              </span>
            </div>

            {sortedChats.length === 0 ? (
              <div className="px-4 py-8 text-xs text-slate-600 text-center leading-relaxed">
                No active conversations.<br />
                <span className="text-[10px] text-slate-700">Type in the search box to find users and start a chat!</span>
              </div>
            ) : (
              sortedChats.map((chat) => {
                const partner = chat.otherParticipant;
                if (!partner) return null;
                const isActive = chat.id === activeChatId;

                return (
                  <button
                    key={chat.id}
                    onClick={() => onSelectChat(chat)}
                    className={`w-full p-3 rounded-xl flex items-center gap-3 transition text-left cursor-pointer relative group ${
                      isActive 
                        ? "bg-blue-600/15 border border-blue-500/30 shadow-lg" 
                        : "hover:bg-slate-900/60 border border-transparent hover:border-slate-800"
                    }`}
                  >
                    {/* Avatar with Presence Dot */}
                    <div className="relative shrink-0">
                      {partner.avatarUrl ? (
                        <img src={partner.avatarUrl} alt={partner.displayName} className="w-11 h-11 rounded-full object-cover" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-blue-900/30 flex items-center justify-center text-blue-400 text-sm font-bold">
                          {partner.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {partner.status === "online" && (
                        <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full animate-pulse"></span>
                      )}
                    </div>

                    {/* Chat Text Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-xs font-bold truncate ${isActive ? "text-blue-400" : "text-white"}`}>
                          {partner.displayName}
                        </span>
                        <span className="text-[9px] text-slate-500 shrink-0">
                          {chat.lastMessage ? formatTime(chat.lastMessage.createdAt) : formatTime(chat.updatedAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1.5">
                        <p className="text-[11px] text-slate-400 truncate flex-1 leading-normal">
                          {chat.lastMessage ? (
                            chat.lastMessage.mediaType !== "text" ? (
                              <span className="text-blue-400 italic font-medium flex items-center gap-1">
                                {chat.lastMessage.mediaType === "image" && "📷 Photo"}
                                {chat.lastMessage.mediaType === "voice" && "🎤 Voice message"}
                                {chat.lastMessage.mediaType === "file" && "📂 File attachment"}
                              </span>
                            ) : (
                              chat.lastMessage.text
                            )
                          ) : (
                            <span className="text-slate-600 italic">No messages yet</span>
                          )}
                        </p>

                        {/* Badges / Pin Indicators */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {chat.isPinned && (
                            <Pin className="w-3 h-3 text-blue-500 rotate-45" />
                          )}
                          {chat.unreadCount > 0 && (
                            <span className="bg-blue-600 text-[10px] text-white font-extrabold px-1.5 py-0.5 rounded-full min-w-4 text-center">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* User Footer Profile Card */}
      <div className="p-3 bg-slate-950/80 border-t border-blue-500/10 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.displayName} className="w-9 h-9 rounded-full object-cover border border-blue-500/20" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-900/40 flex items-center justify-center text-blue-400 text-xs font-bold">
                {currentUser.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-slate-950 rounded-full"></span>
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-xs font-extrabold text-white truncate">{currentUser.displayName}</div>
            <div className="text-[9px] text-slate-500 truncate">@{currentUser.username}</div>
          </div>
        </div>
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white transition cursor-pointer"
          title="Profile Settings"
        >
          <Settings className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
}
