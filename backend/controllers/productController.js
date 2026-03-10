const Product = require("../models/Product");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const { resolveCoordinates } = require("../utils/geocode");

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const resolveId = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value._id || value.id || value);
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

  if (
    !title ||
    !description ||
    !category ||
    !price ||
    !condition ||
    !city ||
    !state
  ) {
    throw new ApiError(400, "Missing required fields");
  }

  const images = (req.files || []).map((file) => `/uploads/${file.filename}`);
  const coordinates = await resolveCoordinates({
    city,
    state,
    lat,
    lng,
    fallback: [0, 0],
  });

  const product = await Product.create({
    title,
    description,
    category,
    price,
    condition,
    location: {
      city,
      state,
      coordinates: {
        type: "Point",
        coordinates,
      },
    },
    locationName,
    images,
    seller: req.user._id,
  });

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
  } = req.query;

  const query = { isApproved: true, status: "Available" };

  const andConditions = [];
  if (search) {
    andConditions.push({
      $or: [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
    });
  }

  if (locationName) {
    andConditions.push({
      $or: [
        { locationName: { $regex: locationName, $options: "i" } },
        { "location.city": { $regex: locationName, $options: "i" } },
        { "location.state": { $regex: locationName, $options: "i" } },
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
  if (city) query["location.city"] = city;
  if (state) query["location.state"] = state;

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  const products = await Product.find(query)
    .populate("seller", "name phone")
    .sort({ createdAt: -1 });

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

  if (
    !product.isApproved &&
    req.user?.role !== "admin" &&
    resolveId(product.seller) !== resolveId(req.user)
  ) {
    throw new ApiError(403, "Listing not approved yet");
  }

  res.json(product);
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
      product[field] = req.body[field];
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
    product.locationName = req.body.locationName;
  }

  if (req.files?.length) {
    product.images = req.files.map((file) => `/uploads/${file.filename}`);
  }

  await product.save();
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

  await product.deleteOne();
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

  product.status = "Sold";
  await product.save();
  res.json({ message: "Listing marked as sold" });
});

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  markSold,
};
