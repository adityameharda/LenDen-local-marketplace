const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const { resolveCoordinates } = require("../utils/geocode");

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const buildIdentityQuery = (email, phone) => {
  const identities = [];
  if (email) {
    identities.push({ email });
  }
  if (phone) {
    identities.push({ phone });
  }
  return identities.length ? { $or: identities } : null;
};

const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, city, state, lat, lng } = req.body;

  if (!email && !phone) {
    throw new ApiError(400, "Email or phone is required");
  }

  const identityQuery = buildIdentityQuery(email, phone);
  const existing = identityQuery ? await User.findOne(identityQuery) : null;

  if (existing) {
    throw new ApiError(409, "User already exists");
  }

  const coordinates =
    city && state
      ? await resolveCoordinates({
          city,
          state,
          lat,
          lng,
          fallback: [0, 0],
        })
      : null;

  const location =
    city && state
      ? {
          city,
          state,
          coordinates: {
            type: "Point",
            coordinates,
          },
        }
      : undefined;

  const user = await User.create({ name, email, phone, password, location });

  const token = signToken(user);
  res.status(201).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  });
});

module.exports = { register, login };
