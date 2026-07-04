import express from "express";
import {
  getChatMessages,
  sendMessage,
  markMessageAsRead,
} from "../controllers/messageController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/:chatId", getChatMessages);
router.post("/:chatId", sendMessage);
router.patch("/:messageId/read", markMessageAsRead);

export default router;