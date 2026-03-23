const jwt = require("jsonwebtoken");

const getListingReviewSecret = () =>
  process.env.LISTING_REVIEW_TOKEN_SECRET || process.env.JWT_SECRET;

const getListingReviewExpiry = () =>
  process.env.LISTING_REVIEW_TOKEN_EXPIRES_IN || "3d";

const signListingReviewActionToken = ({ listingId, action }) => {
  return jwt.sign(
    {
      type: "listing-review-action",
      listingId: String(listingId),
      action,
    },
    getListingReviewSecret(),
    {
      expiresIn: getListingReviewExpiry(),
    },
  );
};

const verifyListingReviewActionToken = (token) => {
  const payload = jwt.verify(token, getListingReviewSecret());

  if (payload?.type !== "listing-review-action") {
    throw new Error("Invalid review action token");
  }

  return payload;
};

module.exports = {
  signListingReviewActionToken,
  verifyListingReviewActionToken,
};
