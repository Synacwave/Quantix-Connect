import mongoose from "mongoose";
import fs from "fs";
import path from "path";

// Initialize environment
const MONGODB_URI = process.env.MONGODB_URI;
export let isMongoDB = !!MONGODB_URI;

// --- MONGODB SCHEMA DEFINITIONS ---

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, required: true },
  passwordHash: { type: String, required: true },
  avatarUrl: { type: String, default: "" },
  status: { type: String, enum: ["online", "offline"], default: "offline" },
  lastSeen: { type: Date, default: Date.now },
  bio: { type: String, default: "Hey there! I am using Quantix Connect." },
  customStatus: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

const ChatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  unreadCounts: { type: Map, of: Number, default: {} },
  lucyEnabled: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const MessageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, default: "" },
  mediaUrl: { type: String, default: "" },
  mediaType: { type: String, enum: ["text", "image", "voice", "file", "poll"], default: "text" },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  replyTo: {
    id: String,
    text: String,
    senderName: String
  },
  reactions: [{
    emoji: String,
    userId: String
  }],
  poll: {
    question: String,
    options: [String],
    votes: { type: Map, of: [String], default: {} } // index -> list of user ids
  },
  selfDestructIn: Number,
  createdAt: { type: Date, default: Date.now }
});

export let MongoUser: any;
export let MongoChat: any;
export let MongoMessage: any;

if (isMongoDB) {
  // Define models immediately so they are available, but they won't be queried if isMongoDB becomes false
  MongoUser = mongoose.model("User", UserSchema);
  MongoChat = mongoose.model("Chat", ChatSchema);
  MongoMessage = mongoose.model("Message", MessageSchema);

  mongoose.connect(MONGODB_URI!, {
    serverSelectionTimeoutMS: 4000, // Fail fast after 4 seconds
    connectTimeoutMS: 5000,
  }).then(() => {
    console.log("🟢 Quantix DB: Successfully connected to MongoDB Atlas!");
  }).catch((err) => {
    console.error("🔴 Quantix DB: MongoDB connection failed, falling back to Local JSON DB:", err.message || err);
    isMongoDB = false;
  });

  // Handle runtime connection errors to prevent process crash
  mongoose.connection.on("error", (err) => {
    console.error("🔴 Quantix DB: Runtime MongoDB error:", err.message || err);
    isMongoDB = false;
  });
} else {
  console.log("🟡 Quantix DB: No MONGODB_URI found. Running in Local JSON Database Mode for immediate execution!");
}

// --- LOCAL JSON DATABASE IMPLEMENTATION ---

const LOCAL_DB_PATH = path.join(process.cwd(), "data", "db.json");

interface LocalUser {
  _id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  avatarUrl: string;
  status: "online" | "offline";
  lastSeen: string;
  bio?: string;
  customStatus?: string;
  createdAt: string;
}

interface LocalChat {
  _id: string;
  participants: string[]; // User IDs
  pinnedBy: string[]; // User IDs
  lastMessage: any; // Message details or ID
  unreadCounts: Record<string, number>; // userId -> count
  lucyEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LocalMessage {
  _id: string;
  chatId: string;
  senderId: string;
  text: string;
  mediaUrl: string;
  mediaType: "text" | "image" | "voice" | "file" | "poll";
  readBy: string[]; // User IDs
  deletedFor: string[]; // User IDs
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
    votes: Record<number, string[]>;
  };
  selfDestructIn?: number;
  createdAt: string;
}

interface LocalDB {
  users: LocalUser[];
  chats: LocalChat[];
  messages: LocalMessage[];
}

function ensureLocalDB() {
  const dir = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    const initialData: LocalDB = { users: [], chats: [], messages: [] };
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initialData, null, 2));
  }
}

function readLocalDB(): LocalDB {
  ensureLocalDB();
  try {
    const content = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    return { users: [], chats: [], messages: [] };
  }
}

function writeLocalDB(data: LocalDB) {
  ensureLocalDB();
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
}

// Generate unique string ID
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// --- UNIFIED DATABASE ADAPTER ---
// This class routes queries to MongoDB or the Local DB depending on settings.

