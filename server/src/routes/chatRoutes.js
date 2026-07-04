import express from "express";
import {
  createOrGetDM,
  createGroupChat,
  getUserChats,
  getSingleChat,
  searchUsers,
} from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getUserChats);
router.get("/users/search", searchUsers);
router.get("/:chatId", getSingleChat);

router.post("/dm", createOrGetDM);
router.post("/group", createGroupChat);

export default router;