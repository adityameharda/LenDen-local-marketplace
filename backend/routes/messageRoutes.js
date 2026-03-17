const express = require("express");
const {
  sendMessage,
  listMessages,
  updateMessage,
  deleteMessage,
} = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, listMessages);
router.post("/", protect, sendMessage);
router.patch("/:id", protect, updateMessage);
router.delete("/:id", protect, deleteMessage);

module.exports = router;