export const db = {
  // --- USER METHODS ---
  async findUserById(id: string) {
    if (id === "0000000000000000000010c1") {
      return {
        _id: "0000000000000000000010c1",
        username: "lucy",
        displayName: "Lucy 💋",
        avatarUrl: "https://i.ibb.co/1JPF7yK8/photo-2026-07-18-14-35-08-7663876635812167736.jpg",
        status: "online",
        lastSeen: new Date().toISOString(),
        bio: "Seductive & playful AI chatbot assistant.",
        customStatus: "Teasing you...",
        createdAt: new Date().toISOString()
      };
    }
    if (isMongoDB && MongoUser) {
      return MongoUser.findById(id).select("-passwordHash");
    } else {
      const store = readLocalDB();
      const user = store.users.find(u => u._id === id);
      if (!user) return null;
      const { passwordHash, ...rest } = user;
      return rest;
    }
  },

  async findUserByUsername(username: string) {
    const lowerUsername = username.toLowerCase();
    if (lowerUsername === "lucy") {
      return {
        _id: "0000000000000000000010c1",
        username: "lucy",
        displayName: "Lucy 💋",
        avatarUrl: "https://i.ibb.co/1JPF7yK8/photo-2026-07-18-14-35-08-7663876635812167736.jpg",
        status: "online",
        lastSeen: new Date().toISOString(),
        bio: "Seductive & playful AI chatbot assistant.",
        customStatus: "Teasing you...",
        createdAt: new Date().toISOString()
      };
    }
    if (isMongoDB && MongoUser) {
      return MongoUser.findOne({ username: lowerUsername });
    } else {
      const store = readLocalDB();
      return store.users.find(u => u.username.toLowerCase() === lowerUsername) || null;
    }
  },

  async createUser(userData: { username: string; displayName: string; passwordHash: string; avatarUrl?: string }) {
    if (isMongoDB && MongoUser) {
      const user = new MongoUser({
        username: userData.username.toLowerCase(),
        displayName: userData.displayName,
        passwordHash: userData.passwordHash,
        avatarUrl: userData.avatarUrl || "",
        bio: "Hey there! I am using Quantix Connect.",
        customStatus: ""
      });
      return await user.save();
    } else {
      const store = readLocalDB();
      const newUser: LocalUser = {
        _id: generateId(),
        username: userData.username.toLowerCase(),
        displayName: userData.displayName,
        passwordHash: userData.passwordHash,
        avatarUrl: userData.avatarUrl || "",
        status: "offline",
        lastSeen: new Date().toISOString(),
        bio: "Hey there! I am using Quantix Connect.",
        customStatus: "",
        createdAt: new Date().toISOString()
      };
      store.users.push(newUser);
      writeLocalDB(store);
      const { passwordHash, ...rest } = newUser;
      return rest;
    }
  },

  async updateUser(id: string, updates: Partial<LocalUser>) {
    if (isMongoDB && MongoUser) {
      return MongoUser.findByIdAndUpdate(id, updates, { new: true }).select("-passwordHash");
    } else {
      const store = readLocalDB();
      const idx = store.users.findIndex(u => u._id === id);
      if (idx === -1) return null;
      store.users[idx] = { ...store.users[idx], ...updates };
      writeLocalDB(store);
      const { passwordHash, ...rest } = store.users[idx];
      return rest;
    }
  },

  async searchUsers(query: string, excludeId: string) {
    const q = query.toLowerCase();
    if (isMongoDB && MongoUser) {
      return MongoUser.find({
        _id: { $ne: excludeId },
        $or: [
          { username: { $regex: q, $options: "i" } },
          { displayName: { $regex: q, $options: "i" } }
        ]
      }).select("-passwordHash").limit(20);
    } else {
      const store = readLocalDB();
      return store.users
        .filter(u => u._id !== excludeId && (u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)))
        .map(({ passwordHash, ...rest }) => rest)
        .slice(0, 20);
    }
  },

  // --- CHAT METHODS ---
  async getChatsForUser(userId: string) {
    if (isMongoDB && MongoChat) {
      const chats = await MongoChat.find({ participants: userId })
        .populate("participants", "-passwordHash")
        .populate("lastMessage")
        .sort({ updatedAt: -1 });
      return chats;
    } else {
      const store = readLocalDB();
      const chats = store.chats.filter(c => c.participants.includes(userId));
      
      // Populate and sort
      const populated = chats.map(c => {
        const participantsPopulated = c.participants.map(pid => {
          if (pid === "0000000000000000000010c1") {
            return {
              _id: "0000000000000000000010c1",
              username: "lucy",
              displayName: "Lucy 💋",
              avatarUrl: "https://i.ibb.co/1JPF7yK8/photo-2026-07-18-14-35-08-7663876635812167736.jpg",
              status: "online",
              lastSeen: new Date().toISOString(),
              bio: "Seductive & playful AI chatbot assistant.",
              customStatus: "Teasing you...",
              createdAt: new Date().toISOString()
            };
          }
          const user = store.users.find(u => u._id === pid);
          if (!user) return null;
          const { passwordHash, ...rest } = user;
          return rest;
        }).filter(Boolean);

        // Fetch last message details
        const chatMsgs = store.messages.filter(m => m.chatId === c._id && !m.deletedFor.includes(userId));
        const lastMsgObj = chatMsgs.length > 0 ? chatMsgs[chatMsgs.length - 1] : null;

        return {
          ...c,
          participants: participantsPopulated,
          lastMessage: lastMsgObj
        };
      });

      return populated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
  },

  async getOrCreateDirectChat(userId1: string, userId2: string) {
    if (isMongoDB && MongoChat) {
      let chat = await MongoChat.findOne({
        participants: { $all: [userId1, userId2] },
        // Direct chats have exactly 2 participants
        $expr: { $eq: [{ $size: "$participants" }, 2] }
      }).populate("participants", "-passwordHash").populate("lastMessage");

      if (!chat) {
        chat = new MongoChat({
          participants: [userId1, userId2],
          pinnedBy: [],
          unreadCounts: { [userId1]: 0, [userId2]: 0 }
        });
        await chat.save();
        chat = await MongoChat.findById(chat._id).populate("participants", "-passwordHash");
      }
      return chat;
    } else {
      const store = readLocalDB();
      let chat = store.chats.find(c => 
        c.participants.length === 2 && 
        c.participants.includes(userId1) && 
        c.participants.includes(userId2)
      );

      if (!chat) {
        chat = {
          _id: generateId(),
          participants: [userId1, userId2],
          pinnedBy: [],
          lastMessage: null,
          unreadCounts: { [userId1]: 0, [userId2]: 0 },
          lucyEnabled: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        store.chats.push(chat);
        writeLocalDB(store);
      }

      const participantsPopulated = chat.participants.map(pid => {
        if (pid === "0000000000000000000010c1") {
          return {
            _id: "0000000000000000000010c1",
            username: "lucy",
            displayName: "Lucy 💋",
            avatarUrl: "https://i.ibb.co/1JPF7yK8/photo-2026-07-18-14-35-08-7663876635812167736.jpg",
            status: "online",
            lastSeen: new Date().toISOString(),
            bio: "Seductive & playful AI chatbot assistant.",
            customStatus: "Teasing you...",
            createdAt: new Date().toISOString()
          };
        }
        const user = store.users.find(u => u._id === pid);
        if (!user) return null;
        const { passwordHash, ...rest } = user;
        return rest;
      }).filter(Boolean);

      return {
        ...chat,
        participants: participantsPopulated
      };
    }
  },

  async togglePinChat(chatId: string, userId: string) {
    if (isMongoDB && MongoChat) {
      const chat = await MongoChat.findById(chatId);
      if (!chat) return null;
      const pinnedIndex = chat.pinnedBy.indexOf(userId);
      if (pinnedIndex > -1) {
        chat.pinnedBy.splice(pinnedIndex, 1);
      } else {
        chat.pinnedBy.push(userId);
      }
      await chat.save();
      return chat;
    } else {
      const store = readLocalDB();
      const idx = store.chats.findIndex(c => c._id === chatId);
      if (idx === -1) return null;
      const chat = store.chats[idx];
      const pinnedIndex = chat.pinnedBy.indexOf(userId);
      if (pinnedIndex > -1) {
        chat.pinnedBy.splice(pinnedIndex, 1);
      } else {
        chat.pinnedBy.push(userId);
      }
      writeLocalDB(store);
      return chat;
    }
  },

  async toggleLucyChat(chatId: string, enabled: boolean) {
    if (isMongoDB && MongoChat) {
      const chat = await MongoChat.findById(chatId);
      if (!chat) return null;
      chat.lucyEnabled = enabled;
      await chat.save();
      return chat;
    } else {
      const store = readLocalDB();
      const idx = store.chats.findIndex(c => c._id === chatId);
      if (idx === -1) return null;
      store.chats[idx].lucyEnabled = enabled;
      writeLocalDB(store);
      return store.chats[idx];
    }
  },

  // --- MESSAGE METHODS ---
  async getMessages(chatId: string, userId: string) {
    if (isMongoDB && MongoMessage) {
      return MongoMessage.find({
        chatId,
        deletedFor: { $ne: userId }
      }).sort({ createdAt: 1 });
    } else {
      const store = readLocalDB();
      return store.messages.filter(m => m.chatId === chatId && !m.deletedFor.includes(userId));
    }
  },

  async createMessage(msgData: {
    chatId: string;
    senderId: string;
    text?: string;
    mediaUrl?: string;
    mediaType?: "text" | "image" | "voice" | "file" | "poll";
    replyTo?: {
      id: string;
      text: string;
      senderName: string;
    };
    poll?: {
      question: string;
      options: string[];
    };
    selfDestructIn?: number;
  }) {
    if (isMongoDB && MongoMessage) {
      const msg = new MongoMessage({
        chatId: msgData.chatId,
        senderId: msgData.senderId,
        text: msgData.text || "",
        mediaUrl: msgData.mediaUrl || "",
        mediaType: msgData.mediaType || "text",
        readBy: [msgData.senderId],
        deletedFor: [],
        replyTo: msgData.replyTo,
        poll: msgData.poll ? {
          question: msgData.poll.question,
          options: msgData.poll.options,
          votes: {}
        } : undefined,
        selfDestructIn: msgData.selfDestructIn
      });
      await msg.save();

      // Update chat last message and unread count for other participants
      const chat = await MongoChat.findById(msgData.chatId);
      if (chat) {
        chat.lastMessage = msg._id;
        chat.updatedAt = new Date();
        chat.participants.forEach((pid: any) => {
          const pStr = pid.toString();
          if (pStr !== msgData.senderId) {
            const currentCount = chat.unreadCounts.get(pStr) || 0;
            chat.unreadCounts.set(pStr, currentCount + 1);
          }
        });
        await chat.save();
      }

      return msg;
    } else {
      const store = readLocalDB();
      const newMsg: LocalMessage = {
        _id: generateId(),
        chatId: msgData.chatId,
        senderId: msgData.senderId,
        text: msgData.text || "",
        mediaUrl: msgData.mediaUrl || "",
        mediaType: msgData.mediaType || "text",
        readBy: [msgData.senderId],
        deletedFor: [],
        replyTo: msgData.replyTo,
        poll: msgData.poll ? {
          question: msgData.poll.question,
          options: msgData.poll.options,
          votes: {}
        } : undefined,
        selfDestructIn: msgData.selfDestructIn,
        createdAt: new Date().toISOString()
      };
      store.messages.push(newMsg);

      // Update chat last message and unread counts
      const chatIdx = store.chats.findIndex(c => c._id === msgData.chatId);
      if (chatIdx !== -1) {
        const chat = store.chats[chatIdx];
        chat.lastMessage = newMsg;
        chat.updatedAt = new Date().toISOString();
        chat.participants.forEach(pid => {
          if (pid !== msgData.senderId) {
            chat.unreadCounts[pid] = (chat.unreadCounts[pid] || 0) + 1;
          }
        });
      }
      writeLocalDB(store);
      return newMsg;
    }
  },

  async deleteMessageForUser(messageId: string, userId: string) {
    if (isMongoDB && MongoMessage) {
      return MongoMessage.findByIdAndUpdate(messageId, {
        $addToSet: { deletedFor: userId }
      }, { new: true });
    } else {
      const store = readLocalDB();
      const idx = store.messages.findIndex(m => m._id === messageId);
      if (idx === -1) return null;
      if (!store.messages[idx].deletedFor.includes(userId)) {
        store.messages[idx].deletedFor.push(userId);
      }
      writeLocalDB(store);
      return store.messages[idx];
    }
  },

  async findMessage(messageId: string) {
    if (isMongoDB && MongoMessage) {
      return MongoMessage.findById(messageId);
    } else {
      const store = readLocalDB();
      return store.messages.find(m => m._id === messageId) || null;
    }
  },

  async editMessage(messageId: string, text: string) {
    if (isMongoDB && MongoMessage) {
      return MongoMessage.findByIdAndUpdate(messageId, { text }, { new: true });
    } else {
      const store = readLocalDB();
      const idx = store.messages.findIndex(m => m._id === messageId);
      if (idx === -1) return null;
      store.messages[idx].text = text;
      writeLocalDB(store);
      return store.messages[idx];
    }
  },

  async markMessagesAsRead(chatId: string, userId: string) {
    if (isMongoDB && MongoMessage) {
      await MongoMessage.updateMany(
        { chatId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );

      // Clear unread count for this user
      const chat = await MongoChat.findById(chatId);
      if (chat) {
        chat.unreadCounts.set(userId, 0);
        await chat.save();
      }
      return true;
    } else {
      const store = readLocalDB();
      // Mark read
      store.messages.forEach(m => {
        if (m.chatId === chatId && !m.readBy.includes(userId)) {
          m.readBy.push(userId);
        }
      });
      // Clear count
      const chatIdx = store.chats.findIndex(c => c._id === chatId);
      if (chatIdx !== -1) {
        store.chats[chatIdx].unreadCounts[userId] = 0;
      }
      writeLocalDB(store);
      return true;
    }
  }
};
