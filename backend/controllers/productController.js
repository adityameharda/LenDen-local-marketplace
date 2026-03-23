const Product = require("../models/Product");
const Message = require("../models/Message");
const User = require("../models/User");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const {
  uploadProductImages,
  deleteCloudinaryImages,
} = require("../utils/cloudinary");
const { resolveCoordinates } = require("../utils/geocode");
const { sendEmail } = require("../utils/mailer");
const {
  signListingReviewActionToken,
} = require("../utils/listingReviewActionToken");
const { buildListingReviewEmail } = require("../utils/listingReviewEmail");

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toFiniteNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildSort = (sort) => {
  switch (sort) {
    case "price-asc":
      return { price: 1, createdAt: -1 };
    case "price-desc":
      return { price: -1, createdAt: -1 };
    default:
      return { createdAt: -1 };
  }
};

const resolveId = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value._id || value.id || value);
};

const getServerBaseUrl = (req) => {
  const configuredBaseUrl =
    process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL;
  if (configuredBaseUrl) {
    return String(configuredBaseUrl).replace(/\/$/, "");
  }

  return `${req.protocol}://${req.get("host")}`;
};

const notifyAdminForListingReview = async ({ req, product }) => {
  const recipient =
    process.env.LISTING_REVIEW_EMAIL ||
    process.env.ADMIN_NOTIFY_EMAIL ||
    process.env.ADMIN_EMAIL;

  if (!recipient) {
    return;
  }

  const baseUrl = getServerBaseUrl(req);
  const listingId = String(product._id);
  const approveToken = signListingReviewActionToken({
    listingId,
    action: "approve",
  });
  const rejectToken = signListingReviewActionToken({
    listingId,
    action: "reject",
  });

  const approveUrl = `${baseUrl}/api/admin/listings/${listingId}/email-action/approve?token=${encodeURIComponent(
    approveToken,
  )}`;
  const rejectUrl = `${baseUrl}/api/admin/listings/${listingId}/email-action/reject?token=${encodeURIComponent(
    rejectToken,
  )}`;

  const { subject, html, text } = buildListingReviewEmail({
    listing: product,
    seller: req.user,
    approveUrl,
    rejectUrl,
  });

  await sendEmail({
    to: recipient,
    subject,
    html,
    text,
  });
};

const createProduct = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    category,
    price,
    condition,
    city,
    state,
    locationName,
    lat,
    lng,
  } = req.body;
  const parsedPrice = toFiniteNumber(price);
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  const normalizedDescription =
    typeof description === "string" ? description.trim() : "";
  const normalizedCategory =
    typeof category === "string" ? category.trim() : "";
  const normalizedCity = typeof city === "string" ? city.trim() : "";
  const normalizedState = typeof state === "string" ? state.trim() : "";
  const normalizedLocationName =
    typeof locationName === "string" ? locationName.trim() : "";

  if (
    !normalizedTitle ||
    !normalizedDescription ||
    !normalizedCategory ||
    parsedPrice === null ||
    !condition ||
    !normalizedCity ||
    !normalizedState
  ) {
    throw new ApiError(400, "Missing required fields");
  }

  if (parsedPrice < 0) {
    throw new ApiError(400, "Price must be zero or greater");
  }

  const uploadedImages = await uploadProductImages(req.files || []);
  const coordinates = await resolveCoordinates({
    city: normalizedCity,
    state: normalizedState,
    lat,
    lng,
    fallback: [0, 0],
  });

  let product;
  try {
    product = await Product.create({
      title: normalizedTitle,
      description: normalizedDescription,
      category: normalizedCategory,
      price: parsedPrice,
      condition,
      location: {
        city: normalizedCity,
        state: normalizedState,
        coordinates: {
          type: "Point",
          coordinates,
        },
      },
      locationName: normalizedLocationName,
      images: uploadedImages.urls,
      imagePublicIds: uploadedImages.publicIds,
      seller: req.user._id,
    });
  } catch (error) {
    await deleteCloudinaryImages(uploadedImages.publicIds);
    throw error;
  }

  try {
    await notifyAdminForListingReview({ req, product });
  } catch (error) {
    console.error("Failed to send listing review email:", error.message);
  }

  res.status(201).json(product);
});

