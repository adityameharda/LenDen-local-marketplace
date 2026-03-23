const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatCurrency = (value) => {
  const amount = Number(value) || 0;
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)}`;
};

const buildListingReviewEmail = ({
  listing,
  seller,
  approveUrl,
  rejectUrl,
}) => {
  const locationText = [listing?.location?.city, listing?.location?.state]
    .filter(Boolean)
    .join(", ");

  const safeTitle = escapeHtml(listing?.title || "Untitled listing");
  const safeDescription = escapeHtml(listing?.description || "");
  const safeCategory = escapeHtml(listing?.category || "");
  const safeCondition = escapeHtml(listing?.condition || "");
  const safeLocation = escapeHtml(
    locationText || listing?.locationName || "N/A",
  );
  const safeSellerName = escapeHtml(seller?.name || "Unknown seller");
  const safeSellerEmail = escapeHtml(seller?.email || "N/A");
  const safeSellerPhone = escapeHtml(seller?.phone || "N/A");

  const subject = `New listing pending review: ${listing?.title || "Untitled"}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #1a1c1b; line-height: 1.55;">
      <h2 style="margin: 0 0 12px;">New Listing Pending Review</h2>
      <p style="margin: 0 0 18px; color: #3e4949;">
        A user has created a new listing. Review the details and take action below.
      </p>

      <div style="border: 1px solid #bdc9c8; border-radius: 12px; padding: 14px 16px; margin-bottom: 18px; background: #f9f9f7;">
        <p style="margin: 0 0 6px;"><strong>Title:</strong> ${safeTitle}</p>
        <p style="margin: 0 0 6px;"><strong>Description:</strong> ${safeDescription}</p>
        <p style="margin: 0 0 6px;"><strong>Category:</strong> ${safeCategory}</p>
        <p style="margin: 0 0 6px;"><strong>Price:</strong> ${formatCurrency(listing?.price)}</p>
        <p style="margin: 0 0 6px;"><strong>Condition:</strong> ${safeCondition}</p>
        <p style="margin: 0;"><strong>Location:</strong> ${safeLocation}</p>
      </div>

      <div style="border: 1px solid #bdc9c8; border-radius: 12px; padding: 14px 16px; margin-bottom: 18px; background: #ffffff;">
        <p style="margin: 0 0 6px;"><strong>Seller:</strong> ${safeSellerName}</p>
        <p style="margin: 0 0 6px;"><strong>Email:</strong> ${safeSellerEmail}</p>
        <p style="margin: 0;"><strong>Phone:</strong> ${safeSellerPhone}</p>
      </div>

      <div style="display: flex; gap: 12px; margin: 8px 0 16px;">
        <a href="${approveUrl}" style="display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 700;">
          Approve Listing
        </a>
        <a href="${rejectUrl}" style="display: inline-block; background: #b91c1c; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 700;">
          Reject Listing
        </a>
      </div>

      <p style="margin: 0; color: #6e7979; font-size: 12px;">
        If buttons are not clickable, copy and open these URLs manually:
      </p>
      <p style="margin: 6px 0 0; font-size: 12px;"><a href="${approveUrl}">${approveUrl}</a></p>
      <p style="margin: 4px 0 0; font-size: 12px;"><a href="${rejectUrl}">${rejectUrl}</a></p>
    </div>
  `;

  const text = [
    "New Listing Pending Review",
    "",
    `Title: ${listing?.title || "Untitled listing"}`,
    `Description: ${listing?.description || ""}`,
    `Category: ${listing?.category || ""}`,
    `Price: ${formatCurrency(listing?.price)}`,
    `Condition: ${listing?.condition || ""}`,
    `Location: ${locationText || listing?.locationName || "N/A"}`,
    "",
    `Seller: ${seller?.name || "Unknown seller"}`,
    `Seller Email: ${seller?.email || "N/A"}`,
    `Seller Phone: ${seller?.phone || "N/A"}`,
    "",
    `Approve: ${approveUrl}`,
    `Reject: ${rejectUrl}`,
  ].join("\n");

  return { subject, html, text };
};

module.exports = {
  buildListingReviewEmail,
};
