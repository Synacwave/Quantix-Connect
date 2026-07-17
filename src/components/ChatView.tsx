import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Paperclip, Send, Smile, Mic, Trash2, Check, CheckCheck, 
  ArrowLeft, Download, Image as ImageIcon, Volume2, 
  Play, Pause, Pin, Info, File, AlertCircle, X, StopCircle,
  MessageSquare
} from "lucide-react";
import { User, Chat, Message } from "../types";

interface ChatViewProps {
  currentUser: User;
  activeChat: Chat;
  messages: Message[];
  typingUsers: Record<string, boolean>;
  socket: any;
  onBack: () => void;
  onSendMessage: (text: string, mediaUrl?: string, mediaType?: "text" | "image" | "voice" | "file") => void;
  onDeleteMessage: (messageId: string) => void;
  onTogglePin: (chatId: string) => void;
}

const EMOJIS = ["😀", "😂", "🤣", "😊", "😍", "😘", "😜", "😎", "😏", "👍", "❤️", "🔥", "🎉", "👏", "🙏", "✨", "💯", "😭", "🥺", "👀", "👋", "💡", "🚀", "🤫"];

export default function ChatView({
  currentUser,
  activeChat,
  messages,
  typingUsers,
  socket,
  onBack,
  onSendMessage,
  onDeleteMessage,
  onTogglePin
}: ChatViewProps) {
  const [inputText, setInputText] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  
  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  // Typing indicator trigger on text change
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const partner = activeChat.otherParticipant;

  // Auto-scroll to bottom on new messages or chat change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // Handle typing state sockets
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!isTyping && socket) {
      setIsTyping(true);
      socket.emit("typing", { chatId: activeChat.id, displayName: currentUser.displayName });
    }

    // Reset stop typing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      if (socket) {
        socket.emit("stop_typing", { chatId: activeChat.id });
      }
      setIsTyping(false);
    }, 2000);
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (socket) {
      socket.emit("stop_typing", { chatId: activeChat.id });
    }
    setIsTyping(false);

    onSendMessage(inputText.trim());
    setInputText("");
    setShowEmojis(false);
  };

  const insertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  // Handle File Uploads (Image or Generic File)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError("File attachments must be under 15MB.");
      return;
    }

    setUploading(true);
    setError("");

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({ fileData: base64Data })
        });

        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();

        // Determine mediaType
        let mediaType: "image" | "file" = "file";
        if (file.type.startsWith("image/")) {
          mediaType = "image";
        }

        onSendMessage(file.name, data.url, mediaType);
      } catch (err) {
        setError("Failed to upload attachment. Please try again.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- VOICE RECORDING HANDLERS ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        
        // Convert Blob to Base64 to upload through REST API
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Data = reader.result as string;
          try {
            setUploading(true);
            const res = await fetch("/api/upload", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
              },
              body: JSON.stringify({ fileData: base64Data })
            });

            if (!res.ok) throw new Error();
            const data = await res.json();

            // Send voice message
            onSendMessage("Voice message", data.url, "voice");
          } catch (err) {
            setError("Failed to upload voice message.");
          } finally {
            setUploading(false);
          }
        };
        reader.readAsDataURL(audioBlob);

        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      setError("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.onstop = null; // Prevent triggering send on cancel
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  };

  const formatRecordTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Voice player component helper
  const VoicePlayer = ({ url }: { url: string }) => {
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = () => {
      if (!audioRef.current) {
        audioRef.current = new Audio(url);
        audioRef.current.onended = () => setPlaying(false);
      }

      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        audioRef.current.play();
        setPlaying(true);
      }
    };

    useEffect(() => {
      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
        }
      };
    }, []);

    return (
      <div className="flex items-center gap-3 bg-blue-900/10 border border-blue-500/10 px-4 py-2.5 rounded-2xl w-52">
        <button 
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white cursor-pointer hover:bg-blue-500 transition shrink-0"
        >
          {playing ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold text-white block">Voice Note</span>
          <div className="flex items-center gap-1.5 mt-1">
            <Volume2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="h-1 bg-slate-800 rounded-full flex-1 overflow-hidden relative">
              <div className={`h-full bg-blue-500 rounded-full ${playing ? "w-full transition-all duration-[6000ms] linear" : "w-1/4"}`}></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 h-full bg-slate-950 flex flex-col relative select-none">
      {/* Interactive Chat Header */}
      <div className="px-4 py-3 bg-slate-900/50 border-b border-blue-500/10 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back mobile button */}
          <button 
            onClick={onBack}
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {partner && (
            <>
              <div className="relative shrink-0">
                {partner.avatarUrl ? (
                  <img src={partner.avatarUrl} alt={partner.displayName} className="w-10 h-10 rounded-full object-cover border border-blue-500/15" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-900/40 flex items-center justify-center text-blue-400 text-sm font-bold">
                    {partner.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                {partner.status === "online" && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-950 rounded-full"></span>
                )}
              </div>
              <div className="min-w-0 leading-tight">
                <div className="text-xs font-extrabold text-white truncate">{partner.displayName}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate font-medium">
                  {partner.status === "online" ? (
                    <span className="text-emerald-500 font-bold">online</span>
                  ) : (
                    <span>offline</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onTogglePin(activeChat.id)}
            className={`p-2 rounded-xl transition cursor-pointer ${activeChat.isPinned ? "bg-blue-600/10 text-blue-400 hover:bg-blue-600/20" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"}`}
            title={activeChat.isPinned ? "Unpin Chat" : "Pin Chat"}
          >
            <Pin className={`w-4 h-4 ${activeChat.isPinned ? "rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      {/* Messages Logs Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-radial from-slate-950 via-slate-950 to-black scrollbar-thin scrollbar-thumb-slate-800">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3 max-w-sm mx-auto flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-30 select-none">
            <MessageSquare className="w-14 h-14 text-blue-500 mb-3 animate-bounce" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">No Messages Here Yet</span>
            <span className="text-[10px] text-slate-500 mt-1 max-w-xs">Be the first to say hi! Attach files, voice notes, or emojis using the controls below.</span>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === currentUser.id;
            const isRead = msg.readBy.length > 1; // Read by sender and receiver

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex w-full group ${isSelf ? "justify-end" : "justify-start"}`}
              >
                <div className={`relative max-w-[70%] rounded-2xl px-3.5 py-2.5 shadow-lg border relative flex flex-col gap-1 transition ${
                  isSelf 
                    ? "bg-blue-600/15 border-blue-500/25 text-white rounded-tr-none" 
                    : "bg-slate-900 border-slate-800 text-slate-100 rounded-tl-none"
                }`}>
                  {/* Delete Hover Control */}
                  {isSelf && (
                    <button
                      onClick={() => onDeleteMessage(msg.id)}
                      className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-900/80 hover:bg-red-950 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition duration-150 cursor-pointer border border-slate-800"
                      title="Delete message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Attachment Types Rendering */}
                  {msg.mediaType === "image" && msg.mediaUrl && (
                    <div className="rounded-xl overflow-hidden mb-1 border border-slate-950 bg-slate-950 shadow-inner max-w-xs">
                      <img src={msg.mediaUrl} alt="Shared Photo" className="max-w-full max-h-60 object-contain hover:scale-102 transition duration-200 cursor-pointer" />
                    </div>
                  )}

                  {msg.mediaType === "voice" && msg.mediaUrl && (
                    <div className="mb-1">
                      <VoicePlayer url={msg.mediaUrl} />
                    </div>
                  )}

                  {msg.mediaType === "file" && msg.mediaUrl && (
                    <a 
                      href={msg.mediaUrl} 
                      download={msg.text}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 bg-slate-950/50 hover:bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-left transition mb-1 max-w-xs cursor-pointer group"
                    >
                      <File className="w-6 h-6 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-white block truncate group-hover:text-blue-400">{msg.text}</span>
                        <span className="text-[9px] text-slate-500 block mt-0.5">Click to download file</span>
                      </div>
                      <Download className="w-4 h-4 text-slate-500 shrink-0" />
                    </a>
                  )}

                  {/* Text (Only if text exists or is standard message) */}
                  {msg.mediaType === "text" && (
                    <p className="text-[12px] font-normal leading-relaxed break-words">{msg.text}</p>
                  )}

                  {/* Metadata line (Timestamp + Receipts) */}
                  <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 mt-0.5 self-end shrink-0 select-none">
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {isSelf && (
                      <span className="ml-1 shrink-0">
                        {isRead ? (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}

        {/* Live Typing indicator bubble */}
        {partner && typingUsers[partner.id] && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-slate-900/60 border border-slate-900/50 rounded-2xl px-4 py-2.5 text-slate-500 text-[10px] flex items-center gap-1.5 font-medium shadow-sm">
              <span className="font-bold text-slate-400">{partner.displayName}</span>
              <span>is typing</span>
              <span className="flex gap-0.5 ml-0.5 mt-1 shrink-0">
                <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></span>
                <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Action Panel Bar */}
      <div className="p-3 bg-slate-950 border-t border-blue-500/10 flex flex-col gap-2 relative shrink-0">
        
        {/* Emoji Grid Overlay Panel */}
        <AnimatePresence>
          {showEmojis && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.98 }}
              className="absolute bottom-16 left-3 bg-slate-950 border border-slate-800 rounded-2xl p-2 shadow-2xl z-30 max-w-xs grid grid-cols-6 gap-1"
            >
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="w-10 h-10 hover:bg-slate-900 text-lg rounded-xl flex items-center justify-center transition active:scale-90 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Action Line */}
        <div className="flex items-center gap-2">
          
          {/* File/Attachment Clip Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2.5 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-blue-400 transition shrink-0 cursor-pointer"
            title="Attach file"
          >
            <Paperclip className="w-4.5 h-4.5" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />

          {/* Emoji Toggle button */}
          <button
            onClick={() => setShowEmojis(!showEmojis)}
            className={`p-2.5 rounded-xl transition shrink-0 cursor-pointer ${showEmojis ? "bg-blue-600/10 text-blue-400 hover:bg-blue-600/20" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}
            title="Insert emoji"
          >
            <Smile className="w-4.5 h-4.5" />
          </button>

          {/* Input text / Recording state switcher */}
          {isRecording ? (
            // RECORDING PULSING STATE PANEL
            <div className="flex-1 bg-slate-900 border border-red-500/20 rounded-xl px-4 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping shrink-0"></span>
                <span className="text-red-400 font-bold shrink-0">Recording Voice</span>
                <span className="text-slate-500 font-mono font-medium ml-1 shrink-0">{formatRecordTime(recordingTime)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={cancelRecording}
                  className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg hover:text-white hover:bg-slate-700 transition cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  onClick={stopRecording}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition cursor-pointer text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          ) : (
            // REGULAR INPUT FORM
            <form onSubmit={handleSendText} className="flex-1 flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder={uploading ? "Uploading media..." : "Write a message..."}
                disabled={uploading}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
              />

              {inputText.trim() ? (
                // SEND TEXT BUTTON
                <button
                  type="submit"
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition shrink-0 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-95 cursor-pointer"
                  title="Send message"
                >
                  <Send className="w-4 h-4 fill-white" />
                </button>
              ) : (
                // VOICE RECORD MIC BUTTON
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={uploading}
                  className="p-2.5 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-red-400 transition shrink-0 cursor-pointer"
                  title="Record voice message"
                >
                  <Mic className="w-4.5 h-4.5" />
                </button>
              )}
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
