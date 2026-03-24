const express = require("express");
const {
  requestRegisterOtp,
  verifyRegisterOtpAndRegister,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  login,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register/request-otp", requestRegisterOtp);
router.post("/register/verify-otp", verifyRegisterOtpAndRegister);
router.post("/password/request-otp", requestPasswordResetOtp);
router.post("/password/reset", resetPasswordWithOtp);
router.post("/login", login);

module.exports = router;
