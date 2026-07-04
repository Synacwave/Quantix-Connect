import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";

/**
 * GET /api/messages/:chatId
 * Fetch all messages for a chat the current user belongs to
 */
export const getChatMessages = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chatId" });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: currentUserId,
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found or access denied",
      });
    }

    const messages = await Message.find({ chat: chatId })
      .populate("sender", "_id fullName username email avatar")
      .sort({ createdAt: 1 });

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("getChatMessages error:", error);
    return res.status(500).json({
      message: "Server error fetching messages",
    });
  }
};

/**
 * POST /api/messages/:chatId
 * Send a new message into a chat
 * body: { text, attachments? }
 */
export const sendMessage = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { chatId } = req.params;
    const { text = "", attachments = [] } = req.body;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chatId" });
    }

    const cleanedText = text.trim();

    if (!cleanedText && (!Array.isArray(attachments) || attachments.length === 0)) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: currentUserId,
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found or access denied",
      });
    }

    const message = await Message.create({
      chat: chatId,
      sender: currentUserId,
      text: cleanedText,
      attachments: Array.isArray(attachments) ? attachments : [],
      readBy: [currentUserId],
    });

    const populatedMessage = await Message.findById(message._id).populate(
      "sender",
      "_id fullName username email avatar"
    );

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: populatedMessage._id,
      updatedAt: new Date(),
    });

    return res.status(201).json({
      message: "Message sent",
      data: populatedMessage,
    });
  } catch (error) {
    console.error("sendMessage error:", error);
    return res.status(500).json({
      message: "Server error sending message",
    });
  }
};

/**
 * PATCH /api/messages/:messageId/read
 * Mark one message as read by current user
 */
export const markMessageAsRead = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid messageId" });
    }

    const message = await Message.findById(messageId).populate("chat");

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const isParticipant = message.chat.participants.some(
      (participantId) => String(participantId) === String(currentUserId)
    );

    if (!isParticipant) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!message.readBy.some((id) => String(id) === String(currentUserId))) {
      message.readBy.push(currentUserId);
      await message.save();
    }

    const updatedMessage = await Message.findById(messageId).populate(
      "sender",
      "_id fullName username email avatar"
    );

    return res.status(200).json({
      message: "Message marked as read",
      data: updatedMessage,
    });
  } catch (error) {
    console.error("markMessageAsRead error:", error);
    return res.status(500).json({
      message: "Server error marking message as read",
    });
  }
};