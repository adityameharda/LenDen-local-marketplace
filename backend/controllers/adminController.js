const User = require("../models/User");
const Product = require("../models/Product");
const Admin = require("../models/Admin");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const {
  verifyListingReviewActionToken,
} = require("../utils/listingReviewActionToken");

const renderEmailActionPage = ({ title, message, status = 200 }) => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f4f4f2; margin: 0; padding: 28px; color: #1a1c1b; }
        .card { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #d7dddb; border-radius: 12px; padding: 20px; }
        h1 { margin: 0 0 8px; font-size: 24px; }
        p { margin: 0 0 10px; line-height: 1.55; color: #3e4949; }
        a { color: #0d9488; text-decoration: none; font-weight: 600; }
        .status-${status >= 400 ? "error" : "ok"} { color: ${status >= 400 ? "#b91c1c" : "#0d9488"}; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${title}</h1>
        <p class="status-${status >= 400 ? "error" : "ok"}">${message}</p>
        <p>You can close this tab or go to <a href="/admin.html">Admin Panel</a>.</p>
      </div>
    </body>
  </html>
`;

const applyListingReviewDecision = async (product, decision) => {
  if (decision === "approve") {
    product.isApproved = true;
  } else {
    product.isApproved = false;
  }
  await product.save();
};

const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ role: "user" })
    .select("-password")
    .sort({ createdAt: -1 });
  res.json(users);
});

const blockUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.isBlocked = true;
  await user.save();
  res.json({ message: "User blocked" });
});

const unblockUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.isBlocked = false;
  await user.save();
  res.json({ message: "User unblocked" });
});

const listListings = asyncHandler(async (req, res) => {
  const listings = await Product.find()
    .populate("seller", "name phone")
    .sort({ createdAt: -1 });
  res.json(listings);
});

const approveListing = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  await applyListingReviewDecision(product, "approve");
  res.json({ message: "Listing approved" });
});

const rejectListing = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  await applyListingReviewDecision(product, "reject");
  res.json({ message: "Listing rejected" });
});

const reviewListingByEmailAction = asyncHandler(async (req, res) => {
  const token = String(req.query.token || "");
  const action = req.params.action;
  const listingId = String(req.params.id || "");

  if (!token || !["approve", "reject"].includes(action)) {
    return res.status(400).send(
      renderEmailActionPage({
        title: "Invalid Request",
        message: "Missing or invalid action token.",
        status: 400,
      }),
    );
  }

  let payload;
  try {
    payload = verifyListingReviewActionToken(token);
  } catch (error) {
    return res.status(400).send(
      renderEmailActionPage({
        title: "Token Expired or Invalid",
        message:
          "This action link is no longer valid. Please review from Admin Panel.",
        status: 400,
      }),
    );
  }

  if (payload.action !== action || String(payload.listingId) !== listingId) {
    return res.status(403).send(
      renderEmailActionPage({
        title: "Unauthorized Action",
        message: "This link does not match the intended listing action.",
        status: 403,
      }),
    );
  }

  const product = await Product.findById(listingId);
  if (!product) {
    return res.status(404).send(
      renderEmailActionPage({
        title: "Listing Not Found",
        message: "The listing may have been removed already.",
        status: 404,
      }),
    );
  }

  await applyListingReviewDecision(product, action);

  return res.send(
    renderEmailActionPage({
      title: action === "approve" ? "Listing Approved" : "Listing Rejected",
      message:
        action === "approve"
          ? `"${product.title}" has been approved successfully.`
          : `"${product.title}" has been rejected successfully.`,
      status: 200,
    }),
  );
});

const removeListing = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  await product.deleteOne();
  res.json({ message: "Listing removed" });
});

const getStats = asyncHandler(async (req, res) => {
  const [users, listings, blockedUsers, pendingListings] = await Promise.all([
    User.countDocuments({ role: "user" }),
    Product.countDocuments(),
    User.countDocuments({ isBlocked: true }),
    Product.countDocuments({ isApproved: false }),
  ]);

  const admins = await Admin.countDocuments();

  res.json({ users, admins, listings, blockedUsers, pendingListings });
});

module.exports = {
  getUsers,
  blockUser,
  unblockUser,
  listListings,
  approveListing,
  rejectListing,
  reviewListingByEmailAction,
  removeListing,
  getStats,
};
