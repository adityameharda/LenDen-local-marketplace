const Product = require("../models/Product");
const Report = require("../models/Report");
const User = require("../models/User");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");

const ALLOWED_REASONS = new Set([
  "spam",
  "scam",
  "prohibited",
  "harassment",
  "fake",
  "other",
]);

const normalizeReason = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const normalizeDetails = (value) => String(value || "").trim();

const parseReportInput = (req) => ({
  reason: normalizeReason(req.body?.reason),
  details: normalizeDetails(req.body?.details),
});

const validateReportInput = ({ reason, details }) => {
  if (!ALLOWED_REASONS.has(reason)) {
    throw new ApiError(400, "Invalid report reason");
  }

  if (reason === "other" && !details) {
    throw new ApiError(400, "Details are required when reason is 'other'");
  }
};

const ensureNoOpenReport = async ({
  reporterId,
  targetType,
  targetIdField,
  targetId,
}) => {
  const existingOpenReport = await Report.findOne({
    reporter: reporterId,
    targetType,
    [targetIdField]: targetId,
    status: "open",
  });

  if (existingOpenReport) {
    throw new ApiError(
      409,
      targetType === "listing"
        ? "You already have an open report for this listing"
        : "You already have an open report for this user",
    );
  }
};

const populateListingReport = async (report) => {
  await report.populate([
    { path: "reporter", select: "name email phone" },
    { path: "targetUser", select: "name email phone" },
    { path: "targetListing", select: "title category status" },
  ]);
};

const populateUserReport = async (report) => {
  await report.populate([
    { path: "reporter", select: "name email phone" },
    { path: "targetUser", select: "name email phone" },
  ]);
};

const createListingReport = asyncHandler(async (req, res) => {
  const listingId = String(req.params.id || "").trim();
  const { reason, details } = parseReportInput(req);

  validateReportInput({ reason, details });

  const listing = await Product.findById(listingId).select("seller");
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }

  if (String(listing.seller) === String(req.user._id)) {
    throw new ApiError(400, "You cannot report your own listing");
  }

  await ensureNoOpenReport({
    reporterId: req.user._id,
    targetType: "listing",
    targetIdField: "targetListing",
    targetId: listing._id,
  });

  const report = await Report.create({
    reporter: req.user._id,
    targetType: "listing",
    targetListing: listing._id,
    targetUser: listing.seller,
    reason,
    details,
  });

  await populateListingReport(report);

  res.status(201).json({
    message: "Listing report submitted",
    report,
  });
});

const createUserReport = asyncHandler(async (req, res) => {
  const userId = String(req.params.id || "").trim();
  const { reason, details } = parseReportInput(req);

  validateReportInput({ reason, details });

  if (userId === String(req.user._id)) {
    throw new ApiError(400, "You cannot report yourself");
  }

  const targetUser = await User.findById(userId).select("role");
  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  if (targetUser.role === "admin") {
    throw new ApiError(400, "You cannot report an admin account");
  }

  await ensureNoOpenReport({
    reporterId: req.user._id,
    targetType: "user",
    targetIdField: "targetUser",
    targetId: targetUser._id,
  });

  const report = await Report.create({
    reporter: req.user._id,
    targetType: "user",
    targetUser: targetUser._id,
    reason,
    details,
  });

  await populateUserReport(report);

  res.status(201).json({
    message: "User report submitted",
    report,
  });
});

module.exports = {
  createListingReport,
  createUserReport,
};
