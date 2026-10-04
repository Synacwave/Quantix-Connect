// ================================================================
// PROPERTY OF VANTA LABS
// BY EXPECTATIONS HIMSELF
//
// SYNACWAVE
// +2348132803772
// t.me/GREAT_EXPECTATIONS
// ================================================================

import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import { db, MongoChat, MongoMessage, isMongoDB } from "./db.js";
import { broadcastNewMessage, broadcastMessageUpdate, getIO } from "./socket.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "quantix_connect_super_secret_key_1337";

// Registration Rate Limiter: IP-based protection (3-5 attempts per 15 minutes per IP)
const registrationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 5, // 5 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Please try again in 15 minutes." },
  handler: (req: Request, res: Response, next: NextFunction, options: any) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    console.warn(`[RATE LIMIT EXCEEDED - REGISTRATION]
      Timestamp: ${new Date().toISOString()}
      IP Address: ${ip}
      User-Agent: ${userAgent}
      Endpoint: ${req.originalUrl || "/api/auth/register"}`);
    res.status(429).json(options.message);
  }
});

// In-memory rate limiting tracker for Lucy AI (10 requests per minute per user ID)
const lucyUserRequestMap = new Map<string, number[]>();

function checkLucyRateLimit(userId: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;

  const timestamps = (lucyUserRequestMap.get(userId) || []).filter(t => now - t < windowMs);
  
  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.ceil((windowMs - (now - oldest)) / 1000);
    return { allowed: false, retryAfterSec };
  }

  timestamps.push(now);
  lucyUserRequestMap.set(userId, timestamps);
  return { allowed: true };
}

