import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Shield, Upload, Eye, EyeOff, Sparkles, AlertCircle } from "lucide-react";

interface LoginScreenProps {
  onAuthSuccess: (token: string, user: any) => void;
}

export default function LoginScreen({ onAuthSuccess }: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [avatarBase64, setAvatarBase64] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Profile picture must be under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!username || !password || (isRegistering && !displayName)) {
      setError("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    const payload = isRegistering 
      ? { username, displayName, password, avatarUrl: avatarBase64 }
      : { username, password };

    const endpoint = isRegistering ? "/api/auth/register" : "/api/auth/login";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed. Please try again.");
      }

      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-blue-950 to-black p-4 select-none relative overflow-hidden">
      {/* Decorative ambient blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10 animate-pulse duration-[6000ms]"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -z-10 animate-pulse duration-[8000ms]"></div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-slate-950/75 backdrop-blur-xl border border-blue-500/15 rounded-3xl p-8 shadow-2xl relative"
      >
        {/* App Title Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] mb-4">
            <MessageSquare className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-1.5 font-sans">
            Quantix <span className="text-blue-500 font-light">Connect</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 font-medium text-center max-w-xs">
            {isRegistering ? "Create your elegant profile and join" : "High-speed secure messaging system"}
          </p>
        </div>

        {/* Error Alert Box */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3 mb-5 flex items-start gap-2 overflow-hidden"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4 overflow-hidden"
            >
              {/* Profile Pic Upload Widget */}
              <div className="flex flex-col items-center gap-2 mb-2">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-full border-2 border-dashed border-blue-500/30 hover:border-blue-500/70 bg-slate-900 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition relative group"
                >
                  {avatarBase64 ? (
                    <img src={avatarBase64} alt="Avatar Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-6 h-6 text-slate-500 group-hover:text-blue-400 transition" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <span className="text-[10px] text-white font-medium">Upload</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500">Pick Profile Image (Optional)</span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              {/* Display Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 tracking-wide">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-600"
                />
              </div>
            </motion.div>
          )}

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 tracking-wide">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. johndoe"
              autoCapitalize="none"
              autoComplete="off"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-600"
            />
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 tracking-wide">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-4 pr-11 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl text-sm transition shadow-[0_4px_15px_rgba(37,99,235,0.25)] flex items-center justify-center gap-2 cursor-pointer mt-6"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{isRegistering ? "Create Account" : "Access System"}</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Toggle links */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            {isRegistering ? "Already have an account?" : "New to Quantix Connect?"}{" "}
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError("");
              }}
              className="text-blue-500 font-semibold hover:underline cursor-pointer ml-1"
            >
              {isRegistering ? "Sign In" : "Register Now"}
            </button>
          </p>
        </div>

        {/* Safety Badge */}
        <div className="flex items-center justify-center gap-1.5 mt-8 text-slate-600 text-[10px]">
          <Shield className="w-3.5 h-3.5" />
          <span>AES-256 equivalent session encryption active</span>
        </div>
      </motion.div>
    </div>
  );
}
