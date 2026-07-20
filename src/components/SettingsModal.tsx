import React, { useState, useRef } from "react";
import { motion } from "motion/react";
import { X, Save, LogOut, Upload, User as UserIcon, Settings } from "lucide-react";
import { User } from "../types";

interface SettingsModalProps {
  user: User;
  onClose: () => void;
  onUpdateUser: (updatedUser: User) => void;
  onLogout: () => void;
}

export default function SettingsModal({ user, onClose, onUpdateUser, onLogout }: SettingsModalProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio || "");
  const [customStatus, setCustomStatus] = useState(user.customStatus || "");
  const [avatarBase64, setAvatarBase64] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Issue reporting states
  const [showReportForm, setShowReportForm] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueCategory, setIssueCategory] = useState("Bug");
  const [issueDescription, setIssueDescription] = useState("");
  const [issueScreenshot, setIssueScreenshot] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState("");
  const reportFileInputRef = useRef<HTMLInputElement>(null);

  const handleReportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setReportError("Screenshot size must be under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setIssueScreenshot(reader.result as string);
        setReportError("");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportError("");
    setReportSuccess(false);
    setReportLoading(true);

    if (!issueTitle.trim() || !issueDescription.trim()) {
      setReportError("Title and Description are required.");
      setReportLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/reports/issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          category: issueCategory,
          title: issueTitle.trim(),
          description: issueDescription.trim(),
          screenshot: issueScreenshot || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit report.");
      }

      setReportSuccess(true);
      setIssueTitle("");
      setIssueDescription("");
      setIssueScreenshot("");
    } catch (err: any) {
      setReportError(err.message || "An error occurred.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarBase64(reader.result as string);
        setError("");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    if (!displayName.trim()) {
      setError("Display name cannot be empty.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          displayName: displayName.trim(),
          avatarUrl: avatarBase64 || undefined,
          bio: bio.trim(),
          customStatus: customStatus.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile.");
      }

      onUpdateUser(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md bg-[#0D0D0D] border border-[#1D1D1D] rounded-3xl overflow-hidden shadow-2xl"
      >
        {!showReportForm ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 bg-[#0B0B0B] border-b border-[#1D1D1D] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#2A5FFF] animate-spin-slow" />
                <h2 className="text-lg font-bold text-white tracking-tight">Quantix Settings</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-[#181818] text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSave} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl p-3">
                  Profile updated successfully!
                </div>
              )}

              {/* Profile Pic Upload */}
              <div className="flex flex-col items-center gap-2">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-full border-2 border-[#1D1D1D] hover:border-[#2A5FFF]/50 bg-[#141414] flex flex-col items-center justify-center cursor-pointer overflow-hidden transition relative group shadow-lg"
                >
                  {avatarBase64 ? (
                    <img src={avatarBase64} alt="New Avatar Preview" className="w-full h-full object-cover" />
                  ) : user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Current Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#141414] border border-[#1D1D1D] flex items-center justify-center text-[#2A5FFF] text-2xl font-bold">
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                </div>
                <span className="text-[10px] text-[#707070]">Click to change profile image</span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              <div className="space-y-4">
                {/* Username (Non-Editable) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#A8A8A8] tracking-wide">Username</label>
                  <div className="w-full bg-[#090909] border border-[#1D1D1D] text-[#707070] rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-[#707070]" />
                    <span>@{user.username}</span>
                  </div>
                </div>

                {/* Display Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#A8A8A8] tracking-wide">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Display Name"
                    className="w-full bg-[#141414] border border-[#1D1D1D] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#2A5FFF] focus:ring-1 focus:ring-[#2A5FFF]/20 transition-all"
                  />
                </div>

                {/* Custom Status Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-[#A8A8A8] tracking-wide">Custom Status</label>
                    <span className="text-[10px] text-[#707070]">e.g., 🚀 coding away</span>
                  </div>
                  <input
                    type="text"
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    placeholder="What's your vibe today?"
                    className="w-full bg-[#141414] border border-[#1D1D1D] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#2A5FFF] focus:ring-1 focus:ring-[#2A5FFF]/20 transition-all"
                  />
                </div>

                {/* Bio / About Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#A8A8A8] tracking-wide">About (Bio)</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Write a short bio about yourself..."
                    rows={2}
                    className="w-full bg-[#141414] border border-[#1D1D1D] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#2A5FFF] focus:ring-1 focus:ring-[#2A5FFF]/20 transition-all resize-none"
                  />
                </div>
              </div>

              {/* Report an Issue Button Option at bottom */}
              <div className="border-t border-[#1D1D1D] pt-4">
                <button
                  type="button"
                  onClick={() => setShowReportForm(true)}
                  className="w-full bg-[#141414] hover:bg-[#181818] text-red-400 hover:text-red-300 border border-[#1D1D1D] hover:border-red-500/20 rounded-xl py-3 text-xs font-medium transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🚩 Report an Issue</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-1/3 bg-red-950/20 border border-red-500/10 text-red-400 font-medium py-3 rounded-xl text-xs transition hover:bg-red-950/40 active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 bg-[#1B3A7A] hover:bg-[#224A99] active:scale-[0.98] text-white font-semibold py-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 bg-[#0B0B0B] border-b border-[#1D1D1D] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🚩</span>
                <h2 className="text-lg font-bold text-white tracking-tight">Report an Issue</h2>
              </div>
              <button 
                onClick={() => {
                  setShowReportForm(false);
                  setReportSuccess(false);
                  setReportError("");
                  setIssueTitle("");
                  setIssueDescription("");
                  setIssueScreenshot("");
                }}
                className="p-1.5 rounded-full hover:bg-[#181818] text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Issue Form Body */}
            <form onSubmit={handleReportSubmit} className="p-6 space-y-4">
              {reportError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3">
                  {reportError}
                </div>
              )}

              {reportSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl p-3">
                  Issue reported successfully! The developer has been notified.
                </div>
              )}

              {!reportSuccess && (
                <>
                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#A8A8A8] tracking-wide">Issue Title</label>
                    <input
                      type="text"
                      required
                      value={issueTitle}
                      onChange={(e) => setIssueTitle(e.target.value)}
                      placeholder="Short summary of the issue"
                      className="w-full bg-[#141414] border border-[#1D1D1D] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#2A5FFF] focus:ring-1 focus:ring-[#2A5FFF]/20 transition-all"
                    />
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#A8A8A8] tracking-wide">Category</label>
                    <select
                      value={issueCategory}
                      onChange={(e) => setIssueCategory(e.target.value)}
                      className="w-full bg-[#141414] border border-[#1D1D1D] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#2A5FFF] focus:ring-1 focus:ring-[#2A5FFF]/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="Bug">Bug</option>
                      <option value="UI Issue">UI Issue</option>
                      <option value="Login Issue">Login Issue</option>
                      <option value="Feature Request">Feature Request</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#A8A8A8] tracking-wide">Description</label>
                    <textarea
                      required
                      value={issueDescription}
                      onChange={(e) => setIssueDescription(e.target.value)}
                      placeholder="Provide a detailed description of what happened..."
                      rows={3}
                      className="w-full bg-[#141414] border border-[#1D1D1D] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#2A5FFF] focus:ring-1 focus:ring-[#2A5FFF]/20 transition-all resize-none"
                    />
                  </div>

                  {/* Screenshot Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#A8A8A8] tracking-wide">Optional Screenshot</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => reportFileInputRef.current?.click()}
                        className="bg-[#141414] border border-[#1D1D1D] hover:bg-[#181818] text-slate-300 font-medium px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                      >
                        Choose File
                      </button>
                      <span className="text-xs text-[#707070] truncate max-w-[200px]">
                        {issueScreenshot ? "Screenshot attached" : "No file chosen"}
                      </span>
                      {issueScreenshot && (
                        <button
                          type="button"
                          onClick={() => setIssueScreenshot("")}
                          className="text-red-400 text-xs hover:underline cursor-pointer ml-auto"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={reportFileInputRef}
                      onChange={handleReportFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReportForm(false);
                    setReportSuccess(false);
                    setReportError("");
                    setIssueTitle("");
                    setIssueDescription("");
                    setIssueScreenshot("");
                  }}
                  className="w-1/3 bg-[#141414] border border-[#1D1D1D] hover:bg-[#181818] text-slate-300 font-medium py-3 rounded-xl text-xs transition active:scale-[0.98] flex items-center justify-center cursor-pointer"
                >
                  Back
                </button>
                
                {!reportSuccess && (
                  <button
                    type="submit"
                    disabled={reportLoading}
                    className="w-2/3 bg-[#1B3A7A] hover:bg-[#224A99] active:scale-[0.98] text-white font-semibold py-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
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
          </>
        )}
      </motion.div>
    </div>
  );
}