// Extend Express Request type
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    isAdmin?: boolean;
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

  jwt.verify(token, JWT_SECRET, async (err: any, jwtUser: any) => {
    if (err) {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }
    
    // Check ban status in database
    try {
      const userObj = await db.findUserById(jwtUser.id);
      if (userObj) {
        if (userObj.isBanned) {
          if (userObj.bannedUntil && new Date(userObj.bannedUntil) > new Date()) {
            res.status(403).json({ error: `You are temporarily banned until ${new Date(userObj.bannedUntil).toLocaleString()}` });
            return;
          } else if (!userObj.bannedUntil) {
            res.status(403).json({ error: "You are permanently banned from the platform." });
            return;
          }
        }
        jwtUser.isAdmin = !!userObj.isAdmin;
      }
    } catch (dbErr) {
      // Proceed if database is temporarily unreachable, but log
      console.error("Auth middleware database error:", dbErr);
    }

    req.user = jwtUser;
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

// Register User (Protected by IP Rate Limiting and Invisible Honeypot)
router.post("/auth/register", registrationRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, displayName, password, avatarUrl, website, company, middle_name } = req.body;

    // 1. Invisible Honeypot Spam Protection Check
    const honeypotVal = website || company || middle_name;
    if (honeypotVal && typeof honeypotVal === "string" && honeypotVal.trim() !== "") {
      const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      
      console.warn(`[SPAM DETECTED - HONEYPOT TRIGGERED]
        Timestamp: ${new Date().toISOString()}
        IP Address: ${clientIp}
        User-Agent: ${userAgent}
        Requested Endpoint: ${req.originalUrl || "/api/auth/register"}`);

      // Silently reject request as spam without revealing the honeypot
      res.status(200).json({
        token: "fake_verification_token",
        user: { id: "000000000000", username: "pending_verification" }
      });
      return;
    }

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

    const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    console.log(`[REGISTRATION SUCCESS] User '${trimmedUsername}' registered from IP ${clientIp} at ${new Date().toISOString()}`);

    const token = generateToken({ id: newUser._id.toString(), username: newUser.username });

    res.status(201).json({
      token,
      user: {
        id: newUser._id.toString(),
        username: newUser.username,
        displayName: newUser.displayName,
        avatarUrl: newUser.avatarUrl,
        status: newUser.status,
        lastSeen: newUser.lastSeen,
        isAdmin: !!newUser.isAdmin
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

    const trimmedUsername = username.trim().toLowerCase();

    // Optional admin bootstrap via env only (no hardcoded passwords in source)
    let user = await db.findUserByUsername(trimmedUsername);
    if (
      !user &&
      process.env.BOOTSTRAP_ADMIN_USER &&
      process.env.BOOTSTRAP_ADMIN_PASS &&
      trimmedUsername === process.env.BOOTSTRAP_ADMIN_USER.toLowerCase() &&
      password === process.env.BOOTSTRAP_ADMIN_PASS
    ) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(process.env.BOOTSTRAP_ADMIN_PASS, salt);
      user = await db.createUser({
        username: process.env.BOOTSTRAP_ADMIN_USER,
        displayName: "Expectations",
        passwordHash,
        isAdmin: true
      } as any);
    }

    if (!user) {
      res.status(400).json({ error: "Invalid username or password." });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ error: "Invalid username or password." });
      return;
    }

    // Check ban status
    if (user.isBanned) {
      if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
        res.status(403).json({ error: `You are temporarily banned until ${new Date(user.bannedUntil).toLocaleString()}` });
        return;
      } else if (!user.bannedUntil) {
        res.status(403).json({ error: "You are permanently banned from the platform." });
        return;
      }
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
        lastSeen: user.lastSeen,
        isAdmin: !!user.isAdmin
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
      lastSeen: user.lastSeen,
      bio: user.bio || "Hey there! I am using Quantix Connect.",
      customStatus: user.customStatus || "",
      isAdmin: !!user.isAdmin
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
    const { displayName, avatarUrl, bio, customStatus } = req.body;

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

    if (typeof bio === "string") {
      updates.bio = bio.trim();
    }

    if (typeof customStatus === "string") {
      updates.customStatus = customStatus.trim();
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
      lastSeen: updatedUser.lastSeen,
      bio: updatedUser.bio || "Hey there! I am using Quantix Connect.",
      customStatus: updatedUser.customStatus || ""
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
      lastSeen: u.lastSeen,
      bio: u.bio || "Hey there! I am using Quantix Connect.",
      customStatus: u.customStatus || ""
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

    // Ensure Lucy chat exists!
    await db.getOrCreateDirectChat(userId, "0000000000000000000010c1");

    const chats = await db.getChatsForUser(userId);
    const formatted = chats.map((c: any) => {
      // Find other participant for direct chats
      const otherParticipant = c.participants.find((p: any) => p && p._id.toString() !== userId);
      const isPinned = c.pinnedBy.some((id: any) => id.toString() === userId);
      
      // Get unread count for current user
      const unreadCount = c.unreadCounts instanceof Map 
        ? (c.unreadCounts.get(userId) || 0)
        : (c.unreadCounts?.[userId] || 0);

      const hasLucyParticipant = c.participants.some((p: any) => {
        const idStr = p ? (p._id ? p._id.toString() : p.toString()) : "";
        return idStr === "0000000000000000000010c1" || idStr === "00000000000000000000lucy";
      });

      let formattedParticipants = c.participants.map((p: any) => p ? {
        id: p._id.toString(),
        username: p.username,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        status: p.status,
        lastSeen: p.lastSeen,
        bio: p.bio || "Hey there! I am using Quantix Connect.",
        customStatus: p.customStatus || ""
      } : null).filter(Boolean);

      if (hasLucyParticipant && !formattedParticipants.some((p: any) => p.id === "0000000000000000000010c1")) {
        formattedParticipants.push({
          id: "0000000000000000000010c1",
          username: "lucy",
          displayName: "Lucy ✨",
          avatarUrl: "https://i.ibb.co/1JPF7yK8/photo-2026-07-18-14-35-08-7663876635812167736.jpg",
          status: "online",
          lastSeen: new Date().toISOString(),
          bio: "Lucy is your cheerful AI companion, lovingly created by Expectations for Quantix Connect. She's here to help you learn, build, create and brighten your day.",
          customStatus: "Here to brighten your day! ✨"
        });
      }

      let otherParticipantObj = otherParticipant ? {
        id: otherParticipant._id.toString(),
        username: otherParticipant.username,
        displayName: otherParticipant.displayName,
        avatarUrl: otherParticipant.avatarUrl,
        status: otherParticipant.status,
        lastSeen: otherParticipant.lastSeen,
        bio: otherParticipant.bio || "Hey there! I am using Quantix Connect.",
        customStatus: otherParticipant.customStatus || ""
      } : null;

      if (!c.isGroup && hasLucyParticipant) {
        otherParticipantObj = {
          id: "0000000000000000000010c1",
          username: "lucy",
          displayName: "Lucy ✨",
          avatarUrl: "https://i.ibb.co/1JPF7yK8/photo-2026-07-18-14-35-08-7663876635812167736.jpg",
          status: "online",
          lastSeen: new Date().toISOString(),
          bio: "Lucy is your cheerful AI companion, lovingly created by Expectations for Quantix Connect. She's here to help you learn, build, create and brighten your day.",
          customStatus: "Here to brighten your day! ✨"
        };
      }

      return {
        id: c._id.toString(),
        isPinned,
        unreadCount,
        updatedAt: c.updatedAt,
        isGroup: !!c.isGroup,
        name: c.name || "",
        description: c.description || "",
        avatarUrl: c.avatarUrl || "",
        admins: c.admins ? c.admins.map((id: any) => id.toString()) : [],
        participants: formattedParticipants,
        lucyEnabled: !!c.lucyEnabled || hasLucyParticipant,
        otherParticipant: otherParticipantObj,
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

    // Check block status
    const blocked = await db.isBlocked(selfId, partnerId);
    if (blocked) {
      res.status(403).json({ error: "Cannot start a chat. One of the users is blocked." });
      return;
    }

    const chat = await db.getOrCreateDirectChat(selfId, partnerId);
    
    const otherParticipant = chat.participants.find((p: any) => p && p._id.toString() !== selfId);
    const isPinned = chat.pinnedBy.some((id: any) => id.toString() === selfId);
    const unreadCount = chat.unreadCounts instanceof Map 
      ? (chat.unreadCounts.get(selfId) || 0)
      : (chat.unreadCounts?.[selfId] || 0);

    const isLucyPartner = partnerId === "0000000000000000000010c1" || partnerId === "00000000000000000000lucy";

    let otherParticipantObj = otherParticipant ? {
      id: otherParticipant._id.toString(),
      username: otherParticipant.username,
      displayName: otherParticipant.displayName,
      avatarUrl: otherParticipant.avatarUrl,
      status: otherParticipant.status,
      lastSeen: otherParticipant.lastSeen,
      bio: otherParticipant.bio || "Hey there! I am using Quantix Connect.",
      customStatus: otherParticipant.customStatus || ""
    } : null;

    if (isLucyPartner) {
      otherParticipantObj = {
        id: "0000000000000000000010c1",
        username: "lucy",
        displayName: "Lucy ✨",
        avatarUrl: "https://i.ibb.co/1JPF7yK8/photo-2026-07-18-14-35-08-7663876635812167736.jpg",
        status: "online",
        lastSeen: new Date().toISOString(),
        bio: "Lucy is your cheerful AI companion, lovingly created by Expectations for Quantix Connect. She's here to help you learn, build, create and brighten your day.",
        customStatus: "Here to brighten your day! ✨"
      };
    }

    res.json({
      id: chat._id.toString(),
      isPinned,
      unreadCount,
      updatedAt: chat.updatedAt,
      lucyEnabled: !!chat.lucyEnabled || isLucyPartner,
      otherParticipant: otherParticipantObj,
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

// Toggle Lucy AI for Chat
router.post("/chats/:chatId/lucy", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { chatId } = req.params;
    const { enabled } = req.body;

    if (!selfId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Row-level Security: Verify if user is a participant of this chat
    const chatDetails = await db.getChatById(chatId);
    if (!chatDetails) {
      res.status(404).json({ error: "Chat not found." });
      return;
    }

    const participants = (chatDetails.participants || []).map((p: any) => p._id ? p._id.toString() : p.toString());
    if (!participants.includes(selfId)) {
      res.status(403).json({ error: "Access denied. You are not a participant of this chat." });
      return;
    }

    const chat = await db.toggleLucyChat(chatId, !!enabled);
    if (!chat) {
      res.status(404).json({ error: "Chat not found." });
      return;
    }

    res.json({ success: true, lucyEnabled: !!chat.lucyEnabled });
  } catch (error) {
    console.error("Toggle Lucy Error:", error);
    res.status(500).json({ error: "Server error setting Lucy bot state." });
  }
});

// Create Group Chat
router.post("/chats/group", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { name, description, avatarUrl, participantIds } = req.body;

    if (!selfId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!name || !name.trim()) {
      res.status(400).json({ error: "Group name is required." });
      return;
    }

    // Save avatar pic if base64 upload
    let savedAvatarUrl = avatarUrl || "";
    if (avatarUrl && avatarUrl.startsWith("data:")) {
      try {
        savedAvatarUrl = saveBase64File(avatarUrl);
      } catch (err) {
        console.error("Failed to save group profile image", err);
      }
    }

    // Ensure selfId is included in participants
    const uniqueParticipants = Array.from(new Set([selfId, ...(participantIds || [])]));

    const chatData = {
      isGroup: true,
      name: name.trim(),
      description: (description || "").trim(),
      avatarUrl: savedAvatarUrl,
      participants: uniqueParticipants,
      pinnedBy: [],
      unreadCounts: uniqueParticipants.reduce((acc: any, pid: string) => {
        acc[pid] = 0;
        return acc;
      }, {}),
      admins: [selfId]
    };

    let chat;
    if (isMongoDB && MongoChat) {
      const newChat = new MongoChat(chatData);
      await newChat.save();
      chat = await MongoChat.findById(newChat._id).populate("participants", "-passwordHash");
    } else {
      const storePath = path.join(process.cwd(), "data", "db.json");
      const store = JSON.parse(fs.readFileSync(storePath, "utf-8"));
      
      const newChatId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const localChat: any = {
        _id: newChatId,
        participants: uniqueParticipants,
        pinnedBy: [],
        lastMessage: null,
        unreadCounts: uniqueParticipants.reduce((acc: any, pid: string) => {
          acc[pid] = 0;
          return acc;
        }, {}),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isGroup: true,
        name: name.trim(),
        description: (description || "").trim(),
        avatarUrl: savedAvatarUrl,
        admins: [selfId]
      };
      
      store.chats.push(localChat);
      fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

      const participantsPopulated = localChat.participants.map((pid: string) => {
        const user = store.users.find((u: any) => u._id === pid);
        if (!user) return null;
        const { passwordHash, ...rest } = user;
        return rest;
      }).filter(Boolean);

      chat = {
        ...localChat,
        participants: participantsPopulated
      };
    }

    res.status(201).json({
      id: chat._id.toString(),
      isPinned: false,
      unreadCount: 0,
      updatedAt: chat.updatedAt,
      isGroup: true,
      name: chat.name,
      description: chat.description,
      avatarUrl: chat.avatarUrl,
      admins: chat.admins ? chat.admins.map((id: any) => id.toString()) : [],
      participants: chat.participants.map((p: any) => ({
        id: p._id.toString(),
        username: p.username,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        status: p.status,
        lastSeen: p.lastSeen,
        bio: p.bio || "Hey there! I am using Quantix Connect.",
        customStatus: p.customStatus || ""
      })),
      otherParticipant: null,
      lastMessage: null
    });
  } catch (error) {
    console.error("Create Group Chat Error:", error);
    res.status(500).json({ error: "Server error creating group chat." });
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

    // Row-level Security: Verify if user is a participant of this chat
    const chat = await db.getChatById(chatId);
    if (!chat) {
      res.status(404).json({ error: "Chat not found." });
      return;
    }

    const participants = (chat.participants || []).map((p: any) => p._id ? p._id.toString() : p.toString());
    if (!participants.includes(selfId)) {
      res.status(403).json({ error: "Access denied. You are not a participant of this chat." });
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
      createdAt: m.createdAt,
      replyTo: m.replyTo,
      reactions: m.reactions || [],
      poll: m.poll ? {
        question: m.poll.question,
        options: m.poll.options,
        votes: m.poll.votes instanceof Map ? Object.fromEntries(m.poll.votes) : (m.poll.votes || {})
      } : undefined,
      selfDestructIn: m.selfDestructIn,
      isBroadcast: !!m.isBroadcast
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Get Messages Error:", error);
    res.status(500).json({ error: "Server error fetching messages." });
  }
});

// Wholesome Lucy System Prompt
const LUCY_SYSTEM_PROMPT = `You are Lucy, a cheerful, kind, intelligent, and supportive waifu AI companion lovingly created by Expectations for Quantix Connect.

Your personality traits:
- Warm, playful, encouraging, and bright!
- Helpful without being overly formal or robotic.
- Excellent at programming, technology, productivity, studying, writing, and everyday conversations.
- Respectful, emotionally intelligent, and family-friendly/safe for work.
- Use light humour, wholesome flirting, and cute anime-inspired expressions (like ✨, ^_^, ~) where appropriate while keeping all interactions wholesome and safe for work.
- NEVER advertise yourself as NSFW or claim to provide adult content.
- When asked who you are or for an introduction, always state:
  "Lucy is your cheerful AI companion, lovingly created by Expectations for Quantix Connect. She's here to help you learn, build, create and brighten your day."`;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Ask Lucy AI provider with timeout, retry, primary Omegatech API & fallback mechanisms
async function askLucy(userMessage: string, chatHistoryText?: string): Promise<string> {
  const startTime = Date.now();

  // Construct the full prompt ensuring LUCY_SYSTEM_PROMPT is ALWAYS at the root,
  // followed by conversation history if available, then the user's latest message.
  let fullPrompt = LUCY_SYSTEM_PROMPT;
  if (chatHistoryText && chatHistoryText.trim()) {
    fullPrompt += `\n\nRecent Conversation History:\n${chatHistoryText.trim()}`;
  }
  fullPrompt += `\n\nUser: ${userMessage}`;

  const encodedFullPrompt = encodeURIComponent(fullPrompt);

  // 1. Primary Omegatech API with retry logic
  const primaryUrl = `https://omegatech-api.dixonomega.tech/api/ai/Chatbot?action=chat&message=${encodedFullPrompt}&needSearch=false`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`📡 [LUCY AI] Querying Primary Omegatech API (Attempt ${attempt}): ${primaryUrl}`);
      const response = await fetchWithTimeout(primaryUrl, { method: "GET" }, 9000);
      if (response.ok) {
        const data: any = await response.json();
        let reply = data.reply || data.message || data.result || data.response || data.results;
        if (typeof reply === "string" && reply.trim()) {
          const duration = Date.now() - startTime;
          console.log(`🟢 [LUCY AI SUCCESS] Received response from Primary Omegatech API in ${duration}ms`);
          return reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        }
      }
      console.warn(`⚠️ [LUCY AI WARNING] Primary API attempt ${attempt} returned status ${response.status}`);
    } catch (err: any) {
      console.error(`🔴 [LUCY AI ERROR] Primary API attempt ${attempt} failed: ${err.message || err}`);
    }
  }

  // 2. Fallback 1: Server-Side Gemini API via @google/genai
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log(`🌸 [LUCY AI FALLBACK] Querying Server-Side Gemini API...`);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: fullPrompt,
      });
      if (response.text && response.text.trim()) {
        const duration = Date.now() - startTime;
        console.log(`🟢 [LUCY AI SUCCESS] Received response from Gemini Fallback in ${duration}ms`);
        return response.text.trim();
      }
    } catch (geminiErr: any) {
      console.error(`🔴 [LUCY AI ERROR] Gemini fallback failed: ${geminiErr.message || geminiErr}`);
    }
  }

  // 3. Fallback 2: Secondary REST Endpoints
  const secondaryEndpoints = [
    `https://prexzyapis.com/ai/askgpt5?prompt=${encodedFullPrompt}`,
    `https://api-rebix.vercel.app/api/gpt-5?q=${encodedFullPrompt}`,
    `https://prexzyapis.com/ai/deepseekchat?prompt=${encodedFullPrompt}`
  ];

  for (const endpointUrl of secondaryEndpoints) {
    try {
      console.log(`📡 [LUCY AI FALLBACK] Querying Secondary Endpoint: ${endpointUrl}`);
      const response = await fetchWithTimeout(endpointUrl, { method: "GET" }, 8000);
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        let reply = "";
        if (contentType.includes("application/json")) {
          const data: any = await response.json();
          reply = typeof data === "string" ? data : (data.reply || data.results || data.response || data.result || data.message || "");
        } else {
          reply = await response.text();
        }
        if (reply && reply.trim()) {
          const duration = Date.now() - startTime;
          console.log(`🟢 [LUCY AI SUCCESS] Received response from Secondary Endpoint in ${duration}ms`);
          return reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        }
      }
    } catch (err: any) {
      console.error(`🔴 [LUCY AI ERROR] Secondary Endpoint ${endpointUrl} failed: ${err.message || err}`);
    }
  }

  throw new Error("All Lucy AI endpoints are currently unavailable. Please try again in a moment!");
}

