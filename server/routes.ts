import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { db, MongoChat } from "./db.js";
import { broadcastNewMessage } from "./socket.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "quantix_connect_super_secret_key_1337";

// Extend Express Request type
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

// Auth Middleware
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Access token required" });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }
    req.user = user;
    next();
  });
}

// Generate JWT Helper
function generateToken(user: { id: string; username: string }) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
}

// Helper to save base64 uploaded files
function saveBase64File(base64Data: string): string {
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 payload");
  }

  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], "base64");

  // Determine file extension
  let extension = "bin";
  if (mimeType.includes("png")) extension = "png";
  else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) extension = "jpg";
  else if (mimeType.includes("gif")) extension = "gif";
  else if (mimeType.includes("webp")) extension = "webp";
  else if (mimeType.includes("audio/webm") || mimeType.includes("webm")) extension = "webm";
  else if (mimeType.includes("audio/ogg") || mimeType.includes("ogg")) extension = "ogg";
  else if (mimeType.includes("audio/mp4") || mimeType.includes("mp4")) extension = "mp4";
  else if (mimeType.includes("audio/mpeg") || mimeType.includes("mp3")) extension = "mp3";
  else if (mimeType.includes("pdf")) extension = "pdf";
  else if (mimeType.includes("text/plain")) extension = "txt";
  else if (mimeType.includes("zip")) extension = "zip";

  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  fs.writeFileSync(path.join(uploadDir, filename), buffer);
  return `/uploads/${filename}`;
}

// --- AUTH ROUTERS ---

// Register User
router.post("/auth/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, displayName, password, avatarUrl } = req.body;

    if (!username || !displayName || !password) {
      res.status(400).json({ error: "Username, Display Name, and Password are required." });
      return;
    }

    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername.length < 3) {
      res.status(400).json({ error: "Username must be at least 3 characters long." });
      return;
    }

    const existingUser = await db.findUserByUsername(trimmedUsername);
    if (existingUser) {
      res.status(400).json({ error: "Username is already taken." });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save profile pic if base64 upload
    let savedAvatarUrl = avatarUrl || "";
    if (avatarUrl && avatarUrl.startsWith("data:")) {
      try {
        savedAvatarUrl = saveBase64File(avatarUrl);
      } catch (err) {
        console.error("Failed to save avatar image", err);
      }
    }

    // Create user
    const newUser = await db.createUser({
      username: trimmedUsername,
      displayName: displayName.trim(),
      passwordHash,
      avatarUrl: savedAvatarUrl
    });

    const token = generateToken({ id: newUser._id.toString(), username: newUser.username });

    res.status(201).json({
      token,
      user: {
        id: newUser._id.toString(),
        username: newUser.username,
        displayName: newUser.displayName,
        avatarUrl: newUser.avatarUrl,
        status: newUser.status,
        lastSeen: newUser.lastSeen
      }
    });
  } catch (error: any) {
    console.error("Register Error:", error);
    res.status(500).json({ error: "Server error during registration." });
  }
});

// Login User
router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and Password are required." });
      return;
    }

    const user = await db.findUserByUsername(username.trim().toLowerCase());
    if (!user) {
      res.status(400).json({ error: "Invalid username or password." });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ error: "Invalid username or password." });
      return;
    }

    // Set online
    await db.updateUser(user._id.toString(), { status: "online", lastSeen: new Date().toISOString() });

    const token = generateToken({ id: user._id.toString(), username: user.username });

    res.json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: "online",
        lastSeen: user.lastSeen
      }
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Server error during login." });
  }
});

// Get Current User Profile
router.get("/auth/me", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await db.findUserById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      lastSeen: user.lastSeen
    });
  } catch (error) {
    console.error("Get Me Error:", error);
    res.status(500).json({ error: "Server error fetching user details." });
  }
});

