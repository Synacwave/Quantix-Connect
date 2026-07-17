import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { db } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "quantix_connect_super_secret_key_1337";

// Track active socket connections: userId -> Set of socketIds (to support multiple tabs)
export const activeConnections = new Map<string, Set<string>>();

// Track socketId -> userId for quick reverse lookup on disconnect
const socketUserMap = new Map<string, string>();

let io: SocketIOServer | null = null;

export function initializeSocket(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string };
      socket.data.userId = decoded.id;
      socket.data.username = decoded.username;
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    const username = socket.data.username;
    const socketId = socket.id;

    // Track connection
    if (!activeConnections.has(userId)) {
      activeConnections.set(userId, new Set());
    }
    activeConnections.get(userId)!.add(socketId);
    socketUserMap.set(socketId, userId);

    // Set user online in database and broadcast
    try {
      await db.updateUser(userId, { status: "online", lastSeen: new Date().toISOString() });
      
      // Let other users know this user is online
      io?.emit("user_status", {
        userId,
        status: "online",
        lastSeen: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error setting user online:", err);
    }

    // Join user's personal notification room
    socket.join(`user_${userId}`);

    // Join active chat rooms when requested
    socket.on("join_chat", (chatId: string) => {
      socket.join(`chat_${chatId}`);
    });

    socket.on("leave_chat", (chatId: string) => {
      socket.leave(`chat_${chatId}`);
    });

    // Handle typing indicator
    socket.on("typing", ({ chatId, displayName }: { chatId: string; displayName: string }) => {
      socket.to(`chat_${chatId}`).emit("user_typing", {
        chatId,
        userId,
        displayName,
        isTyping: true
      });
    });

    socket.on("stop_typing", ({ chatId }: { chatId: string }) => {
      socket.to(`chat_${chatId}`).emit("user_typing", {
        chatId,
        userId,
        isTyping: false
      });
    });

    // Handle manual read receipts
    socket.on("read_chat", async ({ chatId }: { chatId: string }) => {
      try {
        await db.markMessagesAsRead(chatId, userId);
        
        // Notify other participants in the chat that messages are read
        socket.to(`chat_${chatId}`).emit("messages_read", {
          chatId,
          readBy: userId
        });
      } catch (err) {
        console.error("Error updating read status via socket:", err);
      }
    });

    // Handle manual message delete
    socket.on("delete_message", ({ chatId, messageId }: { chatId: string; messageId: string }) => {
      // Notify other tabs of the same user to remove the message
      io?.to(`user_${userId}`).emit("message_deleted", { chatId, messageId });
    });

    // Handle disconnect
    socket.on("disconnect", async () => {
      const userSockets = activeConnections.get(userId);
      if (userSockets) {
        userSockets.delete(socketId);
        if (userSockets.size === 0) {
          // No more active tabs/connections for this user, they are truly offline
          activeConnections.delete(userId);
          
          try {
            const lastSeenTime = new Date().toISOString();
            await db.updateUser(userId, { status: "offline", lastSeen: lastSeenTime });
            
            // Broadcast offline status
            io?.emit("user_status", {
              userId,
              status: "offline",
              lastSeen: lastSeenTime
            });
          } catch (err) {
            console.error("Error setting user offline:", err);
          }
        }
      }
      socketUserMap.delete(socketId);
    });
  });

  return io;
}

// Helper to broadcast new messages to participants
export function broadcastNewMessage(chatId: string, participants: string[], message: any) {
  if (!io) return;

  // 1. Broadcast to the active chat room (for people currently looking at the chat)
  io.to(`chat_${chatId}`).emit("new_message", message);

  // 2. Broadcast to individual participant personal rooms (to update recent chats / trigger sound / unread badges)
  participants.forEach(userId => {
    io?.to(`user_${userId}`).emit("chat_update", {
      chatId,
      message: {
        id: message.id || message._id,
        text: message.text,
        mediaType: message.mediaType,
        senderId: message.senderId,
        createdAt: message.createdAt
      }
    });
  });
}

export function getIO(): SocketIOServer | null {
  return io;
}
