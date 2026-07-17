export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  status: "online" | "offline";
  lastSeen: string;
  bio?: string;
  customStatus?: string;
}

export interface Chat {
  id: string;
  isPinned: boolean;
  unreadCount: number;
  updatedAt: string;
  isGroup?: boolean;
  name?: string;
  description?: string;
  avatarUrl?: string;
  admins?: string[];
  participants?: User[];
  otherParticipant: User | null;
  lastMessage: {
    id: string;
    text: string;
    mediaType: "text" | "image" | "voice" | "file";
    senderId: string;
    createdAt: string;
  } | null;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  mediaUrl?: string;
  mediaType: "text" | "image" | "voice" | "file" | "poll";
  readBy: string[];
  createdAt: string;
  
  // WhatsApp / Telegram enhanced features
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  reactions?: Array<{
    emoji: string;
    userId: string;
  }>;
  poll?: {
    question: string;
    options: string[];
    votes: Record<number, string[]>; // option index -> userIds list
  };
  selfDestructIn?: number; // countdown in seconds
  isStarred?: boolean; // Starred/saved message
}
