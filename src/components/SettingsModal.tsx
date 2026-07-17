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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md bg-slate-950 border border-blue-500/20 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900/50 border-b border-blue-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500 animate-spin-slow" />
            <h2 className="text-lg font-bold text-white">Quantix Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
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
              className="w-24 h-24 rounded-full border-2 border-blue-500/30 hover:border-blue-500/60 bg-slate-900 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition relative group shadow-lg"
            >
              {avatarBase64 ? (
                <img src={avatarBase64} alt="New Avatar Preview" className="w-full h-full object-cover" />
              ) : user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Current Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-blue-900/40 flex items-center justify-center text-blue-400 text-2xl font-bold">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <Upload className="w-5 h-5 text-white" />
              </div>
            </div>
            <span className="text-[10px] text-slate-500">Click to change profile image</span>
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
              <label className="text-xs font-semibold text-slate-400 tracking-wide">Username</label>
              <div className="w-full bg-slate-900/50 border border-slate-900 text-slate-500 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                <UserIcon className="w-4 h-4" />
                <span>@{user.username}</span>
              </div>
            </div>

            {/* Display Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 tracking-wide">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display Name"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Custom Status Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-400 tracking-wide">Custom Status</label>
                <span className="text-[10px] text-slate-500">e.g., 🚀 coding away</span>
              </div>
              <input
                type="text"
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                placeholder="What's your vibe today?"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Bio / About Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 tracking-wide">About (Bio)</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write a short bio about yourself..."
                rows={2}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="w-1/3 bg-red-950/40 border border-red-500/20 text-red-400 font-medium py-3 rounded-xl text-xs transition hover:bg-red-950/70 active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
            
            <button
              type="submit"
              disabled={loading}
              className="w-2/3 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold py-3 rounded-xl text-xs transition shadow-[0_4px_12px_rgba(37,99,235,0.2)] flex items-center justify-center gap-1.5 cursor-pointer"
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
      </motion.div>
    </div>
  );
}
