const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["listing", "user"],
      required: true,
      index: true,
    },
    targetListing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reason: {
      type: String,
      enum: ["spam", "scam", "prohibited", "harassment", "fake", "other"],
      required: true,
    },
    details: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    status: {
      type: String,
      enum: ["open", "resolved", "dismissed"],
      default: "open",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    enforcementAction: {
      type: String,
      enum: [
        "none",
        "block-user",
        "remove-listing",
        "remove-listing-and-block-user",
      ],
      default: "none",
    },
    enforcementSummary: {
      type: String,
      trim: true,
      default: "",
    },
    enforcementAppliedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index(
  { reporter: 1, targetListing: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      targetType: "listing",
      targetListing: { $exists: true, $ne: null },
      status: "open",
    },
  },
);
reportSchema.index(
  { reporter: 1, targetUser: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      targetType: "user",
      targetUser: { $exists: true, $ne: null },
      status: "open",
    },
  },
);

module.exports = mongoose.model("Report", reportSchema);
