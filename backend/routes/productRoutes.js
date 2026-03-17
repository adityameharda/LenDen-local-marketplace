const express = require("express");
const {
  createProduct,
  getProducts,
  getProductById,
  getBuyerCandidates,
  updateProduct,
  deleteProduct,
  markSold,
} = require("../controllers/productController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

const router = express.Router();

router.get("/", getProducts);
router.get("/:id/buyer-candidates", protect, getBuyerCandidates);
router.get("/:id", getProductById);
router.post("/", protect, upload.array("images", 6), createProduct);
router.patch("/:id", protect, upload.array("images", 6), updateProduct);
router.delete("/:id", protect, deleteProduct);
router.patch("/:id/sold", protect, markSold);

module.exports = router;
