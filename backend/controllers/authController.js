const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const EmailOtp = require("../models/EmailOtp");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const { resolveCoordinates } = require("../utils/geocode");
const { sendEmail } = require("../utils/mailer");

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizePhone = (value) =>
  typeof value === "string" ? value.trim() : "";

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const OTP_PURPOSE = "register";
const OTP_TTL_MINUTES = Number(process.env.REGISTER_OTP_TTL_MINUTES || 10);
const OTP_MAX_ATTEMPTS = Number(process.env.REGISTER_OTP_MAX_ATTEMPTS || 5);

const generateSixDigitOtp = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const ensureUniqueIdentity = async ({ email, phone }) => {
  const identityQuery = buildIdentityQuery(email, phone);
  const existing = identityQuery ? await User.findOne(identityQuery) : null;

  if (existing) {
    throw new ApiError(409, "User already exists");
  }
};

const buildRegistrationOtpEmail = ({ otp }) => {
  const subject = "Verify your email - LeniDeni";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
      <h2 style="margin:0 0 12px">Email verification code</h2>
      <p style="margin:0 0 14px">Use this OTP to complete your LeniDeni registration:</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:4px;margin:0 0 14px">${otp}</div>
      <p style="margin:0 0 8px">This code expires in ${OTP_TTL_MINUTES} minutes.</p>
      <p style="margin:0">If you did not request this, you can ignore this email.</p>
    </div>
  `;
  const text = `Your LeniDeni verification OTP is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`;
  return { subject, html, text };
};

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

const requestRegisterOtp = asyncHandler(async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body.email);

  if (!normalizedEmail) {
    throw new ApiError(400, "Email is required");
  }

  await ensureUniqueIdentity({ email: normalizedEmail, phone: "" });

  const otp = generateSixDigitOtp();
  const codeHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await EmailOtp.findOneAndUpdate(
    { email: normalizedEmail, purpose: OTP_PURPOSE },
    {
      $set: {
        codeHash,
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const { subject, html, text } = buildRegistrationOtpEmail({ otp });
  const result = await sendEmail({
    to: normalizedEmail,
    subject,
    html,
    text,
  });

  if (!result?.sent) {
    throw new ApiError(500, result?.reason || "Failed to send OTP email");
  }

  res.json({
    message: "OTP sent to your email",
    expiresInMinutes: OTP_TTL_MINUTES,
  });
});

const verifyRegisterOtpAndRegister = asyncHandler(async (req, res) => {
  const { name, email, phone, password, city, state, lat, lng, otp } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail) {
    throw new ApiError(400, "Email is required");
  }

  if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
    throw new ApiError(400, "Valid 6-digit OTP is required");
  }

  const otpDoc = await EmailOtp.findOne({
    email: normalizedEmail,
    purpose: OTP_PURPOSE,
  });

  if (!otpDoc || otpDoc.expiresAt.getTime() < Date.now()) {
    throw new ApiError(
      400,
      "OTP expired or not found. Please request a new OTP",
    );
  }

  if ((otpDoc.attempts || 0) >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many invalid OTP attempts. Request a new OTP");
  }

  const isOtpMatch = await bcrypt.compare(String(otp).trim(), otpDoc.codeHash);
  if (!isOtpMatch) {
    otpDoc.attempts = (otpDoc.attempts || 0) + 1;
    await otpDoc.save();
    throw new ApiError(400, "Invalid OTP");
  }

  if (!name || !password) {
    throw new ApiError(400, "Name and password are required");
  }

  await ensureUniqueIdentity({
    email: normalizedEmail,
    phone: normalizedPhone,
  });

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

  await EmailOtp.deleteOne({ _id: otpDoc._id });

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

module.exports = { requestRegisterOtp, verifyRegisterOtpAndRegister, login };