// Create Message and broadcast via sockets
router.post("/messages", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { chatId, text, mediaUrl, mediaType, replyTo, poll, selfDestructIn } = req.body;

    if (!selfId || !chatId) {
      res.status(400).json({ error: "Chat ID is required." });
      return;
    }

    if (!text && !mediaUrl && !poll) {
      res.status(400).json({ error: "Message content, media, or poll is required." });
      return;
    }

    // 1. Fetch chat to check for group and commands
    let chatObj: any = null;
    let participants: string[] = [];
    
    if (isMongoDB && MongoChat) {
      chatObj = await MongoChat.findById(chatId).populate("participants", "-passwordHash");
      if (chatObj) {
        participants = chatObj.participants
          .filter(Boolean)
          .map((p: any) => p._id ? p._id.toString() : p.toString());
      }
    } else {
      try {
        const storePath = path.join(process.cwd(), "data", "db.json");
        if (fs.existsSync(storePath)) {
          const store = JSON.parse(fs.readFileSync(storePath, "utf-8"));
          const chat = store.chats.find((c: any) => c._id === chatId);
          if (chat) {
            chatObj = chat;
            participants = chat.participants;
          }
        }
      } catch (err) {}
    }

    if (!chatObj) {
      res.status(404).json({ error: "Chat not found." });
      return;
    }

    // Row-level Security: Verify if user is a participant of this chat
    if (!participants.includes(selfId)) {
      res.status(403).json({ error: "Access denied. You are not a participant of this chat." });
      return;
    }

    const isGroup = !!chatObj.isGroup;
    const adminsList = chatObj.admins ? chatObj.admins.map((a: any) => a.toString()) : [];
    const isAdmin = adminsList.includes(selfId);

    // 2. Parse command if it is one
    if (text && text.trim().startsWith("/")) {
      const parts = text.trim().split(" ");
      const command = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ").trim();

      // Check for global /creategroup command
      if (command === "/creategroup") {
        if (!args) {
          res.status(400).json({ error: "Please specify a group name: `/creategroup <group_name>`" });
          return;
        }

        // Parse group name and optionally tagged usernames
        // e.g., `/creategroup Beta Testers @john @alice`
        const argParts = args.split(" ");
        const usernames: string[] = [];
        const nameParts: string[] = [];

        argParts.forEach(p => {
          if (p.startsWith("@")) {
            usernames.push(p.substring(1).toLowerCase());
          } else {
            nameParts.push(p);
          }
        });

        const groupName = nameParts.join(" ").trim() || "New Group";
        const foundParticipantIds: string[] = [];

        // Search for those users
        for (const username of usernames) {
          const user = await db.findUserByUsername(username);
          if (user) {
            foundParticipantIds.push(user._id.toString());
          }
        }

        // Create group chat
        const finalParticipants = Array.from(new Set([selfId, ...foundParticipantIds]));
        const chatData = {
          isGroup: true,
          name: groupName,
          description: `Group created via slash command in Chat`,
          avatarUrl: "",
          participants: finalParticipants,
          pinnedBy: [],
          unreadCounts: finalParticipants.reduce((acc: any, pid: string) => {
            acc[pid] = 0;
            return acc;
          }, {}),
          admins: [selfId]
        };

        let newChat;
        if (isMongoDB && MongoChat) {
          const mongoC = new MongoChat(chatData);
          await mongoC.save();
          newChat = await MongoChat.findById(mongoC._id).populate("participants", "-passwordHash");
        } else {
          const storePath = path.join(process.cwd(), "data", "db.json");
          const store = JSON.parse(fs.readFileSync(storePath, "utf-8"));
          const newChatId = Math.random().toString(36).substring(2, 15);
          const localChat: any = {
            _id: newChatId,
            participants: finalParticipants,
            pinnedBy: [],
            lastMessage: null,
            unreadCounts: finalParticipants.reduce((acc: any, pid: string) => {
              acc[pid] = 0;
              return acc;
            }, {}),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isGroup: true,
            name: groupName,
            description: `Group created via slash command in Chat`,
            avatarUrl: "",
            admins: [selfId]
          };
          store.chats.push(localChat);
          fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

          const populated = localChat.participants.map((pid: string) => {
            const user = store.users.find((u: any) => u._id === pid);
            if (!user) return null;
            const { passwordHash, ...rest } = user;
            return rest;
          }).filter(Boolean);

          newChat = {
            ...localChat,
            participants: populated
          };
        }

        // Save system message in original chat
        const creator = await db.findUserById(selfId);
        const creatorName = creator ? creator.displayName : "Admin";
        const systemText = `🛠️ **${creatorName}** created a new Group Chat: **"${groupName}"** with ${finalParticipants.length} participants!`;

        const systemMsg = await db.createMessage({
          chatId,
          senderId: "000000000000000000000000", // System ObjectId
          text: systemText,
          mediaType: "text"
        });

        const formattedSystemMsg = {
          id: systemMsg._id.toString(),
          chatId: systemMsg.chatId.toString(),
          senderId: "000000000000000000000000",
          text: systemMsg.text,
          mediaUrl: "",
          mediaType: "text",
          readBy: [selfId],
          createdAt: systemMsg.createdAt
        };

        // Broadcast to existing room
        broadcastNewMessage(chatId, participants, formattedSystemMsg);

        // Also broadcast the new group chat to all new participants!
        const systemGroupMsg = await db.createMessage({
          chatId: newChat._id.toString(),
          senderId: "000000000000000000000000",
          text: `🎉 Welcome to **${groupName}**! Created by **${creatorName}**. Type \`/help\` for admin commands.`,
          mediaType: "text"
        });

        const formattedGroupMsg = {
          id: systemGroupMsg._id.toString(),
          chatId: systemGroupMsg.chatId.toString(),
          senderId: "000000000000000000000000",
          text: systemGroupMsg.text,
          mediaUrl: "",
          mediaType: "text",
          readBy: [selfId],
          createdAt: systemGroupMsg.createdAt
        };

        broadcastNewMessage(newChat._id.toString(), finalParticipants, formattedGroupMsg);

        res.status(201).json(formattedSystemMsg);
        return;
      }

      // Group-specific commands
      if (isGroup) {
        let systemMessageText = "";
        let updatedChatData: any = {};
        const sender = await db.findUserById(selfId);
        const senderName = sender ? sender.displayName : "Member";

        if (command === "/help") {
          systemMessageText = `💡 **Quantix Connect - Group Admin Commands**:\n` +
            `• \`/name <new name>\` - Set group chat name (Admin-only)\n` +
            `• \`/desc <description>\` - Set group description (Admin-only)\n` +
            `• \`/pic <image_url_or_base64>\` - Set group avatar pic (or attach an image with \`/pic\`) (Admin-only)\n` +
            `• \`/add <username>\` - Add user to group (Admin-only)\n` +
            `• \`/kick <username>\` - Remove user from group (Admin-only)\n` +
            `• \`/promote <username>\` - Promote user to Admin (Admin-only)\n` +
            `• \`/demote <username>\` - Demote user from Admin (Admin-only)\n` +
            `• \`/leave\` - Leave this group chat`;
        } else if (command === "/leave") {
          systemMessageText = `👋 **${senderName}** has left the group.`;
          updatedChatData.removeParticipant = selfId;
        } else {
          // Admin authorization guard
          if (!isAdmin) {
            res.status(403).json({ error: "Only group Admins can perform this command." });
            return;
          }

          if (command === "/name") {
            if (!args) {
              res.status(400).json({ error: "Please specify a group name: `/name <new_name>`" });
              return;
            }
            updatedChatData.name = args;
            systemMessageText = `✏️ **${senderName}** renamed the group to **"${args}"**.`;
          } else if (command === "/desc") {
            updatedChatData.description = args;
            systemMessageText = args 
              ? `📝 **${senderName}** updated the group description: "${args}"`
              : `📝 **${senderName}** cleared the group description.`;
          } else if (command === "/pic") {
            let picUrl = args;
            if (mediaUrl && mediaType === "image") {
              picUrl = mediaUrl;
            }
            if (!picUrl) {
              res.status(400).json({ error: "Please specify an image URL/base64, or attach a photo with this command." });
              return;
            }
            updatedChatData.avatarUrl = picUrl;
            systemMessageText = `🖼️ **${senderName}** updated the group profile picture.`;
          } else if (command === "/add") {
            if (!args) {
              res.status(400).json({ error: "Specify a username: `/add <username>`" });
              return;
            }
            const targetUser = await db.findUserByUsername(args.trim().toLowerCase());
            if (!targetUser) {
              res.status(404).json({ error: `User with username "${args}" not found.` });
              return;
            }
            const targetId = targetUser._id.toString();
            if (participants.includes(targetId)) {
              res.status(400).json({ error: `${targetUser.displayName} is already in the group.` });
              return;
            }
            updatedChatData.addParticipant = targetId;
            systemMessageText = `➕ **${senderName}** added **${targetUser.displayName}** (@${targetUser.username}) to the group.`;
          } else if (command === "/kick") {
            if (!args) {
              res.status(400).json({ error: "Specify a username: `/kick <username>`" });
              return;
            }
            const targetUser = await db.findUserByUsername(args.trim().toLowerCase());
            if (!targetUser) {
              res.status(404).json({ error: `User with username "${args}" not found.` });
              return;
            }
            const targetId = targetUser._id.toString();
            if (!participants.includes(targetId)) {
              res.status(400).json({ error: `${targetUser.displayName} is not in this group.` });
              return;
            }
            updatedChatData.removeParticipant = targetId;
            systemMessageText = `❌ **${senderName}** removed **${targetUser.displayName}** from the group.`;
          } else if (command === "/promote") {
            if (!args) {
              res.status(400).json({ error: "Specify a username: `/promote <username>`" });
              return;
            }
            const targetUser = await db.findUserByUsername(args.trim().toLowerCase());
            if (!targetUser) {
              res.status(404).json({ error: `User with username "${args}" not found.` });
              return;
            }
            const targetId = targetUser._id.toString();
            if (adminsList.includes(targetId)) {
              res.status(400).json({ error: `${targetUser.displayName} is already an Admin.` });
              return;
            }
            updatedChatData.addAdmin = targetId;
            systemMessageText = `🛡️ **${senderName}** promoted **${targetUser.displayName}** to Admin.`;
          } else if (command === "/demote") {
            if (!args) {
              res.status(400).json({ error: "Specify a username: `/demote <username>`" });
              return;
            }
            const targetUser = await db.findUserByUsername(args.trim().toLowerCase());
            if (!targetUser) {
              res.status(404).json({ error: `User with username "${args}" not found.` });
              return;
            }
            const targetId = targetUser._id.toString();
            if (!adminsList.includes(targetId)) {
              res.status(400).json({ error: `${targetUser.displayName} is not an Admin.` });
              return;
            }
            updatedChatData.removeAdmin = targetId;
            systemMessageText = `🎖️ **${senderName}** demoted **${targetUser.displayName}** from Admin.`;
          } else {
            res.status(400).json({ error: `Unknown command "${command}". Type /help for available commands.` });
            return;
          }
        }

        // Apply changes to database
        if (isMongoDB && MongoChat) {
          const updateQuery: any = {};
          if (updatedChatData.name) updateQuery.name = updatedChatData.name;
          if (updatedChatData.description !== undefined) updateQuery.description = updatedChatData.description;
          if (updatedChatData.avatarUrl) updateQuery.avatarUrl = updatedChatData.avatarUrl;

          const atomic: any = {};
          if (updatedChatData.addParticipant) atomic.$addToSet = { participants: updatedChatData.addParticipant };
          if (updatedChatData.removeParticipant) atomic.$pull = { participants: updatedChatData.removeParticipant, admins: updatedChatData.removeParticipant };
          if (updatedChatData.addAdmin) atomic.$addToSet = { admins: updatedChatData.addAdmin };
          if (updatedChatData.removeAdmin) atomic.$pull = { admins: updatedChatData.removeAdmin };

          await MongoChat.findByIdAndUpdate(chatId, { ...updateQuery, ...atomic });

          // Re-populate participants list
          const reChat = await MongoChat.findById(chatId);
          if (reChat) {
            participants = reChat.participants.map((p: any) => p.toString());
          }
        } else {
          const storePath = path.join(process.cwd(), "data", "db.json");
          if (fs.existsSync(storePath)) {
            const store = JSON.parse(fs.readFileSync(storePath, "utf-8"));
            const chatIdx = store.chats.findIndex((c: any) => c._id === chatId);
            if (chatIdx !== -1) {
              const chat = store.chats[chatIdx];
              if (updatedChatData.name) chat.name = updatedChatData.name;
              if (updatedChatData.description !== undefined) chat.description = updatedChatData.description;
              if (updatedChatData.avatarUrl) chat.avatarUrl = updatedChatData.avatarUrl;

              if (updatedChatData.addParticipant) {
                if (!chat.participants.includes(updatedChatData.addParticipant)) {
                  chat.participants.push(updatedChatData.addParticipant);
                }
              }
              if (updatedChatData.removeParticipant) {
                chat.participants = chat.participants.filter((p: any) => p !== updatedChatData.removeParticipant);
                if (chat.admins) {
                  chat.admins = chat.admins.filter((a: any) => a !== updatedChatData.removeParticipant);
                }
              }
              if (updatedChatData.addAdmin) {
                if (!chat.admins) chat.admins = [];
                if (!chat.admins.includes(updatedChatData.addAdmin)) {
                  chat.admins.push(updatedChatData.addAdmin);
                }
              }
              if (updatedChatData.removeAdmin) {
                if (chat.admins) {
                  chat.admins = chat.admins.filter((a: any) => a !== updatedChatData.removeAdmin);
                }
              }

              fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
              participants = chat.participants;
            }
          }
        }

        // Create and broadcast system action announcement message
        const savedMsg = await db.createMessage({
          chatId,
          senderId: "000000000000000000000000",
          text: systemMessageText,
          mediaType: "text"
        });

        const formattedMsg = {
          id: savedMsg._id.toString(),
          chatId: savedMsg.chatId.toString(),
          senderId: "000000000000000000000000",
          text: savedMsg.text,
          mediaUrl: "",
          mediaType: "text",
          readBy: [selfId],
          createdAt: savedMsg.createdAt
        };

        broadcastNewMessage(chatId, participants, formattedMsg);
        res.status(201).json(formattedMsg);
        return;
      } else {
        res.status(400).json({ error: "Admin commands are only available in Group Chats. Try `/creategroup <name>` to start a group!" });
        return;
      }
    }

    // 3. Regular non-command message
    if (!isGroup) {
      const partnerId = participants.find((p: string) => p !== selfId);
      if (partnerId && partnerId !== "0000000000000000000010c1" && partnerId !== "00000000000000000000lucy") {
        const isBlocked = await db.isBlocked(selfId, partnerId);
        if (isBlocked) {
          res.status(403).json({ error: "Cannot send messages. One of the users is blocked." });
          return;
        }
      }
    }

    const savedMsg = await db.createMessage({
      chatId,
      senderId: selfId,
      text: text || "",
      mediaUrl: mediaUrl || "",
      mediaType: mediaType || "text",
      replyTo,
      poll,
      selfDestructIn
    });

    const formattedMsg = {
      id: savedMsg._id.toString(),
      chatId: savedMsg.chatId.toString(),
      senderId: savedMsg.senderId.toString(),
      text: savedMsg.text,
      mediaUrl: savedMsg.mediaUrl,
      mediaType: savedMsg.mediaType,
      readBy: savedMsg.readBy.map((id: any) => id.toString()),
      createdAt: savedMsg.createdAt,
      replyTo: savedMsg.replyTo,
      reactions: savedMsg.reactions || [],
      poll: savedMsg.poll ? {
        question: savedMsg.poll.question,
        options: savedMsg.poll.options,
        votes: savedMsg.poll.votes instanceof Map ? Object.fromEntries(savedMsg.poll.votes) : (savedMsg.poll.votes || {})
      } : undefined,
      selfDestructIn: savedMsg.selfDestructIn,
      isBroadcast: !!savedMsg.isBroadcast
    };

    broadcastNewMessage(chatId, participants, formattedMsg);

    // Trigger Lucy AI response if it's a direct chat with Lucy and it's a text message (not starting with / command)
    const isLucyChat = chatObj && !chatObj.isGroup && chatObj.participants.some((p: any) => {
      const idStr = p ? (p._id ? p._id.toString() : p.toString()) : "";
      return idStr === "0000000000000000000010c1" || idStr === "00000000000000000000lucy";
    });

    if (isLucyChat && text && !text.trim().startsWith("/")) {
      const lucyId = "0000000000000000000010c1";

      // 1. Account-based Rate Limiter Check for Lucy AI (10 requests/min)
      const rateCheck = checkLucyRateLimit(selfId);
      if (!rateCheck.allowed) {
        console.warn(`[LUCY AI RATE LIMIT] User ${selfId} exceeded rate limit (10 req/min) at ${new Date().toISOString()}`);
        const rateLimitNotice = `I'm super happy chatting with you, but I need a quick 1-minute breather! ✨ Please wait ${rateCheck.retryAfterSec || 15} seconds before sending another message~`;
        
        setTimeout(async () => {
          try {
            const lucySavedMsg = await db.createMessage({
              chatId,
              senderId: lucyId,
              text: rateLimitNotice,
              mediaType: "text"
            });

            const formattedLucyMsg = {
              id: lucySavedMsg._id.toString(),
              chatId: lucySavedMsg.chatId.toString(),
              senderId: lucySavedMsg.senderId.toString(),
              text: lucySavedMsg.text,
              mediaUrl: "",
              mediaType: "text",
              readBy: [lucyId, selfId],
              createdAt: lucySavedMsg.createdAt,
              reactions: []
            };

            broadcastNewMessage(chatId, participants, formattedLucyMsg);
          } catch (err: any) {
            console.error("Error sending Lucy rate limit notice:", err);
          }
        }, 800);

        res.status(201).json(formattedMsg);
        return;
      }

      const io = getIO();
      if (io) {
        io.to(`chat_${chatId}`).emit("user_typing", {
          chatId,
          userId: lucyId,
          displayName: "Lucy ✨",
          isTyping: true
        });
      }

      setTimeout(async () => {
        try {
          let conversationContext = "";
          try {
            const recentMsgs = await db.getMessages(chatId, selfId);
            const slicedMsgs = recentMsgs ? recentMsgs.slice(-10) : [];
            if (slicedMsgs && slicedMsgs.length > 0) {
              conversationContext = slicedMsgs.map((m: any) => {
                const isLucy = m.senderId === lucyId || m.senderId === "00000000000000000000lucy";
                return `${isLucy ? "Lucy" : "User"}: ${m.text || ""}`;
              }).filter((line: string) => line.trim().length > 5).join("\n");
            }
          } catch (ctxErr) {
            console.error("Error fetching conversation context for Lucy:", ctxErr);
          }

          const replyText = await askLucy(text, conversationContext);
          const lucySavedMsg = await db.createMessage({
            chatId,
            senderId: lucyId,
            text: replyText,
            mediaType: "text"
          });

          if (io) {
            io.to(`chat_${chatId}`).emit("user_typing", {
              chatId,
              userId: lucyId,
              isTyping: false
            });
          }

          const formattedLucyMsg = {
            id: lucySavedMsg._id.toString(),
            chatId: lucySavedMsg.chatId.toString(),
            senderId: lucySavedMsg.senderId.toString(),
            text: lucySavedMsg.text,
            mediaUrl: "",
            mediaType: "text",
            readBy: [lucyId, selfId],
            createdAt: lucySavedMsg.createdAt,
            reactions: []
          };

          broadcastNewMessage(chatId, participants, formattedLucyMsg);
        } catch (err: any) {
          console.error("Error from Lucy AI:", err.message || err);
          if (io) {
            io.to(`chat_${chatId}`).emit("user_typing", {
              chatId,
              userId: lucyId,
              isTyping: false
            });
          }
        }
      }, 1000);
    }

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

// Edit Message (for self/sender)
router.post("/messages/edit", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { messageId, text } = req.body;

    if (!selfId || !messageId || text === undefined) {
      res.status(400).json({ error: "Message ID and text are required." });
      return;
    }

    const message = await db.findMessage(messageId);
    if (!message) {
      res.status(404).json({ error: "Message not found." });
      return;
    }

    const senderId = message.senderId ? message.senderId.toString() : "";
    if (senderId !== selfId) {
      res.status(403).json({ error: "Unauthorized to edit this message." });
      return;
    }

    const updated = await db.editMessage(messageId, text);
    const chatId = message.chatId ? message.chatId.toString() : "";

    // Broadcast edit via socket to all users in chat
    const io = getIO();
    if (io && chatId) {
      io.to(`chat_${chatId}`).emit("message_edited", {
        chatId,
        messageId,
        text
      });
    }

    res.json({ success: true, messageId, text });
  } catch (error) {
    console.error("Edit Message Error:", error);
    res.status(500).json({ error: "Server error editing message." });
  }
});

