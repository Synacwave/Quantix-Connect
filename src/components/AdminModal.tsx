import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Shield, ShieldAlert, Ban, User, Search, AlertTriangle, ShieldCheck, Clock, FileText } from "lucide-react";
import { User as UserType } from "../types";

interface AdminModalProps {
  onClose: () => void;
}

interface AdminUserDetail {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  status: string;
  lastSeen: string;
  isBanned: boolean;
  bannedUntil?: string;
  bio?: string;
  customStatus?: string;
  createdAt?: string;
  isAdmin?: boolean;
}

interface ReportDetail {
  id: string;
  type: string;
  reporterId: string;
  category: string;
  reason?: string;
  title?: string;
  description: string;
  screenshot?: string;
  messagesContext?: Array<{
    senderUsername: string;
    senderId: string;
    text: string;
    createdAt: string;
  }>;
  createdAt: string;
}

export default function AdminModal({ onClose }: AdminModalProps) {
  const [users, setUsers] = useState<AdminUserDetail[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetail | null>(null);
  const [reports, setReports] = useState<ReportDetail[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [banDurationDays, setBanDurationDays] = useState<number>(1);
  const [isPermanentBan, setIsPermanentBan] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const token = localStorage.getItem("token");

  // Broadcast State
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState("");
  const [broadcastError, setBroadcastError] = useState("");

  const handleSendBroadcast = async () => {
    if (!broadcastText.trim()) return;
    setBroadcastLoading(true);
    setBroadcastSuccess("");
    setBroadcastError("");
    try {
      const response = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ text: broadcastText })
      });
      const data = await response.json();
      if (response.ok) {
        setBroadcastSuccess("Official broadcast dispatched successfully to all active users!");
        setBroadcastText("");
      } else {
        setBroadcastError(data.error || "Failed to dispatch system broadcast.");
      }
    } catch (err) {
      console.error("Error sending broadcast:", err);
      setBroadcastError("A network error occurred while sending the broadcast.");
    } finally {
      setBroadcastLoading(false);
    }
  };

  const getLoggedInUsername = () => {
    if (!token) return "";
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const payload = JSON.parse(jsonPayload);
      return payload.username || "";
    } catch (e) {
      return "";
    }
  };

  const loggedInUsername = getLoggedInUsername().toLowerCase();
  const isSuperAdmin = loggedInUsername === "expectations";

  const handleToggleAdminStatus = async (promote: boolean) => {
    setActionLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const response = await fetch(`/api/admin/users/${selectedUserId}/toggle-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ isAdmin: promote })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || "User role updated successfully.");
        if (selectedUserId) {
          fetchUserDetail(selectedUserId);
        }
      } else {
        setError(data.error || "Failed to update user role.");
      }
    } catch (err) {
      console.error("Error toggling admin role:", err);
      setError("Network error occurred while updating user role.");
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch all users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch(`/api/admin/users?q=${encodeURIComponent(searchQuery)}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to load users list.");
      }
    } catch (err) {
      console.error("Error fetching admin users:", err);
      setError("Failed to fetch users due to a network error.");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchQuery]);

  // Fetch individual user details and reports
  const fetchUserDetail = async (userId: string) => {
    setLoadingDetail(true);
    setError("");
    setSuccessMsg("");
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedUserDetail(data.user);
        setReports(data.reports);
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to load user details.");
      }
    } catch (err) {
      console.error("Error fetching user details:", err);
      setError("Network error fetching user details.");
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedUserId) {
      fetchUserDetail(selectedUserId);
    } else {
      setSelectedUserDetail(null);
      setReports([]);
    }
  }, [selectedUserId]);

  const handleBanUser = async () => {
    if (!selectedUserId) return;
    setActionLoading(true);
    setError("");
    setSuccessMsg("");

    let bannedUntil: string | undefined = undefined;
    if (!isPermanentBan) {
      const banDate = new Date();
      banDate.setDate(banDate.getDate() + banDurationDays);
      bannedUntil = banDate.toISOString();
    }

    try {
      const response = await fetch(`/api/admin/users/${selectedUserId}/ban`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ bannedUntil })
      });

      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || "User banned successfully.");
        // Refresh details
        fetchUserDetail(selectedUserId);
        fetchUsers();
      } else {
        setError(data.error || "Failed to ban user.");
      }
    } catch (err) {
      console.error("Error banning user:", err);
      setError("Network error occurred while banning.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnbanUser = async () => {
    if (!selectedUserId) return;
    setActionLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const response = await fetch(`/api/admin/users/${selectedUserId}/unban`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || "User unbanned successfully.");
        // Refresh details
        fetchUserDetail(selectedUserId);
        fetchUsers();
      } else {
        setError(data.error || "Failed to unban user.");
      }
    } catch (err) {
      console.error("Error unbanning user:", err);
      setError("Network error occurred while unbanning.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        className="w-full max-w-5xl h-[85vh] bg-slate-950 border border-red-500/25 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900/40 border-b border-red-500/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-red-500">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
            <h2 className="text-lg font-extrabold tracking-wide text-white uppercase">Quantix Admin Backdoor</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left panel: Users Search List */}
          <div className="w-full md:w-2/5 border-r border-slate-900 flex flex-col min-h-0">
            <div className="p-4 border-b border-slate-900 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search user list..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/30 transition-all"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            {/* Users list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loadingUsers ? (
                <div className="flex items-center justify-center h-48">
                  <span className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></span>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-12">No users found.</div>
              ) : (
                users.map((u) => {
                  const isUserBanned = u.isBanned;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition cursor-pointer ${
                        selectedUserId === u.id 
                          ? "bg-red-950/20 border border-red-500/20" 
                          : "hover:bg-slate-900/50 border border-transparent"
                      }`}
                    >
                      <div className="relative">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.displayName} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-sm">
                            {u.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-950 ${
                          isUserBanned ? "bg-red-500" : u.status === "online" ? "bg-emerald-500" : "bg-slate-500"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-white truncate">{u.displayName}</p>
                          {isUserBanned && (
                            <span className="text-[9px] bg-red-950/40 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-mono uppercase">
                              Banned
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">@{u.username}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: User Details, Reports & Ban Trigger */}
          <div className="flex-1 min-h-0 flex flex-col bg-slate-950/40 overflow-y-auto p-6 space-y-6">
            {!selectedUserId ? (
              <div className="space-y-6">
                {/* Global Broadcast System */}
                <div className="bg-slate-900/30 border border-red-500/15 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center gap-2.5 text-red-500">
                    <ShieldAlert className="w-5 h-5 animate-pulse" />
                    <h3 className="text-sm font-extrabold text-white tracking-widest uppercase font-sans">
                      Global System Broadcast Dispatcher
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Send an official system announcement directly to every registered user on Quantix Connect. The message will appear with an official admin broadcast badge and a deep shadow black glow.
                  </p>

                  <div className="space-y-1.5 mt-2">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Broadcast Message</label>
                    <textarea
                      rows={4}
                      value={broadcastText}
                      onChange={(e) => setBroadcastText(e.target.value)}
                      placeholder="Type your official administrative broadcast message here..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500/30 transition-all placeholder:text-slate-600 resize-none"
                    />
                  </div>

                  {broadcastError && (
                    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                      {broadcastError}
                    </div>
                  )}

                  {broadcastSuccess && (
                    <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                      {broadcastSuccess}
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleSendBroadcast}
                      disabled={broadcastLoading || !broadcastText.trim()}
                      className="bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition active:scale-[0.98] cursor-pointer flex items-center gap-1.5 shadow-[0_4px_12px_rgba(239,68,68,0.2)]"
                    >
                      {broadcastLoading ? (
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      ) : (
                        <>
                          <ShieldAlert className="w-4 h-4" />
                          <span>Dispatch Broadcast Announcement</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center text-slate-500 space-y-2 py-12 bg-slate-900/10 border border-slate-900/50 rounded-2xl">
                  <User className="w-10 h-10 text-slate-700" />
                  <p className="text-xs font-medium">Select a user from the left pane to access user-specific moderator actions.</p>
                </div>
              </div>
            ) : loadingDetail ? (
              <div className="flex items-center justify-center h-full py-24">
                <span className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></span>
              </div>
            ) : selectedUserDetail ? (
              <>
                {/* User Header Info Card */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 flex items-center gap-4">
                  {selectedUserDetail.avatarUrl ? (
                    <img src={selectedUserDetail.avatarUrl} alt={selectedUserDetail.displayName} className="w-16 h-16 rounded-full object-cover border-2 border-slate-800" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-2xl border-2 border-slate-800">
                      {selectedUserDetail.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white leading-tight">{selectedUserDetail.displayName}</h3>
                    <p className="text-xs text-red-400 font-medium">@{selectedUserDetail.username}</p>
                    <p className="text-[10px] text-slate-500 mt-1">ID: {selectedUserDetail.id}</p>
                  </div>
                  {selectedUserDetail.isBanned && (
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 bg-red-950/40 border border-red-500/30 text-red-400 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider animate-pulse">
                        <Ban className="w-3 h-3" /> Banned
                      </span>
                      {selectedUserDetail.bannedUntil && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          Until: {new Date(selectedUserDetail.bannedUntil).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Feedback / Alert Logs */}
                {(error || successMsg) && (
                  <div className="space-y-2">
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                    {successMsg && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl p-3 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{successMsg}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Promotion controls (Super Admin Only) */}
                {isSuperAdmin && (
                  <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-extrabold text-white tracking-widest uppercase flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      Administrative Role Management
                    </h4>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <p className="text-xs text-slate-400 max-w-md">
                        {selectedUserDetail.isAdmin
                          ? "This user currently has Administrator privileges on Quantix Connect."
                          : "Promote this user to grant them access to the Administrative Dashboard and Moderation controls."}
                      </p>
                      <button
                        onClick={() => handleToggleAdminStatus(!selectedUserDetail.isAdmin)}
                        disabled={actionLoading}
                        className={`font-bold px-5 py-2.5 rounded-xl text-xs transition active:scale-[0.98] cursor-pointer flex items-center gap-1.5 shadow-md shrink-0 ${
                          selectedUserDetail.isAdmin
                            ? "bg-amber-700 hover:bg-amber-600 text-white"
                            : "bg-blue-600 hover:bg-blue-500 text-white"
                        }`}
                      >
                        {actionLoading ? (
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : selectedUserDetail.isAdmin ? (
                          <>
                            <ShieldAlert className="w-4 h-4" />
                            <span>Revoke Admin Access</span>
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4" />
                            <span>Promote to Administrator</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Moderation Controls (Ban/Unban) */}
                <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-extrabold text-white tracking-widest uppercase flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    Moderation Command Center
                  </h4>

                  {selectedUserDetail.isBanned ? (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">This account is currently blocked from accessing the platform.</p>
                      <button
                        onClick={handleUnbanUser}
                        disabled={actionLoading}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition active:scale-[0.98] cursor-pointer flex items-center gap-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                      >
                        {actionLoading ? (
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Revoke Ban / Lift Ban</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                          <input
                            type="checkbox"
                            id="permBan"
                            checked={isPermanentBan}
                            onChange={(e) => setIsPermanentBan(e.target.checked)}
                            className="rounded border-slate-800 bg-slate-950 text-red-600 focus:ring-red-500"
                          />
                          <label htmlFor="permBan" className="text-xs text-slate-300 font-semibold cursor-pointer">
                            Permanent Ban / Indefinite Banishment
                          </label>
                        </div>

                        {!isPermanentBan && (
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ban Duration (Days)</label>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min="1"
                                max="30"
                                value={banDurationDays}
                                onChange={(e) => setBanDurationDays(parseInt(e.target.value))}
                                className="flex-1 accent-red-500"
                              />
                              <span className="text-xs font-mono text-white bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                                {banDurationDays}d
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={handleBanUser}
                          disabled={actionLoading}
                          className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition active:scale-[0.98] cursor-pointer flex items-center gap-1.5 shadow-[0_4px_12px_rgba(239,68,68,0.2)]"
                        >
                          {actionLoading ? (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          ) : (
                            <>
                              <Ban className="w-4 h-4" />
                              <span>Enforce Account Ban</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reports Feed */}
                <div className="space-y-4">
                  <h4 className="text-xs font-extrabold text-white tracking-widest uppercase flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    Received Reports Log ({reports.length})
                  </h4>

                  {reports.length === 0 ? (
                    <div className="bg-slate-900/10 border border-slate-900 rounded-2xl p-8 text-center text-xs text-slate-500">
                      No reports registered against this user.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reports.map((report) => (
                        <div key={report.id} className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="inline-block bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] px-2 py-0.5 rounded-md font-mono uppercase font-bold tracking-wider mb-2">
                                {report.type === "issue" ? "Issue Report" : `User Report (${report.reason})`}
                              </span>
                              {report.title && <h5 className="text-sm font-bold text-white">{report.title}</h5>}
                            </div>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {new Date(report.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Report Description</label>
                            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-900 break-words whitespace-pre-wrap">
                              {report.description}
                            </p>
                          </div>

                          {/* Screenshot */}
                          {report.screenshot && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Screenshot Attachment</label>
                              <div className="max-w-md rounded-xl overflow-hidden border border-slate-800">
                                <img src={report.screenshot} alt="Report attachment" className="w-full object-contain max-h-60 bg-black" />
                              </div>
                            </div>
                          )}

                          {/* Messages Context */}
                          {report.messagesContext && report.messagesContext.length > 0 && (
                            <div className="space-y-2">
                              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Chat Log context (last 10 messages)</label>
                              <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 max-h-48 overflow-y-auto space-y-1.5 font-mono text-[11px] leading-relaxed">
                                {report.messagesContext.map((msg, i) => (
                                  <div key={i} className="text-slate-400 break-words">
                                    <span className="text-slate-500">[{new Date(msg.createdAt).toLocaleTimeString()}]</span>{" "}
                                    <span className="text-red-400 font-bold">@{msg.senderUsername}:</span>{" "}
                                    <span className="text-white">{msg.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
