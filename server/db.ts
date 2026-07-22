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
  createdAt: { type: Date, default: Date.now },
  isBanned: { type: Boolean, default: false },
  bannedUntil: { type: Date },
  blockedUsers: [{ type: String, default: [] }],
  isAdmin: { type: Boolean, default: false }
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
  isBroadcast: { type: Boolean, default: false },
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

const ReportSchema = new mongoose.Schema({
  type: { type: String, enum: ["issue", "user"], required: true },
  reporterId: { type: String, required: true },
  reportedUserId: { type: String },
  category: { type: String },
  reason: { type: String },
  title: { type: String },
  description: { type: String },
  screenshot: { type: String },
  messagesContext: [{
    senderUsername: String,
    senderId: String,
    text: String,
    createdAt: Date
  }],
  createdAt: { type: Date, default: Date.now }
});

export let MongoUser: any;
export let MongoChat: any;
export let MongoMessage: any;
export let MongoReport: any;

if (isMongoDB) {
  // Define models immediately so they are available, but they won't be queried if isMongoDB becomes false
  MongoUser = mongoose.model("User", UserSchema);
  MongoChat = mongoose.model("Chat", ChatSchema);
  MongoMessage = mongoose.model("Message", MessageSchema);
  MongoReport = mongoose.model("Report", ReportSchema);

  mongoose.connect(MONGODB_URI!, {
    serverSelectionTimeoutMS: 4000, // Fail fast after 4 seconds
    connectTimeoutMS: 5000,
  }).then(async () => {
    console.log("🟢 Quantix DB: Successfully connected to MongoDB Atlas!");
    try {
      const lucyExists = await MongoUser.findById("0000000000000000000010c1");
      if (!lucyExists) {
        console.log("🌸 Seeding Lucy AI user into MongoDB Atlas...");
        const lucyUser = new MongoUser({
          _id: "0000000000000000000010c1",
          username: "lucy",
          displayName: "Lucy ✨",
          passwordHash: "lucy_ai_bot_dummy_hash_no_login",
          avatarUrl: "https://i.ibb.co/1JPF7yK8/photo-2026-07-18-14-35-08-7663876635812167736.jpg",
          status: "online",
          lastSeen: new Date().toISOString(),
          bio: "Lucy is your cheerful AI companion, lovingly created by Expectations for Quantix Connect. She's here to help you learn, build, create and brighten your day.",
          customStatus: "Here to brighten your day! ✨",
          createdAt: new Date().toISOString()
        });
        await lucyUser.save();
        console.log("🌸 Lucy AI user seeded successfully!");
      }
    } catch (seedErr: any) {
      console.error("🔴 Failed to seed/verify Lucy AI user in MongoDB:", seedErr.message || seedErr);
    }
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
  isBanned?: boolean;
  bannedUntil?: string;
  blockedUsers?: string[];
  isAdmin?: boolean;
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
  isBroadcast?: boolean;
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

interface LocalReport {
  _id: string;
  type: "issue" | "user";
  reporterId: string;
  reportedUserId?: string;
  category?: string;
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

interface LocalDB {
  users: LocalUser[];
  chats: LocalChat[];
  messages: LocalMessage[];
  reports: LocalReport[];
}

function ensureLocalDB() {
  const dir = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    const initialData: LocalDB = { users: [], chats: [], messages: [], reports: [] };
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initialData, null, 2));
  }
}

function readLocalDB(): LocalDB {
  ensureLocalDB();
  try {
    const content = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
    const parsed = JSON.parse(content);
    if (!parsed.reports) parsed.reports = [];
    return parsed;
  } catch (e) {
    return { users: [], chats: [], messages: [], reports: [] };
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

export function adjustUser(user: any) {
  if (!user) return user;
  const username = user.username ? user.username.toLowerCase() : "";
  const isSuperAdmin = username === "expectations";
  const isAdmin = isSuperAdmin || !!user.isAdmin;
  if (isAdmin && !user.displayName.endsWith(" ♠︎")) {
    user.displayName = user.displayName + " ♠︎";
  }
  return user;
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
        displayName: "Lucy ✨",
        avatarUrl: "https://i.ibb.co/1JPF7yK8/photo-2026-07-18-14-35-08-7663876635812167736.jpg",
        status: "online",
        lastSeen: new Date().toISOString(),
        bio: "Lucy is your cheerful AI companion, lovingly created by Expectations for Quantix Connect. She's here to help you learn, build, create and brighten your day.",
        customStatus: "Here to brighten your day! ✨",
        createdAt: new Date().toISOString()
      };
    }
    if (isMongoDB && MongoUser) {
      const u = await MongoUser.findById(id).select("-passwordHash");
      if (u) {
        const obj = u.toObject ? u.toObject() : u;
        return adjustUser(obj);
      }
      return null;
    } else {
      const store = readLocalDB();
      const user = store.users.find(u => u._id === id);
      if (!user) return null;
      const { passwordHash, ...rest } = user;
      return adjustUser(rest);
    }
  },

  async findUserByUsername(username: string) {
    const lowerUsername = username.toLowerCase();
    if (lowerUsername === "lucy") {
      return {
        _id: "0000000000000000000010c1",
        username: "lucy",
        displayName: "Lucy ✨",
        avatarUrl: "https://i.ibb.co/1JPF7yK8/photo-2026-07-18-14-35-08-7663876635812167736.jpg",
        status: "online",
        lastSeen: new Date().toISOString(),
        bio: "Lucy is your cheerful AI companion, lovingly created by Expectations for Quantix Connect. She's here to help you learn, build, create and brighten your day.",
        customStatus: "Here to brighten your day! ✨",
        createdAt: new Date().toISOString()
      };
    }
    if (isMongoDB && MongoUser) {
      const u = await MongoUser.findOne({ username: lowerUsername });
      if (u) {
        const obj = u.toObject ? u.toObject() : u;
        return adjustUser(obj);
      }
      return null;
    } else {
      const store = readLocalDB();
      const user = store.users.find(u => u.username.toLowerCase() === lowerUsername) || null;
      if (user) {
        const cloned = { ...user };
        return adjustUser(cloned);
      }
      return null;
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
      const u = await MongoUser.findByIdAndUpdate(id, updates, { new: true }).select("-passwordHash");
      if (u) {
        const obj = u.toObject ? u.toObject() : u;
        return adjustUser(obj);
      }
      return null;
    } else {
      const store = readLocalDB();
      const idx = store.users.findIndex(u => u._id === id);
      if (idx === -1) return null;
      store.users[idx] = { ...store.users[idx], ...updates };
      writeLocalDB(store);
      const { passwordHash, ...rest } = store.users[idx];
      return adjustUser(rest);
    }
  },

  async searchUsers(query: string, excludeId: string) {
    const q = query.toLowerCase();
    if (isMongoDB && MongoUser) {
      const users = await MongoUser.find({
        _id: { $ne: excludeId },
        $or: [
          { username: { $regex: q, $options: "i" } },
          { displayName: { $regex: q, $options: "i" } }
        ]
      }).select("-passwordHash").limit(20);
      return users.map((u: any) => {
        const obj = u.toObject ? u.toObject() : u;
        return adjustUser(obj);
      });
    } else {
      const store = readLocalDB();
      return store.users
        .filter(u => u._id !== excludeId && (u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)))
        .map(({ passwordHash, ...rest }) => {
          const cloned = { ...rest };
          return adjustUser(cloned);
        })
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
      return chats.map((c: any) => {
        const obj = c.toObject ? c.toObject() : c;
        if (obj.participants) {
          obj.participants = obj.participants.map((p: any) => adjustUser(p));
        }
        return obj;
      });
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
              displayName: "Lucy ✨",
              avatarUrl: "https://i.ibb.co/1JPF7yK8/photo-2026-07-18-14-35-08-7663876635812167736.jpg",
              status: "online",
              lastSeen: new Date().toISOString(),
              bio: "Lucy is your cheerful AI companion, lovingly created by Expectations for Quantix Connect. She's here to help you learn, build, create and brighten your day.",
              customStatus: "Here to brighten your day! ✨",
              createdAt: new Date().toISOString()
            };
          }
          const user = store.users.find(u => u._id === pid);
          if (!user) return null;
          const { passwordHash, ...rest } = user;
          return adjustUser(rest);
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
      
      if (chat) {
        const obj = chat.toObject ? chat.toObject() : chat;
        if (obj.participants) {
          obj.participants = obj.participants.map((p: any) => adjustUser(p));
        }
        return obj;
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
            displayName: "Lucy ✨",
            avatarUrl: "https://i.ibb.co/1JPF7yK8/photo-2026-07-18-14-35-08-7663876635812167736.jpg",
            status: "online",
            lastSeen: new Date().toISOString(),
            bio: "Lucy is your cheerful AI companion, lovingly created by Expectations for Quantix Connect. She's here to help you learn, build, create and brighten your day.",
            customStatus: "Here to brighten your day! ✨",
            createdAt: new Date().toISOString()
          };
        }
        const user = store.users.find(u => u._id === pid);
        if (!user) return null;
        const { passwordHash, ...rest } = user;
        return adjustUser(rest);
      }).filter(Boolean);

      return {
        ...chat,
        participants: participantsPopulated
      };
    }
  },

  async getChatById(chatId: string) {
    if (isMongoDB && MongoChat) {
      return MongoChat.findById(chatId);
    } else {
      const store = readLocalDB();
      return store.chats.find(c => c._id === chatId) || null;
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
    isBroadcast?: boolean;
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
        selfDestructIn: msgData.selfDestructIn,
        isBroadcast: msgData.isBroadcast || false
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
        createdAt: new Date().toISOString(),
        isBroadcast: msgData.isBroadcast || false
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
  },

  async blockUser(userId: string, targetId: string) {
    if (isMongoDB && MongoUser) {
      return MongoUser.findByIdAndUpdate(userId, {
        $addToSet: { blockedUsers: targetId }
      }, { new: true });
    } else {
      const store = readLocalDB();
      const idx = store.users.findIndex(u => u._id === userId);
      if (idx !== -1) {
        if (!store.users[idx].blockedUsers) {
          store.users[idx].blockedUsers = [];
        }
        if (!store.users[idx].blockedUsers.includes(targetId)) {
          store.users[idx].blockedUsers.push(targetId);
        }
        writeLocalDB(store);
      }
      return null;
    }
  },

  async unblockUser(userId: string, targetId: string) {
    if (isMongoDB && MongoUser) {
      return MongoUser.findByIdAndUpdate(userId, {
        $pull: { blockedUsers: targetId }
      }, { new: true });
    } else {
      const store = readLocalDB();
      const idx = store.users.findIndex(u => u._id === userId);
      if (idx !== -1 && store.users[idx].blockedUsers) {
        store.users[idx].blockedUsers = store.users[idx].blockedUsers.filter(id => id !== targetId);
        writeLocalDB(store);
      }
      return null;
    }
  },

  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    if (!userId1 || !userId2) return false;
    if (isMongoDB && MongoUser) {
      const user1 = await MongoUser.findById(userId1);
      const user2 = await MongoUser.findById(userId2);
      const blockedBy1 = user1?.blockedUsers?.includes(userId2) || false;
      const blockedBy2 = user2?.blockedUsers?.includes(userId1) || false;
      return blockedBy1 || blockedBy2;
    } else {
      const store = readLocalDB();
      const u1 = store.users.find(u => u._id === userId1);
      const u2 = store.users.find(u => u._id === userId2);
      const blockedBy1 = u1?.blockedUsers?.includes(userId2) || false;
      const blockedBy2 = u2?.blockedUsers?.includes(userId1) || false;
      return blockedBy1 || blockedBy2;
    }
  },

  async banUser(targetId: string, tempUntil?: Date) {
    if (isMongoDB && MongoUser) {
      return MongoUser.findByIdAndUpdate(targetId, {
        isBanned: true,
        bannedUntil: tempUntil || null
      }, { new: true });
    } else {
      const store = readLocalDB();
      const idx = store.users.findIndex(u => u._id === targetId);
      if (idx !== -1) {
        store.users[idx].isBanned = true;
        store.users[idx].bannedUntil = tempUntil ? tempUntil.toISOString() : undefined;
        writeLocalDB(store);
      }
      return null;
    }
  },

  async unbanUser(targetId: string) {
    if (isMongoDB && MongoUser) {
      return MongoUser.findByIdAndUpdate(targetId, {
        isBanned: false,
        bannedUntil: null
      }, { new: true });
    } else {
      const store = readLocalDB();
      const idx = store.users.findIndex(u => u._id === targetId);
      if (idx !== -1) {
        store.users[idx].isBanned = false;
        store.users[idx].bannedUntil = undefined;
        writeLocalDB(store);
      }
      return null;
    }
  },

  async createReport(reportData: {
    type: "issue" | "user";
    reporterId: string;
    reportedUserId?: string;
    category?: string;
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
  }) {
    if (isMongoDB && MongoReport) {
      const report = new MongoReport({
        ...reportData,
        createdAt: new Date()
      });
      return await report.save();
    } else {
      const store = readLocalDB();
      if (!store.reports) store.reports = [];
      const newReport = {
        _id: generateId(),
        ...reportData,
        createdAt: new Date().toISOString()
      };
      store.reports.push(newReport);
      writeLocalDB(store);
      return newReport;
    }
  },

  async getReportsForUser(targetId: string) {
    if (isMongoDB && MongoReport) {
      return MongoReport.find({ reportedUserId: targetId }).sort({ createdAt: -1 });
    } else {
      const store = readLocalDB();
      if (!store.reports) return [];
      return store.reports
        .filter(r => r.reportedUserId === targetId)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  async getAllUsers() {
    if (isMongoDB && MongoUser) {
      const users = await MongoUser.find({}).select("-passwordHash");
      return users.map((u: any) => {
        const obj = u.toObject ? u.toObject() : u;
        return adjustUser(obj);
      });
    } else {
      const store = readLocalDB();
      return store.users.map(({ passwordHash, ...rest }) => {
        const cloned = { ...rest };
        return adjustUser(cloned);
      });
    }
  }
}
