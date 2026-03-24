const express = require("express");
const {
  getUsers,
  blockUser,
  unblockUser,
  listListings,
  approveListing,
  rejectListing,
  reviewListingByEmailAction,
  removeListing,
  listReports,
  reviewReport,
  getStats,
} = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/listings/:id/email-action/:action", reviewListingByEmailAction);

router.use(protect, requireRole("admin"));

router.get("/users", getUsers);
router.patch("/users/:id/block", blockUser);
router.patch("/users/:id/unblock", unblockUser);
router.get("/listings", listListings);
router.patch("/listings/:id/approve", approveListing);
router.patch("/listings/:id/reject", rejectListing);
router.delete("/listings/:id", removeListing);
router.get("/reports", listReports);
router.patch("/reports/:id", reviewReport);
router.get("/stats", getStats);

module.exports = router;