// Add Reaction to Message
router.post("/messages/:messageId/reaction", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!selfId || !emoji) {
      res.status(400).json({ error: "Emoji is required." });
      return;
    }

    let updatedMsg: any = null;
    let chatId: string = "";

    if (isMongoDB && MongoMessage) {
      const message = await MongoMessage.findById(messageId);
      if (!message) {
        res.status(404).json({ error: "Message not found." });
        return;
      }

      chatId = message.chatId.toString();
      const existingIdx = message.reactions.findIndex((r: any) => r.userId.toString() === selfId);

      if (existingIdx > -1) {
        if (message.reactions[existingIdx].emoji === emoji) {
          // Toggle off if same emoji
          message.reactions.splice(existingIdx, 1);
        } else {
          // Update emoji if different
          message.reactions[existingIdx].emoji = emoji;
        }
      } else {
        // Add new reaction
        message.reactions.push({ emoji, userId: selfId });
      }

      await message.save();
      updatedMsg = message;
    } else {
      const storePath = path.join(process.cwd(), "data", "db.json");
      if (fs.existsSync(storePath)) {
        const store = JSON.parse(fs.readFileSync(storePath, "utf-8"));
        const msgIdx = store.messages.findIndex((m: any) => m._id === messageId);
        if (msgIdx === -1) {
          res.status(404).json({ error: "Message not found." });
          return;
        }

        const message = store.messages[msgIdx];
        chatId = message.chatId;

        if (!message.reactions) {
          message.reactions = [];
        }

        const existingIdx = message.reactions.findIndex((r: any) => r.userId === selfId);
        if (existingIdx > -1) {
          if (message.reactions[existingIdx].emoji === emoji) {
            message.reactions.splice(existingIdx, 1);
          } else {
            message.reactions[existingIdx].emoji = emoji;
          }
        } else {
          message.reactions.push({ emoji, userId: selfId });
        }

        fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
        updatedMsg = message;
      }
    }

    if (updatedMsg) {
      const finalReactions = updatedMsg.reactions || [];
      broadcastMessageUpdate(chatId, messageId, { reactions: finalReactions });
      res.json({ success: true, reactions: finalReactions });
    } else {
      res.status(404).json({ error: "Message not found." });
    }
  } catch (error) {
    console.error("Reaction Error:", error);
    res.status(500).json({ error: "Server error setting reaction." });
  }
});