// Update Profile
router.put("/auth/profile", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { displayName, avatarUrl } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const updates: any = {};
    if (displayName && displayName.trim()) {
      updates.displayName = displayName.trim();
    }

    if (avatarUrl) {
      if (avatarUrl.startsWith("data:")) {
        try {
          updates.avatarUrl = saveBase64File(avatarUrl);
        } catch (err) {
          res.status(400).json({ error: "Invalid image upload format." });
          return;
        }
      } else {
        updates.avatarUrl = avatarUrl;
      }
    }

    const updatedUser = await db.updateUser(userId, updates);
    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: updatedUser._id.toString(),
      username: updatedUser.username,
      displayName: updatedUser.displayName,
      avatarUrl: updatedUser.avatarUrl,
      status: updatedUser.status,
      lastSeen: updatedUser.lastSeen
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ error: "Server error updating profile." });
  }
});

// Search Users
router.get("/users/search", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;
    const selfId = req.user?.id;

    if (!selfId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!query || !query.trim()) {
      res.json([]);
      return;
    }

    const users = await db.searchUsers(query.trim(), selfId);
    const formatted = users.map((u: any) => ({
      id: u._id.toString(),
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      status: u.status,
      lastSeen: u.lastSeen
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Search Users Error:", error);
    res.status(500).json({ error: "Server error searching users." });
  }
});

// --- CHAT ROUTES ---

// Get User Chats
router.get("/chats", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const chats = await db.getChatsForUser(userId);
    const formatted = chats.map((c: any) => {
      // Find other participant
      const otherParticipant = c.participants.find((p: any) => p && p._id.toString() !== userId);
      const isPinned = c.pinnedBy.some((id: any) => id.toString() === userId);
      
      // Get unread count for current user
      const unreadCount = c.unreadCounts instanceof Map 
        ? (c.unreadCounts.get(userId) || 0)
        : (c.unreadCounts?.[userId] || 0);

      return {
        id: c._id.toString(),
        isPinned,
        unreadCount,
        updatedAt: c.updatedAt,
        otherParticipant: otherParticipant ? {
          id: otherParticipant._id.toString(),
          username: otherParticipant.username,
          displayName: otherParticipant.displayName,
          avatarUrl: otherParticipant.avatarUrl,
          status: otherParticipant.status,
          lastSeen: otherParticipant.lastSeen
        } : null,
        lastMessage: c.lastMessage ? {
          id: c.lastMessage._id ? c.lastMessage._id.toString() : c.lastMessage._id,
          text: c.lastMessage.text,
          mediaType: c.lastMessage.mediaType,
          senderId: c.lastMessage.senderId.toString(),
          createdAt: c.lastMessage.createdAt
        } : null
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("Get Chats Error:", error);
    res.status(500).json({ error: "Server error fetching chats." });
  }
});

// Create or Get Direct Chat with another user
router.post("/chats/direct", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { partnerId } = req.body;

    if (!selfId || !partnerId) {
      res.status(400).json({ error: "Partner ID is required." });
      return;
    }

    if (selfId === partnerId) {
      res.status(400).json({ error: "Cannot create chat with yourself." });
      return;
    }

    const chat = await db.getOrCreateDirectChat(selfId, partnerId);
    
    const otherParticipant = chat.participants.find((p: any) => p && p._id.toString() !== selfId);
    const isPinned = chat.pinnedBy.some((id: any) => id.toString() === selfId);
    const unreadCount = chat.unreadCounts instanceof Map 
      ? (chat.unreadCounts.get(selfId) || 0)
      : (chat.unreadCounts?.[selfId] || 0);

    res.json({
      id: chat._id.toString(),
      isPinned,
      unreadCount,
      updatedAt: chat.updatedAt,
      otherParticipant: otherParticipant ? {
        id: otherParticipant._id.toString(),
        username: otherParticipant.username,
        displayName: otherParticipant.displayName,
        avatarUrl: otherParticipant.avatarUrl,
        status: otherParticipant.status,
        lastSeen: otherParticipant.lastSeen
      } : null,
      lastMessage: chat.lastMessage ? {
        id: chat.lastMessage._id ? chat.lastMessage._id.toString() : chat.lastMessage._id,
        text: chat.lastMessage.text,
        mediaType: chat.lastMessage.mediaType,
        senderId: chat.lastMessage.senderId.toString(),
        createdAt: chat.lastMessage.createdAt
      } : null
    });
  } catch (error) {
    console.error("Direct Chat Error:", error);
    res.status(500).json({ error: "Server error getting or creating chat." });
  }
});

