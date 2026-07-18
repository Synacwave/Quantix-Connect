import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Paperclip, Send, Smile, Mic, Trash2, Check, CheckCheck, 
  ArrowLeft, Download, Image as ImageIcon, Volume2, 
  Play, Pause, Pin, Info, File, AlertCircle, X, StopCircle,
  MessageSquare, Users, Crown, LogOut, Star, CornerUpLeft, 
  Flame, BarChart2, Plus, SmilePlus, ChevronRight, Edit2, ShieldAlert, UserPlus, Upload, Heart
} from "lucide-react";
import { User, Chat, Message } from "../types";
import ProfileModal from "./ProfileModal";

interface ChatViewProps {
  currentUser: User;
  activeChat: Chat;
  messages: Message[];
  typingUsers: Record<string, boolean>;
  socket: any;
  onBack: () => void;
  onSendMessage: (
    text: string, 
    mediaUrl?: string, 
    mediaType?: "text" | "image" | "voice" | "file" | "poll",
    replyTo?: any,
    poll?: any,
    selfDestructIn?: number
  ) => void;
  onDeleteMessage: (messageId: string) => void;
  onTogglePin: (chatId: string) => void;
}

const EMOJIS = ["😀", "😂", "🤣", "😊", "😍", "😘", "😜", "😎", "😏", "👍", "❤️", "🔥", "🎉", "👏", "🙏", "✨", "💯", "😭", "🥺", "👀", "👋", "💡", "🚀", "🤫"];
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

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
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  
  // Group editing state variables
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState("");
  const [isEditingPic, setIsEditingPic] = useState(false);
  const [editedPic, setEditedPic] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [groupActionError, setGroupActionError] = useState("");
  const [groupActionSuccess, setGroupActionSuccess] = useState("");

  useEffect(() => {
    if (activeChat && activeChat.isGroup) {
      setEditedName(activeChat.name || "");
      setEditedDesc(activeChat.description || "");
      setEditedPic(activeChat.avatarUrl || "");
      setAddUsername("");
      setGroupActionError("");
      setGroupActionSuccess("");
      setIsEditingName(false);
      setIsEditingDesc(false);
      setIsEditingPic(false);
    }
  }, [activeChat, showGroupInfo]);

  const handleSaveGroupName = () => {
    if (!editedName.trim()) {
      setGroupActionError("Group name cannot be empty.");
      return;
    }
    setGroupActionError("");
    onSendMessage(`/name ${editedName.trim()}`);
    setIsEditingName(false);
    setGroupActionSuccess("Group renamed successfully.");
    setTimeout(() => setGroupActionSuccess(""), 3000);
  };

  const handleSaveGroupDesc = () => {
    setGroupActionError("");
    onSendMessage(`/desc ${editedDesc.trim()}`);
    setIsEditingDesc(false);
    setGroupActionSuccess("Group description updated.");
    setTimeout(() => setGroupActionSuccess(""), 3000);
  };

  const handleSaveGroupPic = () => {
    if (!editedPic.trim()) {
      setGroupActionError("Avatar URL cannot be empty.");
      return;
    }
    setGroupActionError("");
    onSendMessage(`/pic ${editedPic.trim()}`);
    setIsEditingPic(false);
    setGroupActionSuccess("Group picture updated.");
    setTimeout(() => setGroupActionSuccess(""), 3000);
  };

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsername.trim()) return;
    setGroupActionError("");
    const cleanUsername = addUsername.trim().replace(/^@/, "");
    onSendMessage(`/add ${cleanUsername}`);
    setAddUsername("");
    setGroupActionSuccess(`Added @${cleanUsername} to the group.`);
    setTimeout(() => setGroupActionSuccess(""), 3000);
  };

  const handleParticipantAction = (action: "kick" | "promote" | "demote", username: string) => {
    setGroupActionError("");
    onSendMessage(`/${action} ${username}`);
    setGroupActionSuccess(`Action "${action}" performed successfully on @${username}.`);
    setTimeout(() => setGroupActionSuccess(""), 3000);
  };
  
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
  const groupPicInputRef = useRef<HTMLInputElement>(null);
  const [groupPicUploading, setGroupPicUploading] = useState(false);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const partner = activeChat.otherParticipant;

  // --- TELEGRAM / WHATSAPP ADVANCED FEATURES STATES ---
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  
  // Tagging members states
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelectTag = (username: string) => {
    const newValue = inputText.replace(/@\w*$/, `@${username} `);
    setInputText(newValue);
    setShowTagSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const renderMessageText = (text: string) => {
    if (!text) return null;
    if (!activeChat.isGroup) {
      return <p className="text-[12px] font-normal leading-relaxed break-words">{text}</p>;
    }

    // Split text by space while keeping the spaces
    const parts = text.split(/(\s+)/);
    return (
      <p className="text-[12px] font-normal leading-relaxed break-words">
        {parts.map((part, idx) => {
          if (part.startsWith("@") && part.length > 1) {
            const username = part.slice(1).replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
            const isMember = activeChat.participants?.some(p => p.username.toLowerCase() === username.toLowerCase());
            if (isMember) {
              return (
                <span key={idx} className="text-blue-400 font-bold bg-blue-500/10 px-1 rounded hover:underline cursor-pointer">
                  {part}
                </span>
              );
            }
          }
          return part;
        })}
      </p>
    );
  };
  
  // Poll States
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  // Disappearing messages
  const [selfDestructTimer, setSelfDestructTimer] = useState<number>(0); // 0 = off, else seconds

  // Active hover/tap reaction menu message ID
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);

  // Starred messages filter & store state
  const [starredMsgIds, setStarredMsgIds] = useState<string[]>([]);
  const [starredOnlyFilter, setStarredOnlyFilter] = useState(false);

  // Load Starred messages on mount / activeChat change
  useEffect(() => {
    const key = `starred_msg_${currentUser.id}_${activeChat.id}`;
    try {
      const stored = localStorage.getItem(key);
      setStarredMsgIds(stored ? JSON.parse(stored) : []);
    } catch (e) {
      setStarredMsgIds([]);
    }
    // Reset filters and states
    setStarredOnlyFilter(false);
    setReplyingToMessage(null);
    setShowPollCreator(false);
    setSelfDestructTimer(0);
  }, [activeChat, currentUser]);

  // Toggle Star state
  const toggleStarMessage = (messageId: string) => {
    const key = `starred_msg_${currentUser.id}_${activeChat.id}`;
    let updated: string[];
    if (starredMsgIds.includes(messageId)) {
      updated = starredMsgIds.filter(id => id !== messageId);
    } else {
      updated = [...starredMsgIds, messageId];
    }
    setStarredMsgIds(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  // Auto-scroll to bottom on new messages or chat change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers, starredOnlyFilter]);

  // Handle typing state sockets
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (activeChat.isGroup) {
      const match = val.match(/@(\w*)$/);
      if (match) {
        const filter = match[1].toLowerCase();
        setTagFilter(filter);
        setShowTagSuggestions(true);
      } else {
        setShowTagSuggestions(false);
      }
    } else {
      setShowTagSuggestions(false);
    }

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

    onSendMessage(
      inputText.trim(),
      undefined,
      "text",
      replyingToMessage ? {
        id: replyingToMessage.id,
        text: replyingToMessage.mediaType !== "text" ? `[${replyingToMessage.mediaType}]` : replyingToMessage.text,
        senderName: replyingToMessage.senderId === currentUser.id 
          ? "You" 
          : (activeChat.participants?.find(p => p.id === replyingToMessage.senderId)?.displayName || "User")
      } : undefined,
      undefined,
      selfDestructTimer > 0 ? selfDestructTimer : undefined
    );

    setInputText("");
    setReplyingToMessage(null);
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

        onSendMessage(
          file.name, 
          data.url, 
          mediaType,
          replyingToMessage ? {
            id: replyingToMessage.id,
            text: replyingToMessage.mediaType !== "text" ? `[${replyingToMessage.mediaType}]` : replyingToMessage.text,
            senderName: replyingToMessage.senderId === currentUser.id 
              ? "You" 
              : (activeChat.participants?.find(p => p.id === replyingToMessage.senderId)?.displayName || "User")
          } : undefined,
          undefined,
          selfDestructTimer > 0 ? selfDestructTimer : undefined
        );
        setReplyingToMessage(null);
      } catch (err) {
        setError("Failed to upload attachment. Please try again.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGroupPicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setGroupActionError("Image files must be under 15MB.");
      return;
    }

    setGroupPicUploading(true);
    setGroupActionError("");
    setGroupActionSuccess("");

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

        setEditedPic(data.url);
        onSendMessage(`/pic ${data.url}`);
        setIsEditingPic(false);
        setGroupActionSuccess("Group profile picture updated successfully from your device!");
        setTimeout(() => setGroupActionSuccess(""), 4000);
      } catch (err) {
        setGroupActionError("Failed to upload image. Please try again.");
      } finally {
        setGroupPicUploading(false);
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
            onSendMessage(
              "Voice message", 
              data.url, 
              "voice",
              replyingToMessage ? {
                id: replyingToMessage.id,
                text: replyingToMessage.mediaType !== "text" ? `[${replyingToMessage.mediaType}]` : replyingToMessage.text,
                senderName: replyingToMessage.senderId === currentUser.id 
                  ? "You" 
                  : (activeChat.participants?.find(p => p.id === replyingToMessage.senderId)?.displayName || "User")
              } : undefined,
              undefined,
              selfDestructTimer > 0 ? selfDestructTimer : undefined
            );
            setReplyingToMessage(null);
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

  // --- REACTION TOGGLE HANDLER ---
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/reaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ emoji })
      });
      if (!response.ok) throw new Error();
      setActiveReactionMsgId(null);
    } catch (e) {
      console.error("Failed to reaction:", e);
    }
  };

  // --- POLL VOTE HANDLER ---
  const handlePollVote = async (messageId: string, optionIndex: number) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/poll/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ optionIndex })
      });
      if (!response.ok) throw new Error();
    } catch (e) {
      console.error("Failed to vote:", e);
    }
  };

  // --- SUBMIT POLL CREATION ---
  const handleCreatePoll = () => {
    if (!pollQuestion.trim()) return;
    const filledOptions = pollOptions.filter(o => o.trim() !== "");
    if (filledOptions.length < 2) {
      setError("Please add at least 2 non-empty options for the poll.");
      return;
    }

    onSendMessage(
      pollQuestion.trim(),
      undefined,
      "poll",
      undefined,
      {
        question: pollQuestion.trim(),
        options: filledOptions,
        votes: {}
      }
    );

    // Reset states
    setPollQuestion("");
    setPollOptions(["", ""]);
    setShowPollCreator(false);
  };

  // Voice player component helper with PLAYBACK SPEED
  const VoicePlayer = ({ url }: { url: string }) => {
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState<number>(1.0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = () => {
      if (!audioRef.current) {
        audioRef.current = new Audio(url);
        audioRef.current.playbackRate = speed;
        audioRef.current.onended = () => setPlaying(false);
      }

      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        audioRef.current.playbackRate = speed;
        audioRef.current.play();
        setPlaying(true);
      }
    };

    const toggleSpeed = () => {
      let nextSpeed = 1.0;
      if (speed === 1.0) nextSpeed = 1.5;
      else if (speed === 1.5) nextSpeed = 2.0;
      
      setSpeed(nextSpeed);
      if (audioRef.current) {
        audioRef.current.playbackRate = nextSpeed;
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
      <div className="flex items-center gap-3 bg-blue-900/10 border border-blue-500/10 px-4 py-2.5 rounded-2xl w-60">
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
        <button 
          onClick={toggleSpeed}
          className="px-2 py-1 text-[9px] font-extrabold bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          title="Change voice speed"
        >
          {speed}x
        </button>
      </div>
    );
  };

  // Interactive Live Disappearing Message countdown sub-component
  const DisappearingCounter = ({ msg }: { msg: Message }) => {
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

    useEffect(() => {
      if (!msg.selfDestructIn) return;
      const createdTime = new Date(msg.createdAt).getTime();
      const expiresTime = createdTime + (msg.selfDestructIn * 1000);
      
      const updateTimer = () => {
        const remaining = Math.max(0, Math.ceil((expiresTime - Date.now()) / 1000));
        setSecondsLeft(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          onDeleteMessage(msg.id);
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }, [msg]);

    if (secondsLeft === null) return null;

    return (
      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 font-mono font-bold text-[9px] select-none">
        <Flame className="w-3 h-3 text-red-500 shrink-0 animate-pulse" />
        <span>{secondsLeft}s</span>
      </span>
    );
  };

  const scrollToMessageId = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-blue-500", "ring-offset-2", "ring-offset-slate-950");
      setTimeout(() => {
        element.classList.remove("ring-2", "ring-blue-500", "ring-offset-2", "ring-offset-slate-950");
      }, 1500);
    }
  };

  // Filter messages based on Star filter
  const filteredMessages = starredOnlyFilter 
    ? messages.filter(m => starredMsgIds.includes(m.id)) 
    : messages;

  return (
    <div className="flex-1 h-full bg-slate-950 flex flex-row relative select-none overflow-hidden min-w-0">
      <div className="flex-1 h-full flex flex-col relative min-w-0">
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

            {activeChat.isGroup ? (
              <>
                <button
                  onClick={() => setShowGroupInfo(true)}
                  className="relative shrink-0 cursor-pointer active:scale-95 transition"
                >
                  {activeChat.avatarUrl ? (
                    <img src={activeChat.avatarUrl} alt={activeChat.name} className="w-10 h-10 rounded-xl object-cover border border-blue-500/15" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-950 to-blue-950 border border-blue-500/15 flex items-center justify-center text-blue-400 text-sm font-bold shadow-inner">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                  )}
                </button>
                <div className="min-w-0 leading-tight">
                  <div className="text-xs font-extrabold text-white truncate hover:text-blue-400 transition cursor-pointer" onClick={() => setShowGroupInfo(true)}>{activeChat.name || "Secure Group"}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate font-medium">
                    <span>{activeChat.participants?.length || 0} participants</span>
                  </div>
                </div>
              </>
            ) : partner ? (() => {
                const isLucy = partner.id === "0000000000000000000010c1" || partner.id === "00000000000000000000lucy" || partner.username === "lucy";
                return (
                  <>
                    <button
                      onClick={() => setSelectedProfileUser(partner)}
                      className="relative shrink-0 cursor-pointer active:scale-95 transition"
                    >
                      {partner.avatarUrl ? (
                        <img 
                          src={partner.avatarUrl} 
                          alt={partner.displayName} 
                          referrerPolicy="no-referrer"
                          className={`w-10 h-10 rounded-full object-cover border ${isLucy ? "border-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.7)]" : "border-blue-500/15"}`} 
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${isLucy ? "bg-gradient-to-tr from-purple-600 to-pink-500 text-white" : "bg-blue-900/40 text-blue-400"}`}>
                          {partner.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {partner.status === "online" && (
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-slate-950 rounded-full ${isLucy ? "bg-pink-400" : "bg-emerald-500"}`}></span>
                      )}
                    </button>
                    <div className="min-w-0 leading-tight">
                      <div className={`text-xs font-extrabold truncate transition cursor-pointer ${isLucy ? "text-purple-300 hover:text-pink-400" : "text-white hover:text-blue-400"}`} onClick={() => setSelectedProfileUser(partner)}>{partner.displayName}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate font-medium flex items-center gap-1.5">
                        {partner.status === "online" ? (
                          <span className={isLucy ? "text-pink-400 font-bold" : "text-emerald-500 font-bold"}>online</span>
                        ) : (
                          <span>offline</span>
                        )}
                        {partner.customStatus && (
                          <span className={`${isLucy ? "text-pink-300/80 border-purple-900" : "text-blue-400 border-slate-800"} border-l pl-1.5 italic font-semibold truncate max-w-[120px]`}>
                            {partner.customStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                );
              })() : null}
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Starred Messages Toggle Button */}
            <button
              onClick={() => setStarredOnlyFilter(!starredOnlyFilter)}
              className={`p-2 rounded-xl transition cursor-pointer ${starredOnlyFilter ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"}`}
              title={starredOnlyFilter ? "Show All Messages" : "Show Starred Messages"}
            >
              <Star className={`w-4 h-4 ${starredOnlyFilter ? "fill-yellow-400" : ""}`} />
            </button>

            <button
              onClick={() => onTogglePin(activeChat.id)}
              className={`p-2 rounded-xl transition cursor-pointer ${activeChat.isPinned ? "bg-blue-600/10 text-blue-400 hover:bg-blue-600/20" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"}`}
              title={activeChat.isPinned ? "Unpin Chat" : "Pin Chat"}
            >
              <Pin className={`w-4 h-4 ${activeChat.isPinned ? "rotate-45" : ""}`} />
            </button>

            {activeChat.isGroup && (
              <button
                onClick={() => setShowGroupInfo(!showGroupInfo)}
                className={`p-2 rounded-xl transition cursor-pointer ${showGroupInfo ? "bg-blue-600/10 text-blue-400 hover:bg-blue-600/20" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"}`}
                title="Group Protocol Details"
              >
                <Info className="w-4 h-4" />
              </button>
            )}
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

          {starredOnlyFilter && (
            <div className="flex items-center justify-center gap-1.5 px-4 py-2 bg-yellow-500/5 border border-yellow-500/15 text-yellow-400 text-[10px] font-mono tracking-wider uppercase rounded-full max-w-xs mx-auto text-center">
              <Star className="w-3.5 h-3.5 fill-yellow-400" />
              <span>Starred Message Vault Filters Active</span>
            </div>
          )}

          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-30 select-none">
              <MessageSquare className="w-14 h-14 text-blue-500 mb-3 animate-bounce" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {starredOnlyFilter ? "No Starred Messages Found" : "No Messages Here Yet"}
              </span>
              <span className="text-[10px] text-slate-500 mt-1 max-w-xs">
                {starredOnlyFilter 
                  ? "Star any message in this conversation by tapping its icon to store and display them here." 
                  : "Be the first to say hi! Attach files, voice notes, or emojis using the controls below."
                }
              </span>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isSystem = msg.senderId === "000000000000000000000000";
              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-2 animate-fade-in">
                    <div className="bg-slate-900/60 border border-blue-500/10 px-4 py-1.5 rounded-full text-[10px] font-mono text-blue-400 max-w-[85%] text-center uppercase tracking-wider leading-relaxed shadow-sm">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              const isSelf = msg.senderId === currentUser.id;
              const isRead = msg.readBy.length > 1; // Read by sender and receiver
              const senderUser = activeChat.participants?.find(p => p.id === msg.senderId) || (isSelf ? currentUser : null);
              const isStarred = starredMsgIds.includes(msg.id);
              const isTaggedMe = activeChat.isGroup && msg.text && msg.text.toLowerCase().includes(`@${currentUser.username.toLowerCase()}`);

              return (
                <motion.div
                  id={`msg-${msg.id}`}
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={`flex w-full group gap-2 ${isSelf ? "justify-end" : "justify-start"}`}
                >
                  {/* Sender Avatar for Group Messages */}
                  {activeChat.isGroup && !isSelf && (
                    <button
                      onClick={() => senderUser && setSelectedProfileUser(senderUser)}
                      className="w-8 h-8 rounded-full bg-slate-900 shrink-0 self-end overflow-hidden border border-slate-800 cursor-pointer active:scale-90 transition"
                      title={senderUser?.displayName || "View Profile"}
                    >
                      {senderUser?.avatarUrl ? (
                        <img src={senderUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-900/40 flex items-center justify-center text-blue-400 text-[10px] font-extrabold uppercase">
                          {senderUser?.displayName.charAt(0) || "U"}
                        </div>
                      )}
                    </button>
                  )}

                  <div className="relative max-w-[85%] md:max-w-[70%] flex flex-col gap-1 items-start">
                    
                    {/* Floating Hover Actions Tool Panel (WhatsApp style) */}
                    <div className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 z-10 ${
                      isSelf ? "right-full mr-2" : "left-full ml-2"
                    }`}>
                      {/* Reaction trigger */}
                      <button
                        onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer transition shadow"
                        title="Add reaction"
                      >
                        <SmilePlus className="w-3.5 h-3.5" />
                      </button>

                      {/* Reply trigger */}
                      <button
                        onClick={() => setReplyingToMessage(msg)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer transition shadow"
                        title="Reply to message"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </button>

                      {/* Star message trigger */}
                      <button
                        onClick={() => toggleStarMessage(msg.id)}
                        className={`p-1.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer transition shadow ${
                          isStarred ? "text-yellow-400 hover:bg-slate-800" : "text-slate-400 hover:text-white hover:bg-slate-800"
                        }`}
                        title={isStarred ? "Unstar message" : "Star message"}
                      >
                        <Star className={`w-3.5 h-3.5 ${isStarred ? "fill-yellow-400" : ""}`} />
                      </button>

                      {/* Delete */}
                      {isSelf && (
                        <button
                          onClick={() => onDeleteMessage(msg.id)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950 text-slate-500 hover:text-red-400 border border-slate-800 cursor-pointer transition shadow"
                          title="Delete message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Floating Reaction Quick Bar Picker Overlay */}
                    <AnimatePresence>
                      {activeReactionMsgId === msg.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.85, y: -5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.85, y: -5 }}
                          className={`absolute bottom-full mb-1 bg-slate-900 border border-slate-800 rounded-full px-2 py-1 shadow-2xl flex gap-1 z-20 ${
                            isSelf ? "right-0" : "left-0"
                          }`}
                        >
                          {REACTION_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => handleToggleReaction(msg.id, emoji)}
                              className="w-7 h-7 hover:bg-slate-800 rounded-full flex items-center justify-center text-sm cursor-pointer hover:scale-120 active:scale-90 transition duration-100"
                            >
                              {emoji}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Chat Bubble Frame */}
                    <div className={`relative w-full rounded-2xl px-3.5 py-2.5 shadow-lg border flex flex-col gap-1 transition ${
                      isSelf 
                        ? "bg-blue-600/15 border-blue-500/25 text-white rounded-tr-none" 
                        : (msg.senderId === "00000000000000000000lucy" || msg.senderId === "0000000000000000000010c1")
                          ? "bg-pink-950/20 border-pink-500/30 text-pink-100 rounded-tl-none shadow-[0_0_15px_rgba(236,72,153,0.1)]"
                          : isTaggedMe
                            ? "bg-amber-500/10 border-amber-500/30 text-slate-100 rounded-tl-none ring-1 ring-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.05)]"
                            : "bg-slate-900 border-slate-800 text-slate-100 rounded-tl-none"
                    }`}>
                      
                      {/* Replying Block (Quoted Reply) */}
                      {msg.replyTo && (
                        <button
                          onClick={() => scrollToMessageId(msg.replyTo.id)}
                          className="w-full text-left bg-slate-950/45 hover:bg-slate-950 border-l-4 border-blue-500 rounded-r-lg p-2 mb-1.5 transition text-xs shrink-0 select-none block"
                        >
                          <span className="font-extrabold text-blue-400 block text-[9px] mb-0.5">
                            {msg.replyTo.senderName}
                          </span>
                          <span className="text-slate-400 font-light truncate block">
                            {msg.replyTo.text}
                          </span>
                        </button>
                      )}

                      {/* Group Sender Name Header */}
                      {activeChat.isGroup && !isSelf && msg.senderId !== "00000000000000000000lucy" && msg.senderId !== "0000000000000000000010c1" && (
                        <span className="text-[10px] font-extrabold text-blue-400 mb-0.5 block">
                          {senderUser?.displayName || `User @${msg.senderId.slice(-4)}`}
                        </span>
                      )}

                      {/* Lucy Sender Name Header */}
                      {(msg.senderId === "00000000000000000000lucy" || msg.senderId === "0000000000000000000010c1") && (
                        <span className="text-[10px] font-extrabold text-pink-400 mb-0.5 block flex items-center gap-1.5 select-none">
                          <span>Lucy 💋</span>
                          <span className="bg-pink-500/25 text-pink-300 text-[8px] px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wider font-bold">AI Bot</span>
                        </span>
                      )}

                      {/* Render Star Badge Indicator */}
                      {isStarred && (
                        <span className="absolute top-2 right-2.5 text-yellow-400 opacity-60">
                          <Star className="w-3 h-3 fill-yellow-400" />
                        </span>
                      )}

                      {/* Message Content: Image */}
                      {msg.mediaType === "image" && msg.mediaUrl && (
                        <div className="rounded-xl overflow-hidden mb-1 border border-slate-950 bg-slate-950 shadow-inner max-w-xs relative group-media">
                          <img 
                            src={msg.mediaUrl} 
                            alt="Shared Photo" 
                            className="max-w-full max-h-60 object-contain hover:scale-102 transition duration-200 cursor-pointer" 
                            referrerPolicy="no-referrer"
                            onClick={() => window.open(msg.mediaUrl, "_blank")}
                          />
                        </div>
                      )}

                      {/* Message Content: Voice */}
                      {msg.mediaType === "voice" && msg.mediaUrl && (
                        <div className="mb-1 shrink-0">
                          <VoicePlayer url={msg.mediaUrl} />
                        </div>
                      )}

                      {/* Message Content: File */}
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

                      {/* Message Content: Poll Card */}
                      {msg.mediaType === "poll" && msg.poll && (() => {
                        const votes = msg.poll.votes || {};
                        const options = msg.poll.options || [];
                        const optionVotesArray = options.map((opt, idx) => votes[idx] || []);
                        const totalVotes = optionVotesArray.reduce((acc, current) => acc + current.length, 0);

                        return (
                          <div className="bg-slate-950/45 border border-slate-800/80 rounded-xl p-3.5 space-y-3 min-w-[250px] max-w-xs shrink-0 text-left">
                            <div className="flex items-center gap-2">
                              <BarChart2 className="w-4 h-4 text-blue-400 shrink-0" />
                              <span className="text-xs font-bold text-white tracking-wide">{msg.poll.question}</span>
                            </div>

                            <div className="space-y-2">
                              {options.map((opt, idx) => {
                                const optionVotes = optionVotesArray[idx] || [];
                                const hasVoted = optionVotes.includes(currentUser.id);
                                const percentage = totalVotes > 0 ? Math.round((optionVotes.length / totalVotes) * 100) : 0;

                                return (
                                  <button
                                    key={idx}
                                    onClick={() => handlePollVote(msg.id, idx)}
                                    className={`w-full text-left rounded-lg p-2.5 border text-[11px] font-medium transition-all relative overflow-hidden flex justify-between items-center group/opt ${
                                      hasVoted 
                                        ? "bg-blue-600/10 border-blue-500/30 text-blue-300" 
                                        : "bg-slate-900/50 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                                    }`}
                                  >
                                    {/* Animated Progress Bar Fill */}
                                    <div 
                                      className="absolute inset-y-0 left-0 bg-blue-500/10 transition-all duration-500" 
                                      style={{ width: `${percentage}%` }}
                                    />
                                    
                                    <span className="relative z-10 block truncate max-w-[80%] pr-1">{opt}</span>
                                    <div className="relative z-10 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 font-mono shrink-0">
                                      <span>{optionVotes.length}</span>
                                      <span className="opacity-40 font-normal">({percentage}%)</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wide border-t border-slate-900 pt-2 shrink-0 select-none">
                              <span>Interactive Poll</span>
                              <span>{totalVotes} total votes</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Text content */}
                      {msg.mediaType === "text" && renderMessageText(msg.text)}

                      {/* Metadata line (Timestamp + Receipts + Disappearing) */}
                      <div className="flex items-center justify-end gap-1.5 text-[9px] text-slate-500 mt-1 self-end shrink-0 select-none">
                        {msg.selfDestructIn && <DisappearingCounter msg={msg} />}
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

                    {/* Reaction Display Chips stacked at bottom */}
                    {msg.reactions && msg.reactions.length > 0 && (() => {
                      // Group identical emojis
                      const grouped = msg.reactions.reduce((acc: any, r: any) => {
                        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                        return acc;
                      }, {});

                      return (
                        <div className={`flex flex-wrap gap-1.5 mt-1 select-none ${isSelf ? "self-end justify-end" : "self-start justify-start"}`}>
                          {Object.entries(grouped).map(([emoji, count]: any) => {
                            const reactedByMe = msg.reactions.some((r: any) => r.userId === currentUser.id && r.emoji === emoji);
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition cursor-pointer active:scale-95 ${
                                  reactedByMe 
                                    ? "bg-blue-600/10 border-blue-500/30 text-blue-300 shadow-sm" 
                                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="text-[10px] opacity-70 font-mono font-bold">{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                  </div>
                </motion.div>
              );
            })
          )}

          {/* Live Typing indicator bubble */}
          {!activeChat.isGroup && partner && typingUsers[partner.id] && (
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

          {/* Lucy typing indicator */}
          {(typingUsers["00000000000000000000lucy"] || typingUsers["0000000000000000000010c1"]) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-pink-950/20 border border-pink-500/20 rounded-2xl px-4 py-2.5 text-pink-400 text-[10px] flex items-center gap-1.5 font-medium shadow-sm">
                <span className="font-bold text-pink-300">Lucy 💋</span>
                <span>is typing...</span>
                <span className="flex gap-0.5 ml-0.5 mt-1 shrink-0">
                  <span className="w-1 h-1 bg-pink-500 rounded-full animate-bounce"></span>
                  <span className="w-1 h-1 bg-pink-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1 h-1 bg-pink-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Action Panel Bar */}
        <div className="p-3 bg-slate-950 border-t border-blue-500/10 flex flex-col gap-2 relative shrink-0">
          
          {/* Tag Suggestions Overlay Panel */}
          <AnimatePresence>
            {showTagSuggestions && activeChat.isGroup && (
              (() => {
                const suggestions = activeChat.participants?.filter(p => 
                  p.id !== currentUser.id && 
                  (p.username.toLowerCase().includes(tagFilter) || p.displayName.toLowerCase().includes(tagFilter))
                ) || [];

                if (suggestions.length === 0) return null;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    className="absolute bottom-full mb-2 left-3 right-3 bg-slate-900 border border-blue-500/15 rounded-2xl p-2 shadow-2xl z-40 max-w-xs overflow-hidden flex flex-col divide-y divide-slate-800/50"
                  >
                    <div className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-slate-500">
                      Mention Member
                    </div>
                    <div className="max-h-40 overflow-y-auto scrollbar-thin">
                      {suggestions.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleSelectTag(user.username)}
                          className="w-full px-3 py-2 text-left hover:bg-blue-600/10 text-xs flex items-center gap-2 transition"
                        >
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-blue-900/40 flex items-center justify-center text-blue-400 text-[8px] font-bold">
                              {user.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 truncate min-w-0">
                            <span className="font-bold text-white block leading-tight text-[11px]">{user.displayName}</span>
                            <span className="text-[9px] text-slate-400 block leading-none">@{user.username}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                );
              })()
            )}
          </AnimatePresence>
          
          {/* Quoted Replying Preview Banner */}
          {replyingToMessage && (
            <div className="flex items-center justify-between gap-3 bg-slate-900/80 border border-blue-500/10 rounded-xl px-4 py-3 text-xs animate-fade-in shrink-0 relative">
              <div className="flex-1 min-w-0 border-l-4 border-blue-500 pl-3">
                <span className="font-bold text-blue-400 block text-[10px]">
                  Replying to @{activeChat.participants?.find(p => p.id === replyingToMessage.senderId)?.username || replyingToMessage.senderId.slice(-4)}
                </span>
                <span className="text-slate-400 truncate block mt-0.5 max-w-lg font-light">
                  {replyingToMessage.mediaType === "text" ? replyingToMessage.text : `[${replyingToMessage.mediaType} Attachment]`}
                </span>
              </div>
              <button 
                onClick={() => setReplyingToMessage(null)}
                className="p-1.5 bg-slate-950/60 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Interactive Interactive Poll Creator Panel Overlay */}
          <AnimatePresence>
            {showPollCreator && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.98 }}
                className="absolute bottom-16 left-3 right-3 bg-slate-950 border border-blue-500/15 rounded-2xl p-4 shadow-2xl z-30 space-y-4 max-w-md mx-auto"
              >
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <BarChart2 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Create Interactive Poll</span>
                  </div>
                  <button 
                    onClick={() => setShowPollCreator(false)}
                    className="p-1 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Poll Question</label>
                    <input
                      type="text"
                      placeholder="Ask a question..."
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/40 transition"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex justify-between">
                      <span>Poll Options</span>
                      <span className="text-slate-600 font-mono font-normal">Min 2, Max 6</span>
                    </label>
                    
                    <div className="space-y-1.5 max-h-36 overflow-y-auto scrollbar-thin">
                      {pollOptions.map((opt, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder={`Option ${idx + 1}`}
                            value={opt}
                            onChange={(e) => {
                              const updated = [...pollOptions];
                              updated[idx] = e.target.value;
                              setPollOptions(updated);
                            }}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500/40 transition"
                          />
                          {pollOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                              className="p-2 text-red-400 hover:bg-slate-900 rounded-lg transition shrink-0"
                            >
                              <X className="w-4.5 h-4.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {pollOptions.length < 6 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions([...pollOptions, ""])}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-900/60 border border-dashed border-slate-800 rounded-xl text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1 transition"
                      >
                        <Plus className="w-3.5 h-3.5 text-blue-500" />
                        <span>Add Option</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowPollCreator(false)}
                    className="px-4 py-2 bg-slate-900 text-slate-400 hover:text-white rounded-xl text-xs transition font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreatePoll}
                    disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim() !== "").length < 2}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs transition font-bold disabled:opacity-40 disabled:pointer-events-none shadow"
                  >
                    Post Poll
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            
            {/* Toolbar Buttons */}
            <div className="flex items-center gap-1 shrink-0 justify-start">
              {/* File/Attachment Clip Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-blue-400 transition shrink-0 cursor-pointer"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
              />

              {/* Create Poll Trigger Button (WhatsApp style) */}
              <button
                onClick={() => setShowPollCreator(!showPollCreator)}
                className={`p-2 rounded-xl transition shrink-0 cursor-pointer ${showPollCreator ? "bg-blue-600/10 text-blue-400 hover:bg-blue-600/20" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}
                title="Create Interactive Poll"
              >
                <BarChart2 className="w-4 h-4" />
              </button>

              {/* Self Destruct Countdown Disappearing Message Trigger (Telegram style) */}
              <button
                onClick={() => {
                  // Rotate timer list: Off -> 5s -> 10s -> 30s -> Off
                  let next = 0;
                  if (selfDestructTimer === 0) next = 5;
                  else if (selfDestructTimer === 5) next = 10;
                  else if (selfDestructTimer === 10) next = 30;
                  setSelfDestructTimer(next);
                }}
                className={`p-2 rounded-xl transition shrink-0 cursor-pointer relative flex items-center gap-1 ${
                  selfDestructTimer > 0 
                    ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20" 
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
                title={`Disappearing Message Timer: ${selfDestructTimer > 0 ? `${selfDestructTimer}s` : "Off"}`}
              >
                <Flame className={`w-4 h-4 ${selfDestructTimer > 0 ? "text-red-500 animate-pulse" : ""}`} />
                {selfDestructTimer > 0 && <span className="text-[9px] font-mono font-extrabold">{selfDestructTimer}s</span>}
              </button>

              {/* Emoji Toggle button */}
              <button
                onClick={() => setShowEmojis(!showEmojis)}
                className={`p-2 rounded-xl transition shrink-0 cursor-pointer ${showEmojis ? "bg-blue-600/10 text-blue-400 hover:bg-blue-600/20" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}
                title="Insert emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
            </div>

            {/* Input text / Recording state switcher */}
            <div className="flex-1 min-w-0 w-full">
              {isRecording ? (
                // RECORDING PULSING STATE PANEL
                <div className="bg-slate-900 border border-red-500/20 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs w-full">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping shrink-0"></span>
                    <span className="text-red-400 font-bold shrink-0">Recording Voice</span>
                    <span className="text-slate-500 font-mono font-medium ml-1 shrink-0">{formatRecordTime(recordingTime)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={cancelRecording}
                      className="px-2.5 py-1 bg-slate-800 text-slate-400 rounded-lg hover:text-white hover:bg-slate-700 transition cursor-pointer text-[9px] font-bold uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button"
                      onClick={stopRecording}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition cursor-pointer text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              ) : (
                // REGULAR INPUT FORM
                <form onSubmit={handleSendText} className="flex gap-2 w-full">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    placeholder={uploading ? "Uploading media..." : "Write a message..."}
                    disabled={uploading}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 transition-all min-w-0"
                  />

                  {inputText.trim() ? (
                    // SEND TEXT BUTTON
                    <button
                      type="submit"
                      className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition shrink-0 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-95 cursor-pointer flex items-center justify-center"
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
                      className="p-2 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-red-400 transition shrink-0 cursor-pointer"
                      title="Record voice message"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </form>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Group Info Right Sidebar */}
      {showGroupInfo && activeChat.isGroup && (() => {
        const isCurrentUserAdmin = activeChat.admins?.includes(currentUser.id);
        return (
          <div className="w-full md:w-80 border-l border-blue-500/10 bg-slate-950 flex flex-col h-full animate-fade-in shrink-0 absolute md:relative right-0 top-0 z-20">
            {/* Header */}
            <div className="p-4 border-b border-blue-500/10 flex items-center justify-between bg-slate-900/20">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="font-extrabold text-xs text-white uppercase tracking-wider">Group Details</span>
              </div>
              <button 
                onClick={() => setShowGroupInfo(false)}
                className="p-1 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              
              {/* Notifications */}
              {groupActionError && (
                <div className="p-2.5 bg-red-950/40 border border-red-500/20 text-red-400 text-[11px] rounded-xl flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                  <span className="flex-1">{groupActionError}</span>
                  <button onClick={() => setGroupActionError("")} className="text-slate-500 hover:text-white text-xs">×</button>
                </div>
              )}

              {groupActionSuccess && (
                <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-[11px] rounded-xl flex items-center gap-2 animate-fade-in">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span className="flex-1">{groupActionSuccess}</span>
                  <button onClick={() => setGroupActionSuccess("")} className="text-slate-500 hover:text-white text-xs">×</button>
                </div>
              )}

              {/* Group Card / Avatar section */}
              <div className="flex flex-col items-center text-center space-y-3 p-4 bg-slate-900/30 rounded-2xl border border-blue-500/5 relative">
                <div className="relative group">
                  {activeChat.avatarUrl ? (
                    <img src={activeChat.avatarUrl} alt="" className="w-20 h-20 rounded-2xl object-cover border border-blue-500/20" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-950 to-blue-950 border border-blue-500/20 flex items-center justify-center shadow-lg">
                      <Users className="w-8 h-8 text-blue-400" />
                    </div>
                  )}
                  
                  {isCurrentUserAdmin && (
                    <button
                      onClick={() => setIsEditingPic(!isEditingPic)}
                      className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg transition active:scale-90 cursor-pointer"
                      title="Change Avatar"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Edit Pic Input Form */}
                {isEditingPic && (
                  <div className="w-full space-y-2.5 mt-2 pt-2 border-t border-slate-800/50 text-left">
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block mb-1">Upload from Device</span>
                      <button
                        type="button"
                        onClick={() => groupPicInputRef.current?.click()}
                        disabled={groupPicUploading}
                        className="w-full py-1.5 bg-blue-600/10 hover:bg-blue-600/20 border border-dashed border-blue-500/30 text-blue-400 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{groupPicUploading ? "Uploading..." : "Choose Image File"}</span>
                      </button>
                      <input
                        type="file"
                        ref={groupPicInputRef}
                        onChange={handleGroupPicUpload}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-slate-800/40"></div>
                      <span className="flex-shrink mx-2 text-[8px] font-mono text-slate-600 uppercase">Or Enter Link</span>
                      <div className="flex-grow border-t border-slate-800/40"></div>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block mb-1">Avatar Image URL</span>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={editedPic}
                          onChange={(e) => setEditedPic(e.target.value)}
                          placeholder="https://..."
                          className="flex-1 bg-slate-950 border border-slate-850 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={handleSaveGroupPic}
                          className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition shrink-0"
                          title="Save Link"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setIsEditingPic(false)}
                          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition shrink-0"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Group Name Display or Input */}
                <div className="w-full">
                  {isEditingName ? (
                    <div className="flex gap-1 items-center justify-center mt-1">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="bg-slate-950 border border-slate-850 rounded-lg px-2 py-1 text-xs text-center font-bold text-white focus:outline-none focus:border-blue-500 w-4/5"
                      />
                      <button
                        onClick={handleSaveGroupName}
                        className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setIsEditingName(false)}
                        className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      <h4 className="text-sm font-extrabold text-white tracking-tight">{activeChat.name || "Secure Group"}</h4>
                      {isCurrentUserAdmin && (
                        <button
                          onClick={() => setIsEditingName(true)}
                          className="text-slate-500 hover:text-white transition p-0.5 rounded hover:bg-slate-900"
                          title="Edit Name"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 font-mono mt-1">Chat ID: {activeChat.id.slice(-8).toUpperCase()}</p>
                </div>
              </div>

              {/* Description section */}
              <div className="space-y-1.5 bg-slate-900/10 border border-slate-900/50 p-3 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Channel Description</span>
                  {isCurrentUserAdmin && !isEditingDesc && (
                    <button
                      onClick={() => setIsEditingDesc(true)}
                      className="text-slate-500 hover:text-white transition p-0.5 rounded hover:bg-slate-900"
                      title="Edit Description"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                
                {isEditingDesc ? (
                  <div className="space-y-1.5 pt-1">
                    <textarea
                      value={editedDesc}
                      onChange={(e) => setEditedDesc(e.target.value)}
                      rows={2}
                      placeholder="Enter description..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={handleSaveGroupDesc}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Save</span>
                      </button>
                      <button
                        onClick={() => setIsEditingDesc(false)}
                        className="px-2 py-1 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-300 leading-relaxed font-normal">
                    {activeChat.description || "No description provided for this channel."}
                  </div>
                )}
              </div>

              {/* Add Participant Section (Admin-only) */}
              {isCurrentUserAdmin && (
                <div className="space-y-2 bg-slate-900/10 border border-slate-900/50 p-3 rounded-2xl">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5 text-blue-500" />
                    <span>Add Group Member</span>
                  </span>
                  <form onSubmit={handleAddParticipant} className="flex gap-1.5">
                    <input
                      type="text"
                      value={addUsername}
                      onChange={(e) => setAddUsername(e.target.value)}
                      placeholder="Enter username..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!addUsername.trim()}
                      className="px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition cursor-pointer shrink-0 flex items-center justify-center"
                      title="Add user"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}

              {/* Participants List */}
              <div className="space-y-2">
                <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block">Participants ({activeChat.participants?.length || 0})</span>
                
                <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
                  {activeChat.participants?.map(user => {
                    const isAdmin = activeChat.admins?.includes(user.id);
                    const isMe = user.id === currentUser.id;

                    return (
                      <div key={user.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/10 border border-slate-900/50 hover:bg-slate-900/40 transition">
                        <button
                          onClick={() => setSelectedProfileUser(user)}
                          className="flex items-center gap-2 min-w-0 text-left cursor-pointer hover:opacity-80 active:scale-98 transition flex-1"
                        >
                          <div className="relative shrink-0">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-400">
                                {user.displayName.charAt(0)}
                              </div>
                            )}
                            {user.status === "online" && (
                              <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-slate-950 rounded-full"></span>
                            )}
                          </div>
                          <div className="min-w-0 leading-none">
                            <span className="text-[11px] font-bold text-white block truncate">
                              {user.displayName} {isMe && <span className="text-[9px] text-slate-500 font-normal">(You)</span>}
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono">@{user.username}</span>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          {isAdmin && (
                            <Crown className="w-3.5 h-3.5 text-amber-500" title="Group Administrator" />
                          )}
                          
                          {/* Admin actions if current user is an Admin and this is not myself */}
                          {isCurrentUserAdmin && !isMe && (
                            <div className="flex items-center gap-1 ml-2 border-l border-slate-800 pl-1.5">
                              {isAdmin ? (
                                <button
                                  onClick={() => handleParticipantAction("demote", user.username)}
                                  className="p-1 text-slate-500 hover:text-amber-500 hover:bg-slate-900 rounded transition cursor-pointer"
                                  title="Demote Admin"
                                >
                                  <X className="w-3.5 h-3.5 text-red-400" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleParticipantAction("promote", user.username)}
                                  className="p-1 text-slate-500 hover:text-amber-500 hover:bg-slate-900 rounded transition cursor-pointer"
                                  title="Promote to Admin"
                                >
                                  <Crown className="w-3.5 h-3.5 text-slate-500 hover:text-amber-450" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to kick ${user.displayName}?`)) {
                                    handleParticipantAction("kick", user.username);
                                  }
                                }}
                                className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded transition cursor-pointer"
                                title="Kick from Group"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leave Group Button */}
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to leave this group chat?")) {
                    onSendMessage("/leave");
                    setShowGroupInfo(false);
                  }
                }}
                className="w-full py-2 bg-red-950/30 hover:bg-red-950/50 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer mt-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Depart Group Chat</span>
              </button>

            </div>
          </div>
        );
      })()}

      {/* Profile Detail Modal Layer */}
      <AnimatePresence>
        {selectedProfileUser && (
          <ProfileModal
            user={selectedProfileUser}
            onClose={() => setSelectedProfileUser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
