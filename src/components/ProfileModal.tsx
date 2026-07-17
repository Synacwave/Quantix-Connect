import React from "react";
import { motion } from "motion/react";
import { X, MessageSquare, Clock, Shield, Info, Sparkles } from "lucide-react";
import { User } from "../types";

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onStartDirectChat?: (userId: string) => void;
}

export default function ProfileModal({ user, onClose, onStartDirectChat }: ProfileModalProps) {
  const formatLastSeen = (isoString: string) => {
    if (!isoString) return "Unknown";
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 1000 / 60);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;

      return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "Recently";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 15 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        className="w-full max-w-sm bg-slate-950 border border-blue-500/15 rounded-3xl overflow-hidden shadow-2xl relative"
      >
        {/* Top Close Button (Floating) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-white/5 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hero Section with Large Avatar & Status */}
        <div className="relative h-48 bg-gradient-to-b from-blue-900/20 to-slate-950 flex items-end justify-center pb-6 border-b border-blue-500/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative">
            {/* Avatar container */}
            <div className="w-28 h-28 rounded-full border-4 border-slate-950 bg-slate-900 shadow-xl overflow-hidden relative flex items-center justify-center">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-900 flex items-center justify-center text-white text-3xl font-bold">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Pulsing Status Dot */}
            <span className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-slate-950 flex items-center justify-center ${user.status === "online" ? "bg-emerald-500" : "bg-slate-500"}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${user.status === "online" ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
            </span>
          </div>
        </div>

        {/* Profile Info Details */}
        <div className="p-6 space-y-5">
          <div className="text-center space-y-1">
            <h3 className="text-xl font-bold text-white tracking-tight">{user.displayName}</h3>
            <span className="text-sm text-blue-400 font-medium">@{user.username}</span>

            {user.customStatus && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold shadow-sm mt-2 mx-auto">
                <Sparkles className="w-3 h-3 text-blue-400 shrink-0" />
                <span>{user.customStatus}</span>
              </div>
            )}
          </div>

          <div className="space-y-4 pt-1">
            {/* About / Bio Card */}
            <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold tracking-wider uppercase">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                <span>About</span>
              </div>
              <p className="text-slate-200 text-sm leading-relaxed font-light break-words">
                {user.bio || "No bio set yet."}
              </p>
            </div>

            {/* Status indicators */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-3 flex flex-col justify-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Status</span>
                <span className={`text-xs font-bold ${user.status === "online" ? "text-emerald-400" : "text-slate-400"}`}>
                  {user.status === "online" ? "Online" : "Offline"}
                </span>
              </div>

              <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-3 flex flex-col justify-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Last Seen</span>
                <div className="flex items-center gap-1 text-slate-300 text-xs font-medium truncate">
                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{user.status === "online" ? "Active Now" : formatLastSeen(user.lastSeen)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {onStartDirectChat && (
            <div className="pt-2">
              <button
                onClick={() => {
                  onStartDirectChat(user.id);
                  onClose();
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-xs tracking-wide transition shadow-[0_4px_15px_rgba(37,99,235,0.2)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send Direct Message</span>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
