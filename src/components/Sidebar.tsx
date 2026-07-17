import React, { useState, useEffect } from "react";
import { Search, Settings, Pin, MessageSquare, UserPlus, Circle, LogOut, Users } from "lucide-react";
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

  // Group creation modal states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupPic, setGroupPic] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [groupSearchResults, setGroupSearchResults] = useState<User[]>([]);
  const [groupSearching, setGroupSearching] = useState(false);

  // Trigger search on query change (main bar)
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

  // Trigger search on query change (for group creation modal)
  useEffect(() => {
    if (!groupSearchQuery.trim()) {
      setGroupSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setGroupSearching(true);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(groupSearchQuery)}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setGroupSearchResults(data);
        }
      } catch (err) {
        console.error("Group search failed:", err);
      } finally {
        setGroupSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [groupSearchQuery]);

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

  const handleEstablishGroup = async () => {
    if (!groupName.trim() || selectedMemberIds.length === 0) return;
    try {
      const response = await fetch("/api/chats/group", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDesc.trim(),
          avatarUrl: groupPic,
          participantIds: selectedMemberIds
        })
      });

      if (response.ok) {
        const newGroupChat = await response.json();
        onSelectChat(newGroupChat);
        
        // Reset and close
        setShowCreateGroupModal(false);
        setGroupName("");
        setGroupDesc("");
        setGroupPic("");
        setSelectedMemberIds([]);
        setGroupSearchQuery("");
        setGroupSearchResults([]);
      }
    } catch (err) {
      console.error("Failed to create group chat:", err);
    }
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Establish Secure Group"
            >
              <UserPlus className="w-4.5 h-4.5 text-blue-400" />
            </button>
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Open Settings"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          </div>
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
                <span className="text-[10px] text-slate-700">Type in the search box or establish a group chat!</span>
              </div>
            ) : (
              sortedChats.map((chat) => {
                const partner = chat.otherParticipant;
                const isGroup = !!chat.isGroup;
                if (!partner && !isGroup) return null;

                const chatName = isGroup ? chat.name || "Group Chat" : (partner?.displayName || "Conversation");
                const chatAvatarUrl = isGroup ? chat.avatarUrl : partner?.avatarUrl;
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
                      {chatAvatarUrl ? (
                        <img src={chatAvatarUrl} alt={chatName} className="w-11 h-11 rounded-full object-cover" />
                      ) : isGroup ? (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-900/40 to-blue-900/40 border border-blue-500/10 flex items-center justify-center text-blue-400 text-sm font-bold shadow-inner">
                          <Users className="w-5 h-5 text-blue-400" />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-blue-900/30 flex items-center justify-center text-blue-400 text-sm font-bold">
                          {chatName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {!isGroup && partner && partner.status === "online" && (
                        <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full animate-pulse"></span>
                      )}
                      {isGroup && (
                        <span className="absolute -bottom-0.5 -right-0.5 bg-blue-950 border border-blue-500/40 text-[8px] px-1 text-blue-400 rounded-md font-mono font-bold uppercase tracking-wider scale-90">
                          GP
                        </span>
                      )}
                    </div>

                    {/* Chat Text Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-xs font-bold truncate ${isActive ? "text-blue-400" : "text-white"}`}>
                          {chatName}
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

      {/* CREATE GROUP CHAT MODAL */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-blue-500/20 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-blue-500/10 flex items-center justify-between bg-slate-950/40">
              <div>
                <h3 className="font-extrabold text-white text-base tracking-tight">Initiate Group Chat</h3>
                <p className="text-[10px] text-slate-500 font-mono">Quantix Secure Encrypted Protocol</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setGroupName("");
                  setGroupDesc("");
                  setGroupPic("");
                  setSelectedMemberIds([]);
                  setGroupSearchQuery("");
                  setGroupSearchResults([]);
                }}
                className="text-slate-400 hover:text-white font-bold text-xs p-1 hover:bg-slate-800 rounded-lg transition"
              >
                Cancel
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
              {/* Profile Pic Upload & Name */}
              <div className="flex gap-4 items-center">
                <div className="relative shrink-0">
                  {groupPic ? (
                    <img src={groupPic} alt="Group preview" className="w-16 h-16 rounded-2xl object-cover border border-blue-500/20" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-blue-950/50 border border-blue-500/10 flex flex-col items-center justify-center text-blue-400 cursor-pointer hover:bg-blue-900/20 transition">
                      <Users className="w-6 h-6" />
                      <span className="text-[8px] font-bold mt-1 uppercase tracking-wider">Upload</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setGroupPic(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>

                <div className="flex-1 space-y-1">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500">Group Name</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Quantum Core Devs"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              {/* Group Description */}
              <div className="space-y-1">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500">Description (Optional)</label>
                <input
                  type="text"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="What is this secure channel about?"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {/* Selected Members Tags */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Selected Members ({selectedMemberIds.length})
                </label>
                {selectedMemberIds.length === 0 ? (
                  <div className="text-[11px] text-slate-600 italic">No members selected. Add people below.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1.5 bg-slate-950/40 rounded-xl border border-slate-800">
                    {selectedMemberIds.map(id => {
                      const foundUser = groupSearchResults.find(u => u.id === id) || chats.flatMap(c => c.participants || []).find(p => p.id === id);
                      if (!foundUser) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1 bg-blue-950/50 border border-blue-500/20 text-blue-400 text-[10px] font-bold pl-2 pr-1 py-0.5 rounded-lg">
                          {foundUser.displayName}
                          <button
                            onClick={() => setSelectedMemberIds(prev => prev.filter(mid => mid !== id))}
                            className="hover:bg-blue-900/50 rounded p-0.5 text-blue-300 font-extrabold text-[8px] leading-none"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Members Search */}
              <div className="space-y-2">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500">Search Users to Add</label>
                <div className="relative">
                  <input
                    type="text"
                    value={groupSearchQuery}
                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                    placeholder="Search user to add..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>

                <div className="space-y-1 max-h-36 overflow-y-auto border border-slate-800/60 rounded-xl divide-y divide-slate-800/40">
                  {groupSearchQuery.trim() === "" ? (
                    // Show recent direct chat partners as convenient recommendations
                    chats.map(c => c.otherParticipant).filter((p): p is User => !!p).slice(0, 5).map(user => {
                      const isSelected = selectedMemberIds.includes(user.id);
                      return (
                        <div key={user.id} className="flex items-center justify-between p-2 text-xs">
                          <div className="flex items-center gap-2">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-300">
                                {user.displayName.charAt(0)}
                              </div>
                            )}
                            <span className="font-medium text-white">{user.displayName}</span>
                          </div>
                          <button
                            onClick={() => {
                              if (isSelected) {
                                setSelectedMemberIds(prev => prev.filter(id => id !== user.id));
                              } else {
                                setSelectedMemberIds(prev => [...prev, user.id]);
                              }
                            }}
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg transition cursor-pointer ${
                              isSelected 
                                ? "bg-red-950/40 border border-red-500/20 text-red-400 hover:bg-red-900/30"
                                : "bg-blue-950/40 border border-blue-500/20 text-blue-400 hover:bg-blue-900/30"
                            }`}
                          >
                            {isSelected ? "Remove" : "Add"}
                          </button>
                        </div>
                      );
                    })
                  ) : groupSearching ? (
                    <div className="text-center py-4 text-xs text-slate-500">Searching...</div>
                  ) : groupSearchResults.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500">No matching users.</div>
                  ) : (
                    groupSearchResults.map(user => {
                      const isSelected = selectedMemberIds.includes(user.id);
                      return (
                        <div key={user.id} className="flex items-center justify-between p-2 text-xs">
                          <div className="flex items-center gap-2">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-300">
                                {user.displayName.charAt(0)}
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-white block">{user.displayName}</span>
                              <span className="text-[8px] text-slate-500 font-mono">@{user.username}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (isSelected) {
                                setSelectedMemberIds(prev => prev.filter(id => id !== user.id));
                              } else {
                                setSelectedMemberIds(prev => [...prev, user.id]);
                              }
                            }}
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg transition cursor-pointer ${
                              isSelected 
                                ? "bg-red-950/40 border border-red-500/20 text-red-400 hover:bg-red-900/30"
                                : "bg-blue-950/40 border border-blue-500/20 text-blue-400 hover:bg-blue-900/30"
                            }`}
                          >
                            {isSelected ? "Remove" : "Add"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-950/40 border-t border-blue-500/10 flex justify-end gap-2">
              <button
                onClick={handleEstablishGroup}
                disabled={!groupName.trim() || selectedMemberIds.length === 0}
                className="bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition shadow-lg shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Establish Secure Group</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
