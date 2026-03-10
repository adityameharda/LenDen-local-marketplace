const User = require("../models/User");
const Product = require("../models/Product");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const { resolveCoordinates } = require("../utils/geocode");

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

const updateMe = asyncHandler(async (req, res) => {
  const { name, phone, city, state, lat, lng } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (name) user.name = name;
  if (phone) user.phone = phone;

  if (
    hasOwn(req.body, "city") ||
    hasOwn(req.body, "state") ||
    hasOwn(req.body, "lat") ||
    hasOwn(req.body, "lng")
  ) {
    const nextCity = city || user.location?.city;
    const nextState = state || user.location?.state;
    const currentCoordinates = Array.isArray(
      user.location?.coordinates?.coordinates,
    )
      ? user.location.coordinates.coordinates
      : [0, 0];
    const resolvedCoordinates = await resolveCoordinates({
      city: nextCity,
      state: nextState,
      lat,
      lng,
      fallback: currentCoordinates,
    });

    user.location = {
      city: nextCity,
      state: nextState,
      coordinates: {
        type: "Point",
        coordinates: resolvedCoordinates,
      },
    };
  }

  await user.save();
  res.json({ message: "Profile updated" });
});

const getMyListings = asyncHandler(async (req, res) => {
  const listings = await Product.find({
    seller: req.user._id,
    status: "Available",
  }).sort({
    createdAt: -1,
  });
  res.json(listings);
});

module.exports = { getMe, updateMe, getMyListings };