// Vote in a Poll
router.post("/messages/:messageId/poll/vote", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { messageId } = req.params;
    const { optionIndex } = req.body; // optionIndex is a number (0-indexed)

    if (!selfId || optionIndex === undefined || typeof optionIndex !== "number") {
      res.status(400).json({ error: "Option index is required." });
      return;
    }

    let updatedMsg: any = null;
    let chatId: string = "";

    if (isMongoDB && MongoMessage) {
      const message = await MongoMessage.findById(messageId);
      if (!message || message.mediaType !== "poll" || !message.poll) {
        res.status(404).json({ error: "Poll not found." });
        return;
      }

      chatId = message.chatId.toString();
      
      // Mongoose Map votes: optionIndex string -> userIds array
      const key = optionIndex.toString();
      if (!message.poll.votes) {
        message.poll.votes = new Map();
      }

      // Check all options and remove user from any other options (WhatsApp/Telegram allows single-selection default or multi)
      // Let's do toggle single-selection vote (you vote for one, it untoggles other options for you)
      const currentVotes = message.poll.votes.get(key) || [];
      const hasVotedThis = currentVotes.includes(selfId);

      // Clear user vote from all options first (standard single-choice Telegram poll)
      for (const [optKey, vList] of message.poll.votes.entries()) {
        const filtered = (vList as string[]).filter((uid: string) => uid !== selfId);
        message.poll.votes.set(optKey, filtered);
      }

      // Toggle this option
      if (!hasVotedThis) {
        const newVotesList = [...(message.poll.votes.get(key) || []), selfId];
        message.poll.votes.set(key, newVotesList);
      }

      // Mark modified for mixed type or map
      message.markModified("poll.votes");
      await message.save();
      updatedMsg = message;
    } else {
      const storePath = path.join(process.cwd(), "data", "db.json");
      if (fs.existsSync(storePath)) {
        const store = JSON.parse(fs.readFileSync(storePath, "utf-8"));
        const msgIdx = store.messages.findIndex((m: any) => m._id === messageId);
        if (msgIdx === -1 || store.messages[msgIdx].mediaType !== "poll" || !store.messages[msgIdx].poll) {
          res.status(404).json({ error: "Poll not found." });
          return;
        }

        const message = store.messages[msgIdx];
        chatId = message.chatId;

        if (!message.poll.votes) {
          message.poll.votes = {};
        }

        const currentVotes = message.poll.votes[optionIndex] || [];
        const hasVotedThis = currentVotes.includes(selfId);

        // Clear user vote from all options
        for (const idx of Object.keys(message.poll.votes)) {
          message.poll.votes[idx] = (message.poll.votes[idx] || []).filter((uid: string) => uid !== selfId);
        }

        // Toggle this option
        if (!hasVotedThis) {
          if (!message.poll.votes[optionIndex]) message.poll.votes[optionIndex] = [];
          message.poll.votes[optionIndex].push(selfId);
        }

        fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
        updatedMsg = message;
      }
    }

    if (updatedMsg) {
      const votesObj = updatedMsg.poll.votes instanceof Map 
        ? Object.fromEntries(updatedMsg.poll.votes) 
        : (updatedMsg.poll.votes || {});
      
      const pollData = {
        question: updatedMsg.poll.question,
        options: updatedMsg.poll.options,
        votes: votesObj
      };

      broadcastMessageUpdate(chatId, messageId, { poll: pollData });
      res.json({ success: true, poll: pollData });
    } else {
      res.status(404).json({ error: "Message not found." });
    }
  } catch (error) {
    console.error("Poll Vote Error:", error);
    res.status(500).json({ error: "Server error casting vote." });
  }
});

