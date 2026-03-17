const Favorite = require("../models/Favorite");
const Product = require("../models/Product");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");

const addFavorite = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!productId) {
    throw new ApiError(400, "Product is required");
  }

  const product = await Product.findById(productId).select(
    "seller isApproved status",
  );
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (String(product.seller) === String(req.user._id)) {
    throw new ApiError(400, "You cannot favorite your own listing");
  }

  if (!product.isApproved || product.status !== "Available") {
    throw new ApiError(400, "Only available approved listings can be favorited");
  }

  await Favorite.updateOne(
    { user: req.user._id, product: productId },
    { $set: { user: req.user._id, product: productId } },
    { upsert: true },
  );

  res.status(201).json({ message: "Added to favorites" });
});

const removeFavorite = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  await Favorite.deleteOne({ user: req.user._id, product: productId });
  res.json({ message: "Removed from favorites" });
});

const listFavorites = asyncHandler(async (req, res) => {
  const favorites = await Favorite.find({ user: req.user._id })
    .populate({
      path: "product",
      populate: { path: "seller", select: "name phone" },
    })
    .sort({ createdAt: -1 });
  res.json(favorites.filter((favorite) => favorite.product));
});

module.exports = { addFavorite, removeFavorite, listFavorites };