const getProducts = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    minPrice,
    maxPrice,
    condition,
    city,
    state,
    locationName,
    sort,
    lat,
    lng,
    radius,
  } = req.query;

  const query = { isApproved: true, status: "Available" };
  const latNumber = toFiniteNumber(lat);
  const lngNumber = toFiniteNumber(lng);
  const radiusNumber = toFiniteNumber(radius);
  const minPriceNumber = toFiniteNumber(minPrice);
  const maxPriceNumber = toFiniteNumber(maxPrice);

  if (
    (lat !== undefined || lng !== undefined) &&
    (latNumber === null || lngNumber === null)
  ) {
    throw new ApiError(400, "Valid lat and lng are required together");
  }

  if (radius !== undefined && (radiusNumber === null || radiusNumber <= 0)) {
    throw new ApiError(400, "Radius must be a positive number");
  }

  if (radiusNumber !== null && (latNumber === null || lngNumber === null)) {
    throw new ApiError(400, "Radius requires valid lat and lng values");
  }

  if (minPrice !== undefined && minPrice !== "" && minPriceNumber === null) {
    throw new ApiError(400, "Minimum price must be a valid number");
  }

  if (maxPrice !== undefined && maxPrice !== "" && maxPriceNumber === null) {
    throw new ApiError(400, "Maximum price must be a valid number");
  }

  const andConditions = [];
  if (search) {
    const searchPattern = escapeRegex(search.trim());
    andConditions.push({
      $or: [
        { title: { $regex: searchPattern, $options: "i" } },
        { description: { $regex: searchPattern, $options: "i" } },
      ],
    });
  }

  if (locationName) {
    const locationPattern = escapeRegex(locationName.trim());
    andConditions.push({
      $or: [
        { locationName: { $regex: locationPattern, $options: "i" } },
        { "location.city": { $regex: locationPattern, $options: "i" } },
        { "location.state": { $regex: locationPattern, $options: "i" } },
      ],
    });
  }

  if (andConditions.length === 1) {
    Object.assign(query, andConditions[0]);
  } else if (andConditions.length > 1) {
    query.$and = andConditions;
  }

  if (category) query.category = category;
  if (condition) query.condition = condition;
  if (city) {
    query["location.city"] = {
      $regex: `^${escapeRegex(city.trim())}$`,
      $options: "i",
    };
  }
  if (state) {
    query["location.state"] = {
      $regex: `^${escapeRegex(state.trim())}$`,
      $options: "i",
    };
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPriceNumber !== null) query.price.$gte = minPriceNumber;
    if (maxPriceNumber !== null) query.price.$lte = maxPriceNumber;
  }

  const hasGeoSearch = latNumber !== null && lngNumber !== null;
  if (hasGeoSearch) {
    query["location.coordinates"] = {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [lngNumber, latNumber],
        },
        ...(radiusNumber ? { $maxDistance: radiusNumber * 1000 } : {}),
      },
    };
  }

  const productsQuery = Product.find(query).populate("seller", "name phone");
  if (!hasGeoSearch) {
    productsQuery.sort(buildSort(sort));
  }

  const products = await productsQuery;

  res.json(products);
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate(
    "seller",
    "name phone",
  );
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  const canSeeBuyer =
    req.user?.role === "admin" ||
    resolveId(product.seller) === resolveId(req.user) ||
    resolveId(product.buyer) === resolveId(req.user);

  if (canSeeBuyer && product.buyer) {
    await product.populate("buyer", "name phone");
  } else {
    product.buyer = undefined;
  }

  if (
    !product.isApproved &&
    req.user?.role !== "admin" &&
    resolveId(product.seller) !== resolveId(req.user) &&
    resolveId(product.buyer) !== resolveId(req.user)
  ) {
    throw new ApiError(403, "Listing not approved yet");
  }

  res.json(product);
});