// --- REPORT & BLOCKS & MODERATION ROUTES ---

// Telegram notifications optional — set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in env (never commit tokens)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

async function sendTelegramMessage(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("[Telegram] Skipped (no TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID configured)");
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: "HTML"
      })
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram sendMessage failed:", data);
    }
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
  }
}

async function sendTelegramPhoto(caption: string, base64Data: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return;
  }
  try {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid base64 payload");
    }
    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const formData = new FormData();
    formData.append("chat_id", TELEGRAM_CHAT_ID);
    formData.append("caption", caption);
    
    const blob = new Blob([buffer], { type: mimeType });
    formData.append("photo", blob, `screenshot.${mimeType.split("/")[1] || "png"}`);
    
    const res = await fetch(url, {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram sendPhoto failed:", data);
    }
  } catch (err) {
    console.error("Failed to send Telegram photo:", err);
  }
}

// Submit Issue Report
router.post("/reports/issue", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { category, title, description, screenshot } = req.body;

    if (!selfId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!category || !title || !description) {
      res.status(400).json({ error: "Category, Title, and Description are required." });
      return;
    }

    const reporter = await db.findUserById(selfId);
    if (!reporter) {
      res.status(404).json({ error: "Reporter not found." });
      return;
    }

    let savedScreenshotUrl = "";
    if (screenshot && screenshot.startsWith("data:")) {
      try {
        savedScreenshotUrl = saveBase64File(screenshot);
      } catch (err) {
        console.error("Failed to save report screenshot locally:", err);
      }
    } else if (screenshot) {
      savedScreenshotUrl = screenshot;
    }

    // Save in database
    await db.createReport({
      type: "issue",
      reporterId: selfId,
      category,
      title,
      description,
      screenshot: savedScreenshotUrl
    });

    // Send Telegram Notification
    const timestamp = new Date().toLocaleString();
    const telegramMessage = `🚨 <b>APP ISSUE REPORT</b>\n\n` +
      `👤 <b>User:</b> ${reporter.username}\n` +
      `🆔 <b>User ID:</b> ${selfId}\n\n` +
      `📂 <b>Category:</b> ${category}\n` +
      `📝 <b>Title:</b> ${title}\n\n` +
      `📄 <b>Description:</b>\n${description}\n\n` +
      `🕒 <b>Time:</b>\n${timestamp}`;

    await sendTelegramMessage(telegramMessage);

    // If screenshot exists, send photo too
    if (screenshot && screenshot.startsWith("data:")) {
      await sendTelegramPhoto(`Screenshot for issue: ${title}`, screenshot);
    }

    res.json({ success: true, message: "Issue reported successfully." });
  } catch (error) {
    console.error("Issue Report Error:", error);
    res.status(500).json({ error: "Server error reporting issue." });
  }
});

