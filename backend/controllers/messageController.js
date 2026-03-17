const Message = require("../models/Message");
const Product = require("../models/Product");
const User = require("../models/User");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");

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

  res.status(201).json(message);
});

const listMessages = asyncHandler(async (req, res) => {
  const { productId } = req.query;
  const filter = {
    $or: [{ sender: req.user._id }, { recipient: req.user._id }],
  };
  if (productId) {
    filter.product = productId;
  }

  const messages = await Message.find(filter)
    .populate("sender", "name")
    .populate("recipient", "name")
    .populate("product", "title")
    .sort({ createdAt: -1 });

  res.json(messages);
});

module.exports = { sendMessage, listMessages };
