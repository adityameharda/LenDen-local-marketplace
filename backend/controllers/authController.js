const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const { resolveCoordinates } = require("../utils/geocode");

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizePhone = (value) =>
  typeof value === "string" ? value.trim() : "";

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const buildIdentityQuery = (email, phone) => {
  const identities = [];
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (normalizedEmail) {
    identities.push({ email: normalizedEmail });
  }
  if (normalizedPhone) {
    identities.push({ phone: normalizedPhone });
  }
  return identities.length ? { $or: identities } : null;
};

const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, city, state, lat, lng } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail && !normalizedPhone) {
    throw new ApiError(400, "Email or phone is required");
  }

  const identityQuery = buildIdentityQuery(normalizedEmail, normalizedPhone);
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

  const user = await User.create({
    name,
    email: normalizedEmail || undefined,
    phone: normalizedPhone || undefined,
    password,
    location,
  });

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
  const { password } = req.body;
  const identifier = normalizePhone(
    req.body.identifier || req.body.email || req.body.phone,
  );

  if (!identifier || !password) {
    throw new ApiError(400, "Email or phone and password are required");
  }

  const user = await User.findOne(
    buildIdentityQuery(normalizeEmail(identifier), identifier),
  );
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (user.isBlocked) {
    throw new ApiError(403, "User is blocked");
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
