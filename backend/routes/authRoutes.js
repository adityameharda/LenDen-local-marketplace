const express = require("express");
const {
  requestRegisterOtp,
  verifyRegisterOtpAndRegister,
  login,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register/request-otp", requestRegisterOtp);
router.post("/register/verify-otp", verifyRegisterOtpAndRegister);
router.post("/login", login);

module.exports = router;
