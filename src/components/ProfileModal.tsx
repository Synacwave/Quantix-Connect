import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { X, MessageSquare, Clock, Shield, Info, Sparkles, Flag, ShieldAlert } from "lucide-react";
import { User } from "../types";

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onStartDirectChat?: (userId: string) => void;
}

export default function ProfileModal({ user, onClose, onStartDirectChat }: ProfileModalProps) {
  const isLucy = user.id === "0000000000000000000010c1" || user.id === "00000000000000000000lucy" || user.username.toLowerCase() === "lucy";
  const isSuperAdmin = user.username.toLowerCase() === "expectations";

  const [isBlocked, setIsBlocked] = useState(false);
  const [loadingBlock, setLoadingBlock] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reason, setReason] = useState("Spam");
  const [description, setDescription] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    async function checkBlockStatus() {
      if (isLucy || isSuperAdmin) {
        setLoadingBlock(false);
        return;
      }
      try {
        const response = await fetch("/api/users/blocked", {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          const found = data.some((u: any) => u.id === user.id);
          setIsBlocked(found);
        }
      } catch (err) {
        console.error("Failed to check block status:", err);
      } finally {
        setLoadingBlock(false);
      }
    }
    checkBlockStatus();
  }, [user.id, isLucy]);

  const handleToggleBlock = async () => {
    try {
      const endpoint = isBlocked ? "/api/users/unblock" : "/api/users/block";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ targetId: user.id })
      });
      if (response.ok) {
        setIsBlocked(!isBlocked);
      }
    } catch (err) {
      console.error("Failed to toggle block:", err);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportError("");
    setReportSuccess(false);
    setReportLoading(true);

    if (!description.trim()) {
      setReportError("Description is required.");
      setReportLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/reports/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          reportedUserId: user.id,
          reason,
          description: description.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit report.");
      }

      setReportSuccess(true);
      setDescription("");
    } catch (err: any) {
      setReportError(err.message || "An error occurred.");
    } finally {
      setReportLoading(false);
    }
  };

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
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 15 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        className={`w-full max-w-sm border rounded-3xl overflow-hidden shadow-2xl relative ${
          isLucy 
            ? "bg-gradient-to-b from-purple-950 via-[#0D0D0D] to-[#090909] border-purple-500/30 shadow-[0_0_25px_rgba(168,85,247,0.25)]" 
            : "bg-[#0D0D0D] border-[#1D1D1D]"
        }`}
      >
        {/* Top Close Button (Floating) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-[#090909]/40 hover:bg-[#181818]/80 text-[#A8A8A8] hover:text-white border border-[#1D1D1D] transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hero Section with Large Avatar & Status */}
        <div className={`relative h-48 flex items-end justify-center pb-6 border-b ${
          isLucy 
            ? "from-purple-900/35 to-[#0D0D0D] border-purple-500/20 bg-gradient-to-b" 
            : "from-[#1B3A7A]/10 to-[#0D0D0D] border-[#1D1D1D] bg-gradient-to-b"
        }`}>
          <div className={`absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] via-transparent to-transparent pointer-events-none ${
            isLucy ? "from-purple-600/15" : "from-[#2A5FFF]/5"
          }`} />
          
          <div className="relative">
            {/* Avatar container */}
            <div className={`w-28 h-28 rounded-full border-4 border-[#090909] bg-[#141414] shadow-xl overflow-hidden relative flex items-center justify-center ${
              isLucy ? "ring-2 ring-pink-500/40" : ""
            }`}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center text-3xl font-bold ${
                  isLucy ? "bg-gradient-to-tr from-purple-600 to-pink-500" : "bg-gradient-to-tr from-[#1B3A7A] to-slate-900"
                }`}>
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Pulsing Status Dot */}
            <span className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-[#090909] flex items-center justify-center ${user.status === "online" ? (isLucy ? "bg-pink-500" : "bg-emerald-500") : "bg-slate-500"}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${user.status === "online" ? (isLucy ? "bg-pink-400 animate-pulse" : "bg-emerald-400 animate-pulse") : "bg-slate-400"}`} />
            </span>
          </div>
        </div>

        {/* Profile Info Details */}
        {!showReportForm ? (
          <div className="p-6 space-y-5">
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-white tracking-tight">{user.displayName}</h3>
              <span className={`text-sm font-medium ${isLucy ? "text-purple-300" : "text-[#2A5FFF]"}`}>@{user.username}</span>

              {user.customStatus && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm mt-2 mx-auto ${
                  isLucy 
                    ? "bg-pink-500/10 border-pink-500/20 text-pink-300" 
                    : "bg-[#2A5FFF]/10 border-[#2A5FFF]/20 text-[#2A5FFF]"
                }`}>
                  <Sparkles className={`w-3 h-3 shrink-0 ${isLucy ? "text-pink-400" : "text-[#2A5FFF]"}`} />
                  <span>{user.customStatus}</span>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-1">
              {/* About / Bio Card */}
              <div className={`border rounded-2xl p-4 space-y-2 ${
                isLucy 
                  ? "bg-purple-950/20 border-purple-900/30" 
                  : "bg-[#101010] border-[#1D1D1D]"
              }`}>
                <div className="flex items-center gap-2 text-[#A8A8A8] text-xs font-bold tracking-wider uppercase">
                  {isLucy ? (
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                  ) : (
                    <Info className="w-3.5 h-3.5 text-[#2A5FFF]" />
                  )}
                  <span>About</span>
                </div>
                <p className={`text-sm leading-relaxed font-light break-words ${isLucy ? "text-purple-100" : "text-slate-200"}`}>
                  {user.bio || "No bio set yet."}
                </p>
              </div>

              {/* Status indicators */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`border rounded-xl p-3 flex flex-col justify-center ${isLucy ? "bg-purple-950/10 border-purple-900/20" : "bg-[#101010] border-[#1D1D1D]"}`}>
                  <span className="text-[10px] text-[#707070] uppercase font-bold tracking-wider mb-0.5">Status</span>
                  <span className={`text-xs font-bold ${user.status === "online" ? (isLucy ? "text-pink-400" : "text-emerald-400") : "text-slate-400"}`}>
                    {user.status === "online" ? "Online" : "Offline"}
                  </span>
                </div>

                <div className={`border rounded-xl p-3 flex flex-col justify-center ${isLucy ? "bg-purple-950/10 border-purple-900/20" : "bg-[#101010] border-[#1D1D1D]"}`}>
                  <span className="text-[10px] text-[#707070] uppercase font-bold tracking-wider mb-0.5">Last Seen</span>
                  <div className="flex items-center gap-1 text-slate-300 text-xs font-medium truncate">
                    <Clock className="w-3 h-3 text-[#707070] shrink-0" />
                    <span>{user.status === "online" ? "Active Now" : formatLastSeen(user.lastSeen)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {onStartDirectChat && !isBlocked && (
                <button
                  onClick={() => {
                    onStartDirectChat(user.id);
                    onClose();
                  }}
                  className={`w-full font-bold py-2.5 px-4 rounded-xl text-xs tracking-wide transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
                    isLucy 
                      ? "bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white shadow-[0_4px_15px_rgba(236,72,153,0.3)]" 
                      : "bg-[#1B3A7A] hover:bg-[#224A99] text-white"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Send Direct Message</span>
                </button>
              )}

              {/* Block & Report User buttons */}
              {!isLucy && !isSuperAdmin && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleToggleBlock}
                    className={`font-semibold py-2.5 px-3 rounded-xl text-xs transition active:scale-[0.98] flex items-center justify-center gap-1.5 border cursor-pointer ${
                      isBlocked
                        ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/40"
                        : "bg-[#141414] border-[#1D1D1D] hover:border-red-500/20 text-red-400 hover:bg-[#181818]"
                    }`}
                  >
                    <span>{isBlocked ? "🚫 Unblock" : "🚫 Block User"}</span>
                  </button>

                  <button
                    onClick={() => setShowReportForm(true)}
                    className="bg-[#141414] border border-[#1D1D1D] hover:border-red-500/20 text-[#A8A8A8] hover:text-white hover:bg-[#181818] font-semibold py-2.5 px-3 rounded-xl text-xs transition active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5 text-red-500" />
                    <span>🚩 Report</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Report User</h3>
              <p className="text-xs text-[#707070] mt-1">Report @{user.username} for investigation.</p>
            </div>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              {reportError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3">
                  {reportError}
                </div>
              )}

              {reportSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl p-3">
                  Report submitted successfully! The mod team has been notified.
                </div>
              )}

              {!reportSuccess && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#A8A8A8] tracking-wide">Reason</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-[#141414] border border-[#1D1D1D] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#2A5FFF] appearance-none cursor-pointer"
                    >
                      <option value="Spam">Spam</option>
                      <option value="Harassment">Harassment</option>
                      <option value="Scam">Scam</option>
                      <option value="Fake Account">Fake Account</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#A8A8A8] tracking-wide">Description</label>
                    <textarea
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Please provide details about this issue..."
                      rows={3}
                      className="w-full bg-[#141414] border border-[#1D1D1D] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#2A5FFF] resize-none"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReportForm(false);
                    setReportSuccess(false);
                    setReportError("");
                    setReason("Spam");
                    setDescription("");
                  }}
                  className="w-1/3 bg-[#141414] border border-[#1D1D1D] hover:bg-[#181818] text-[#A8A8A8] hover:text-white font-medium py-2.5 rounded-xl text-xs transition active:scale-[0.98] flex items-center justify-center cursor-pointer"
                >
                  Back
                </button>

                {!reportSuccess && (
                  <button
                    type="submit"
                    disabled={reportLoading}
                    className="w-2/3 bg-[#1B3A7A] hover:bg-[#224A99] active:scale-[0.98] text-white font-semibold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {reportLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      "Submit Report"
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}