const getBuyerCandidates = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).select("seller title");
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (
    String(product.seller) !== String(req.user._id) &&
    req.user.role !== "admin"
  ) {
    throw new ApiError(403, "Not authorized");
  }

  const messages = await Message.find({
    product: product._id,
    $or: [{ sender: product.seller }, { recipient: product.seller }],
  })
    .populate("sender", "name phone isBlocked")
    .populate("recipient", "name phone isBlocked")
    .sort({ createdAt: -1 });

  const candidates = new Map();

  messages.forEach((message) => {
    const senderId = resolveId(message.sender);
    const recipientId = resolveId(message.recipient);
    let participant = null;

    if (
      senderId === String(product.seller) &&
      recipientId !== String(product.seller)
    ) {
      participant = message.recipient;
    } else if (
      recipientId === String(product.seller) &&
      senderId !== String(product.seller)
    ) {
      participant = message.sender;
    }

    if (!participant || participant.isBlocked) {
      return;
    }

    const participantId = resolveId(participant);
    if (!participantId || candidates.has(participantId)) {
      return;
    }

    candidates.set(participantId, {
      _id: participantId,
      name: participant.name,
      phone: participant.phone,
      lastMessageAt: message.createdAt,
    });
  });

  res.json(Array.from(candidates.values()));
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (
    product.seller.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    throw new ApiError(403, "Not authorized");
  }

  const updates = ["title", "description", "category", "price", "condition"];
  updates.forEach((field) => {
    if (hasOwn(req.body, field)) {
      if (field === "price") {
        const parsedPrice = toFiniteNumber(req.body.price);
        if (parsedPrice === null || parsedPrice < 0) {
          throw new ApiError(400, "Price must be zero or greater");
        }
        product.price = parsedPrice;
        return;
      }

      const nextValue =
        typeof req.body[field] === "string"
          ? req.body[field].trim()
          : req.body[field];
      product[field] = nextValue;
    }
  });

  if (
    hasOwn(req.body, "city") ||
    hasOwn(req.body, "state") ||
    hasOwn(req.body, "lat") ||
    hasOwn(req.body, "lng")
  ) {
    const nextCity = req.body.city || product.location?.city;
    const nextState = req.body.state || product.location?.state;
    const currentCoordinates = Array.isArray(
      product.location?.coordinates?.coordinates,
    )
      ? product.location.coordinates.coordinates
      : [0, 0];
    const resolvedCoordinates = await resolveCoordinates({
      city: nextCity,
      state: nextState,
      lat: req.body.lat,
      lng: req.body.lng,
      fallback: currentCoordinates,
    });

    product.location = {
      city: nextCity,
      state: nextState,
      coordinates: {
        type: "Point",
        coordinates: resolvedCoordinates,
      },
    };
  }

  if (req.body.locationName !== undefined) {
    product.locationName =
      typeof req.body.locationName === "string"
        ? req.body.locationName.trim()
        : req.body.locationName;
  }

  const previousImages = Array.isArray(product.images)
    ? [...product.images]
    : [];
  const previousPublicIds = Array.isArray(product.imagePublicIds)
    ? [...product.imagePublicIds]
    : [];

  let keptPublicIds = [...previousPublicIds];
  let keptImages = [...previousImages];

  if (hasOwn(req.body, "keepImagePublicIds")) {
    let parsed = req.body.keepImagePublicIds;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch (error) {
        throw new ApiError(400, "Invalid keepImagePublicIds payload");
      }
    }

    if (!Array.isArray(parsed)) {
      throw new ApiError(400, "keepImagePublicIds must be an array");
    }

    const normalizedKeepOrder = parsed.filter(Boolean).map(String);
    const keepSet = new Set(normalizedKeepOrder);
    const nextPublicIds = [];
    const nextImages = [];

    const previousByPublicId = new Map();
    previousPublicIds.forEach((publicId, index) => {
      previousByPublicId.set(String(publicId), {
        publicId,
        image: previousImages[index],
      });
    });

    normalizedKeepOrder.forEach((publicId) => {
      const existing = previousByPublicId.get(publicId);
      if (!existing) {
        return;
      }
      nextPublicIds.push(existing.publicId);
      nextImages.push(existing.image);
    });

    if (nextPublicIds.length !== keepSet.size) {
      throw new ApiError(400, "Some kept images are invalid for this listing");
    }

    keptPublicIds = nextPublicIds;
    keptImages = nextImages;
  }

  let uploadedImages = null;
  if (req.files?.length) {
    uploadedImages = await uploadProductImages(req.files);
  }

  const nextImages = [...keptImages, ...(uploadedImages?.urls || [])];
  const nextPublicIds = [
    ...keptPublicIds,
    ...(uploadedImages?.publicIds || []),
  ];

  if (nextPublicIds.length > 6) {
    if (uploadedImages?.publicIds?.length) {
      await deleteCloudinaryImages(uploadedImages.publicIds);
    }
    throw new ApiError(400, "A listing can have at most 6 images");
  }

  product.images = nextImages;
  product.imagePublicIds = nextPublicIds;

  try {
    await product.save();
  } catch (error) {
    if (uploadedImages) {
      await deleteCloudinaryImages(uploadedImages.publicIds);
    }
    throw error;
  }

  const nextPublicIdSet = new Set(nextPublicIds.map(String));
  const removedPublicIds = previousPublicIds.filter(
    (publicId) => !nextPublicIdSet.has(String(publicId)),
  );

  if (removedPublicIds.length) {
    await deleteCloudinaryImages(removedPublicIds);
  }

  res.json(product);
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (
    product.seller.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    throw new ApiError(403, "Not authorized");
  }

  const imagePublicIds = Array.isArray(product.imagePublicIds)
    ? [...product.imagePublicIds]
    : [];
  await product.deleteOne();
  await deleteCloudinaryImages(imagePublicIds);
  res.json({ message: "Listing removed" });
});