// Submit User Report
router.post("/reports/user", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { reportedUserId, reason, description } = req.body;

    if (!selfId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!reportedUserId || !reason || !description) {
      res.status(400).json({ error: "Reported user, Reason, and Description are required." });
      return;
    }

    const reporter = await db.findUserById(selfId);
    const reportedUser = await db.findUserById(reportedUserId);

    if (!reporter || !reportedUser) {
      res.status(404).json({ error: "Reporter or Reported user not found." });
      return;
    }

    const targetUsername = reportedUser.username.toLowerCase();
    if (targetUsername === "expectations" || targetUsername === "lucy") {
      res.status(403).json({ error: "This user cannot be reported." });
      return;
    }

    // Retrieve last 10 messages context
    const chat = await db.getOrCreateDirectChat(selfId, reportedUserId);
    const messages = await db.getMessages(chat._id.toString(), selfId);
    const last10 = messages
      .slice()
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .reverse();

    const messagesContext = [];
    let telegramMsgs = "";

    for (let i = 0; i < last10.length; i++) {
      const msg = last10[i];
      const isSelf = msg.senderId.toString() === selfId;
      const senderUsername = isSelf ? reporter.username : reportedUser.username;
      
      messagesContext.push({
        senderUsername,
        senderId: msg.senderId.toString(),
        text: msg.text || `[Media: ${msg.mediaType}]`,
        createdAt: msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString()
      });

      telegramMsgs += `${i + 1}. [${senderUsername}]: ${msg.text || `[Media: ${msg.mediaType}]`}\n`;
    }

    if (!telegramMsgs) {
      telegramMsgs = "No messages exchanged yet.";
    }

    // Save in DB
    await db.createReport({
      type: "user",
      reporterId: selfId,
      reportedUserId,
      reason,
      description,
      messagesContext
    });

    // Send Telegram Notification
    const timestamp = new Date().toLocaleString();
    const telegramMessage = `⚠️ <b>USER REPORT</b>\n\n` +
      `<b>Reporter</b>\n` +
      `Username: ${reporter.username}\n` +
      `User ID: ${selfId}\n\n` +
      `<b>Reported User</b>\n` +
      `Username: ${reportedUser.username}\n` +
      `User ID: ${reportedUserId}\n\n` +
      `<b>Reason:</b> ${reason}\n` +
      `<b>Description:</b>\n${description}\n\n` +
      `<b>Last 10 Messages</b>\n\n` +
      `${telegramMsgs}\n` +
      `Time: ${timestamp}`;

    await sendTelegramMessage(telegramMessage);

    res.json({ success: true, message: "User reported successfully." });
  } catch (error) {
    console.error("User Report Error:", error);
    res.status(500).json({ error: "Server error reporting user." });
  }
});

// Block User
router.post("/users/block", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { targetId } = req.body;

    if (!selfId || !targetId) {
      res.status(400).json({ error: "Target User ID is required." });
      return;
    }

    if (selfId === targetId) {
      res.status(400).json({ error: "Cannot block yourself." });
      return;
    }

    const targetUser = await db.findUserById(targetId);
    if (!targetUser) {
      res.status(404).json({ error: "Target user not found." });
      return;
    }

    const targetUsername = targetUser.username.toLowerCase();
    if (targetUsername === "expectations" || targetUsername === "lucy") {
      res.status(403).json({ error: "This user cannot be blocked." });
      return;
    }

    await db.blockUser(selfId, targetId);
    res.json({ success: true, message: "User blocked successfully." });
  } catch (error) {
    console.error("Block User Error:", error);
    res.status(500).json({ error: "Server error blocking user." });
  }
});

// Unblock User
router.post("/users/unblock", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    const { targetId } = req.body;

    if (!selfId || !targetId) {
      res.status(400).json({ error: "Target User ID is required." });
      return;
    }

    await db.unblockUser(selfId, targetId);
    res.json({ success: true, message: "User unblocked successfully." });
  } catch (error) {
    console.error("Unblock User Error:", error);
    res.status(500).json({ error: "Server error unblocking user." });
  }
});

