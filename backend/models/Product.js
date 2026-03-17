const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  city: { type: String, trim: true, required: true },
  state: { type: String, trim: true, required: true },
  coordinates: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: { type: [Number], required: true },
  },
});

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    condition: { type: String, enum: ["New", "Used"], required: true },
    location: locationSchema,
    locationName: { type: String, trim: true },
    images: [{ type: String }],
    imagePublicIds: [{ type: String }],
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: { type: String, enum: ["Available", "Sold"], default: "Available" },
    soldAt: { type: Date, default: null },
    isApproved: { type: Boolean, default: false },
  },
  { timestamps: true },
);

productSchema.index({ "location.coordinates": "2dsphere" });
productSchema.index({ buyer: 1, soldAt: -1 });

module.exports = mongoose.model("Product", productSchema);