const markSold = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (
    product.seller.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    throw new ApiError(403, "Not authorized");
  }

  const rawBuyerId = req.body?.buyerId;
  const buyerId =
    rawBuyerId === undefined || rawBuyerId === null || rawBuyerId === ""
      ? null
      : String(rawBuyerId);

  let buyer = null;
  if (buyerId) {
    buyer = await User.findById(buyerId).select("name phone isBlocked");
    if (!buyer) {
      throw new ApiError(404, "Buyer not found");
    }

    if (buyer.isBlocked) {
      throw new ApiError(403, "Buyer is unavailable");
    }

    if (String(buyer._id) === String(product.seller)) {
      throw new ApiError(400, "Seller cannot be the buyer");
    }

    const hasConversation = await Message.exists({
      product: product._id,
      $or: [
        { sender: product.seller, recipient: buyer._id },
        { sender: buyer._id, recipient: product.seller },
      ],
    });

    if (!hasConversation) {
      throw new ApiError(
        400,
        "Buyer must message about this listing before being assigned",
      );
    }
  }

  product.status = "Sold";
  product.buyer = buyer ? buyer._id : null;
  product.soldAt = product.soldAt || new Date();
  await product.save();
  await product.populate([
    { path: "seller", select: "name phone" },
    { path: "buyer", select: "name phone" },
  ]);

  const message = buyer
    ? `Listing marked as sold to ${buyer.name}.`
    : "Listing marked as sold.";

  res.json({ message, product });
});

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  getBuyerCandidates,
  updateProduct,
  deleteProduct,
  markSold,
};