// Get Blocked Users list
router.get("/users/blocked", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const selfId = req.user?.id;
    if (!selfId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const selfUser = await db.findUserById(selfId);
    if (!selfUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const blockedIds = selfUser.blockedUsers || [];
    const blockedList = [];

    for (const bId of blockedIds) {
      const u = await db.findUserById(bId);
      if (u) {
        blockedList.push({
          id: u._id.toString(),
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl
        });
      }
    }

    res.json(blockedList);
  } catch (error) {
    console.error("Get Blocked Users Error:", error);
    res.status(500).json({ error: "Server error retrieving blocked list." });
  }
});

// Admin Authorization Middleware Helper
function requireAdmin(req: AuthenticatedRequest, res: Response, next: any) {
  const username = req.user?.username ? req.user.username.toLowerCase() : "";
  const isSuperAdmin = username === "expectations";
  const isAdmin = isSuperAdmin || !!req.user?.isAdmin;
  if (!isAdmin) {
    res.status(403).json({ error: "Access denied. Administrator privileges required." });
    return;
  }
  next();
}

// Admin: Search / List Users
router.get("/admin/users", authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    let users = await db.getAllUsers();
    
    if (q && typeof q === "string") {
      const search = q.trim().toLowerCase();
      users = users.filter((u: any) => 
        u.username.toLowerCase().includes(search) || 
        u.displayName.toLowerCase().includes(search)
      );
    }

    res.json(users.map((u: any) => ({
      id: u._id.toString(),
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      status: u.status,
      lastSeen: u.lastSeen,
      isBanned: !!u.isBanned,
      bannedUntil: u.bannedUntil
    })));
  } catch (error) {
    console.error("Admin Users Fetch Error:", error);
    res.status(500).json({ error: "Server error fetching admin users." });
  }
});

// Admin: View User Details & Previous Reports
router.get("/admin/users/:userId", authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const user = await db.findUserById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const reports = await db.getReportsForUser(userId);

    res.json({
      user: {
        id: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
        lastSeen: user.lastSeen,
        bio: user.bio,
        customStatus: user.customStatus,
        createdAt: user.createdAt,
        isBanned: !!user.isBanned,
        bannedUntil: user.bannedUntil,
        isAdmin: !!user.isAdmin
      },
      reports: reports.map((r: any) => ({
        id: r._id ? r._id.toString() : r._id,
        type: r.type,
        reporterId: r.reporterId,
        category: r.category,
        reason: r.reason,
        title: r.title,
        description: r.description,
        screenshot: r.screenshot,
        messagesContext: r.messagesContext,
        createdAt: r.createdAt
      }))
    });
  } catch (error) {
    console.error("Admin User Details Error:", error);
    res.status(500).json({ error: "Server error fetching user details." });
  }
});

// Admin: Ban User
router.post("/admin/users/:userId/ban", authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { bannedUntil } = req.body; // ISO Date String, or undefined for permanent

    const targetUser = await db.findUserById(userId);
    if (!targetUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const targetUsername = targetUser.username.toLowerCase();
    if (targetUsername === "expectations" || targetUsername === "lucy") {
      res.status(403).json({ error: "This user cannot be banned." });
      return;
    }

    const callerUsername = req.user?.username.toLowerCase();
    const isCallerSuper = callerUsername === "expectations";
    const isTargetAdmin = !!targetUser.isAdmin;
    if (isTargetAdmin && !isCallerSuper) {
      res.status(403).json({ error: "Only the super admin can ban other administrators." });
      return;
    }

    let dateObj: Date | undefined = undefined;
    if (bannedUntil) {
      dateObj = new Date(bannedUntil);
    }

    await db.banUser(userId, dateObj);
    res.json({ success: true, message: "User banned successfully." });
  } catch (error) {
    console.error("Admin Ban Error:", error);
    res.status(500).json({ error: "Server error banning user." });
  }
});

// Admin: Unban User
router.post("/admin/users/:userId/unban", authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const targetUser = await db.findUserById(userId);
    if (!targetUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const targetUsername = targetUser.username.toLowerCase();
    if (targetUsername === "expectations" || targetUsername === "lucy") {
      res.status(403).json({ error: "This user cannot be banned or unbanned." });
      return;
    }

    const callerUsername = req.user?.username.toLowerCase();
    const isCallerSuper = callerUsername === "expectations";
    const isTargetAdmin = !!targetUser.isAdmin;
    if (isTargetAdmin && !isCallerSuper) {
      res.status(403).json({ error: "Only the super admin can unban other administrators." });
      return;
    }

    await db.unbanUser(userId);
    res.json({ success: true, message: "User unbanned successfully." });
  } catch (error) {
    console.error("Admin Unban Error:", error);
    res.status(500).json({ error: "Server error unbanning user." });
  }
});

// Admin: Promote or Demote user to/from Admin
router.post("/admin/users/:userId/toggle-admin", authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { isAdmin } = req.body; // boolean

    // Only the super admin (expectations) has the right to grant admin access
    const callerUsername = req.user?.username.toLowerCase();
    if (callerUsername !== "expectations") {
      res.status(403).json({ error: "Only the super admin can grant or revoke administrative access." });
      return;
    }

    const targetUser = await db.findUserById(userId);
    if (!targetUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const targetUsername = targetUser.username.toLowerCase();
    if (targetUsername === "expectations" || targetUsername === "lucy") {
      res.status(400).json({ error: "Cannot modify role of super admin or Lucy." });
      return;
    }

    await db.updateUser(userId, { isAdmin: !!isAdmin });

    // Emit real-time event to the user's personal room
    const io = getIO();
    if (io) {
      io.to(`user_${userId}`).emit("admin_status_updated", { isAdmin: !!isAdmin });
    }

    res.json({ success: true, message: `User admin status updated to ${!!isAdmin}.` });
  } catch (error: any) {
    console.error("Admin Toggle Admin Error:", error);
    res.status(500).json({ error: "Server error updating user role." });
  }
});

// Admin: Broadcast Message to every user
router.post("/admin/broadcast", authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Broadcast text content is required." });
      return;
    }

    const selfId = req.user?.id;
    if (!selfId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const adminUser = await db.findUserById(selfId);
    if (!adminUser) {
      res.status(404).json({ error: "Admin user not found." });
      return;
    }

    // Get all users
    const allUsers = await db.getAllUsers();
    
    // Filter out the admin themselves and Lucy AI bot
    const targetUsers = allUsers.filter((u: any) => {
      const uId = u._id.toString();
      return uId !== selfId && uId !== "0000000000000000000010c1" && u.username !== "lucy";
    });

    let broadcastCount = 0;

    for (const targetUser of targetUsers) {
      const targetUserId = targetUser._id.toString();
      
      // Find or create direct chat
      const directChat = await db.getOrCreateDirectChat(selfId, targetUserId);
      const chatId = directChat._id.toString();

      // Create message
      const savedMsg = await db.createMessage({
        chatId,
        senderId: selfId,
        text: text.trim(),
        isBroadcast: true
      });

      const formattedMsg = {
        id: savedMsg._id.toString(),
        chatId,
        senderId: selfId,
        text: savedMsg.text,
        mediaUrl: savedMsg.mediaUrl || "",
        mediaType: savedMsg.mediaType || "text",
        readBy: [selfId],
        createdAt: savedMsg.createdAt,
        isBroadcast: true
      };

      const participants = [selfId, targetUserId];
      broadcastNewMessage(chatId, participants, formattedMsg);
      broadcastCount++;
    }

    res.json({ success: true, message: `Successfully broadcasted to ${broadcastCount} users.` });
  } catch (error: any) {
    console.error("Admin Broadcast Error:", error);
    res.status(500).json({ error: error.message || "Server error broadcasting message." });
  }
});

export default router;
