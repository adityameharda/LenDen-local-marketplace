const express = require("express");
const {
  createListingReport,
  createUserReport,
} = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/listings/:id", createListingReport);
router.post("/users/:id", createUserReport);

module.exports = router;
