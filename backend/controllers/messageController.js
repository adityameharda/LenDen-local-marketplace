const Message = require("../models/Message");
const Product = require("../models/Product");
const User = require("../models/User");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");

const populateMessage = (query) =>
  query
    .populate("sender", "name")
    .populate("recipient", "name")
    .populate("product", "title");

const sendMessage = asyncHandler(async (req, res) => {
  const { recipientId, productId, content } = req.body;
  const trimmedContent = typeof content === "string" ? content.trim() : "";

  if (!recipientId || !trimmedContent) {
    throw new ApiError(400, "Recipient and content are required");
  }

  if (String(recipientId) === String(req.user._id)) {
    throw new ApiError(400, "You cannot message yourself");
  }

  const recipient = await User.findById(recipientId).select("_id isBlocked");
  if (!recipient) {
    throw new ApiError(404, "Recipient not found");
  }

  if (recipient.isBlocked) {
    throw new ApiError(403, "Recipient is unavailable");
  }

  if (productId) {
    const product = await Product.findById(productId).select("seller");
    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    const sellerId = String(product.seller);
    const senderId = String(req.user._id);
    const targetRecipientId = String(recipientId);
    if (sellerId !== senderId && sellerId !== targetRecipientId) {
      throw new ApiError(400, "Messages about a listing must include its seller");
    }
  }

  const message = await Message.create({
    sender: req.user._id,
    recipient: recipientId,
    product: productId,
    content: trimmedContent,
  });

  const populatedMessage = await populateMessage(
    Message.findById(message._id),
  );

  res.status(201).json(populatedMessage);
});

const listMessages = asyncHandler(async (req, res) => {
  const { productId } = req.query;
  const filter = {
    $or: [{ sender: req.user._id }, { recipient: req.user._id }],
  };
  if (productId) {
    filter.product = productId;
  }

  const messages = await populateMessage(Message.find(filter).sort({ createdAt: -1 }));

  res.json(messages);
});

const updateMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  if (String(message.sender) !== String(req.user._id)) {
    throw new ApiError(403, "You can only edit your own messages");
  }

  if (message.isDeleted) {
    throw new ApiError(400, "Deleted messages cannot be edited");
  }

  const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
  if (!content) {
    throw new ApiError(400, "Message content is required");
  }

  message.content = content;
  message.editedAt = new Date();
  await message.save();

  const populatedMessage = await populateMessage(
    Message.findById(message._id),
  );

  res.json({ message: "Message updated", data: populatedMessage });
});

const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  if (String(message.sender) !== String(req.user._id)) {
    throw new ApiError(403, "You can only delete your own messages");
  }

  if (message.isDeleted) {
    res.json({ message: "Message already deleted" });
    return;
  }

  message.content = "This message was deleted.";
  message.isDeleted = true;
  message.deletedAt = new Date();
  message.editedAt = null;
  await message.save();

  res.json({ message: "Message deleted" });
});

module.exports = { sendMessage, listMessages, updateMessage, deleteMessage };
