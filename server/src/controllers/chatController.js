import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

/**
 * Create or return existing DM chat
 * POST /api/chats/dm
 * body: { userId }
 */
export const createOrGetDM = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "Target userId is required" });
    }

    if (String(currentUserId) === String(userId)) {
      return res.status(400).json({ message: "You cannot DM yourself" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const targetUser = await User.findById(userId).select("_id fullName username email");
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    let existingChat = await Chat.findOne({
      type: "dm",
      participants: { $all: [currentUserId, userId], $size: 2 },
    })
      .populate("participants", "_id fullName username email avatar")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "_id fullName username",
        },
      });

    if (existingChat) {
      return res.status(200).json({
        message: "DM chat fetched",
        chat: existingChat,
      });
    }

    const chat = await Chat.create({
      type: "dm",
      participants: [currentUserId, userId],
    });

    const populatedChat = await Chat.findById(chat._id)
      .populate("participants", "_id fullName username email avatar")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "_id fullName username",
        },
      });

    return res.status(201).json({
      message: "DM chat created",
      chat: populatedChat,
    });
  } catch (error) {
    console.error("createOrGetDM error:", error);
    return res.status(500).json({ message: "Server error creating DM chat" });
  }
};

/**
 * Create group chat
 * POST /api/chats/group
 * body: { name, participantIds, description? }
 */
export const createGroupChat = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { name, participantIds = [], description = "" } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    if (!Array.isArray(participantIds)) {
      return res.status(400).json({ message: "participantIds must be an array" });
    }

    const uniqueParticipants = [
      ...new Set([String(currentUserId), ...participantIds.map(String)]),
    ];

    if (uniqueParticipants.length < 2) {
      return res
        .status(400)
        .json({ message: "Group must contain at least 2 members including you" });
    }

    const validUsers = await User.find({
      _id: { $in: uniqueParticipants },
    }).select("_id");

    if (validUsers.length !== uniqueParticipants.length) {
      return res.status(400).json({ message: "One or more participants are invalid" });
    }

    const group = await Chat.create({
      type: "group",
      name: name.trim(),
      description: description.trim(),
      participants: uniqueParticipants,
      admins: [currentUserId],
    });

    const populatedGroup = await Chat.findById(group._id)
      .populate("participants", "_id fullName username email avatar")
      .populate("admins", "_id fullName username email avatar");

    return res.status(201).json({
      message: "Group chat created",
      chat: populatedGroup,
    });
  } catch (error) {
    console.error("createGroupChat error:", error);
    return res.status(500).json({ message: "Server error creating group chat" });
  }
};

/**
 * Get all chats for current user
 * GET /api/chats
 */
export const getUserChats = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const chats = await Chat.find({
      participants: currentUserId,
    })
      .populate("participants", "_id fullName username email avatar")
      .populate("admins", "_id fullName username email avatar")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "_id fullName username",
        },
      })
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      chats,
    });
  } catch (error) {
    console.error("getUserChats error:", error);
    return res.status(500).json({ message: "Server error fetching chats" });
  }
};

/**
 * Get one chat by ID
 * GET /api/chats/:chatId
 */
export const getSingleChat = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chatId" });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: currentUserId,
    })
      .populate("participants", "_id fullName username email avatar")
      .populate("admins", "_id fullName username email avatar")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "_id fullName username",
        },
      });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    return res.status(200).json({ chat });
  } catch (error) {
    console.error("getSingleChat error:", error);
    return res.status(500).json({ message: "Server error fetching chat" });
  }
};

/**
 * Search users for starting new chats/groups
 * GET /api/chats/users/search?q=something
 */
export const searchUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const q = req.query.q?.trim();

    if (!q) {
      return res.status(200).json({ users: [] });
    }

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { fullName: { $regex: q, $options: "i" } },
        { username: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    })
      .select("_id fullName username email avatar")
      .limit(20);

    return res.status(200).json({ users });
  } catch (error) {
    console.error("searchUsers error:", error);
    return res.status(500).json({ message: "Server error searching users" });
  }
};