// Pin/Unpin Chat
router.post("/chats/pin", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { chatId } = req.body;

    if (!selfId || !chatId) {
      res.status(400).json({ error: "Chat ID is required." });
      return;
    }

    const chat = await db.togglePinChat(chatId, selfId);
    if (!chat) {
      res.status(404).json({ error: "Chat not found." });
      return;
    }

    const isPinned = chat.pinnedBy.some((id: any) => id.toString() === selfId);
    res.json({ success: true, isPinned });
  } catch (error) {
    console.error("Toggle Pin Error:", error);
    res.status(500).json({ error: "Server error pinning chat." });
  }
});

// --- MESSAGE ROUTES ---

// Get Messages inside a Chat
router.get("/chats/:chatId/messages", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { chatId } = req.params;

    if (!selfId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Read all messages
    const messages = await db.getMessages(chatId, selfId);

    // Mark messages as read by this user
    await db.markMessagesAsRead(chatId, selfId);

    const formatted = messages.map((m: any) => ({
      id: m._id.toString(),
      chatId: m.chatId.toString(),
      senderId: m.senderId.toString(),
      text: m.text,
      mediaUrl: m.mediaUrl,
      mediaType: m.mediaType,
      readBy: m.readBy.map((id: any) => id.toString()),
      createdAt: m.createdAt
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Get Messages Error:", error);
    res.status(500).json({ error: "Server error fetching messages." });
  }
});

// Create Message and broadcast via sockets
router.post("/messages", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { chatId, text, mediaUrl, mediaType } = req.body;

    if (!selfId || !chatId) {
      res.status(400).json({ error: "Chat ID is required." });
      return;
    }

    if (!text && !mediaUrl) {
      res.status(400).json({ error: "Message content or media is required." });
      return;
    }

    // Save message to database
    const savedMsg = await db.createMessage({
      chatId,
      senderId: selfId,
      text: text || "",
      mediaUrl: mediaUrl || "",
      mediaType: mediaType || "text"
    });

    // Get chat participants to broadcast to
    let participants: string[] = [];
    if (MongoChat && process.env.MONGODB_URI) {
      const chat = await MongoChat.findById(chatId);
      if (chat) {
        participants = chat.participants.map((p: any) => p.toString());
      }
    } else {
      try {
        const storePath = path.join(process.cwd(), "data", "db.json");
        if (fs.existsSync(storePath)) {
          const store = JSON.parse(fs.readFileSync(storePath, "utf-8"));
          const chat = store.chats.find((c: any) => c._id === chatId);
          if (chat) {
            participants = chat.participants;
          }
        }
      } catch (err) {
        console.error("Local DB participants lookup failed:", err);
      }
    }

    const formattedMsg = {
      id: savedMsg._id.toString(),
      chatId: savedMsg.chatId.toString(),
      senderId: savedMsg.senderId.toString(),
      text: savedMsg.text,
      mediaUrl: savedMsg.mediaUrl,
      mediaType: savedMsg.mediaType,
      readBy: savedMsg.readBy.map((id: any) => id.toString()),
      createdAt: savedMsg.createdAt
    };

    // Broadcast in real-time
    broadcastNewMessage(chatId, participants, formattedMsg);

    res.status(201).json(formattedMsg);
  } catch (error) {
    console.error("Create Message Error:", error);
    res.status(500).json({ error: "Server error creating message." });
  }
});

// Upload Attachment (Image, Voice, File)
router.post("/upload", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { fileData } = req.body; // Base64 data string: "data:image/png;base64,..."
    if (!fileData) {
      res.status(400).json({ error: "No file data provided." });
      return;
    }

    const savedUrl = saveBase64File(fileData);
    res.json({ url: savedUrl });
  } catch (error: any) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: error.message || "Failed to upload file." });
  }
});

// Delete Message (for self)
router.post("/messages/delete", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { messageId } = req.body;

    if (!selfId || !messageId) {
      res.status(400).json({ error: "Message ID is required." });
      return;
    }

    await db.deleteMessageForUser(messageId, selfId);
    res.json({ success: true, messageId });
  } catch (error) {
    console.error("Delete Message Error:", error);
    res.status(500).json({ error: "Server error deleting message." });
  }
});

export default router;
