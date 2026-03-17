const express = require("express");
const {
  getMe,
  updateMe,
  getMyListings,
  getMyPurchases,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.get("/me/listings", protect, getMyListings);
router.get("/me/purchases", protect, getMyPurchases);

module.exports = router;
