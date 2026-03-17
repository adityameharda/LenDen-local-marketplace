const {
  cloudinary,
  isCloudinaryConfigured,
  configureCloudinary,
} = require("../config/cloudinary");
const ApiError = require("./apiError");

const ensureCloudinary = () => {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(
      500,
      "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }
};

const toDataUri = (file) => {
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
};

const uploadProductImages = async (files = []) => {
  if (!files.length) {
    return { urls: [], publicIds: [] };
  }

  ensureCloudinary();
  configureCloudinary();

  const uploads = await Promise.all(
    files.map((file) =>
      cloudinary.uploader.upload(toDataUri(file), {
        folder: "lenideni/products",
        resource_type: "image",
      }),
    ),
  );

  return {
    urls: uploads.map((upload) => upload.secure_url),
    publicIds: uploads.map((upload) => upload.public_id),
  };
};

const deleteCloudinaryImages = async (publicIds = []) => {
  if (!publicIds.length || !isCloudinaryConfigured()) {
    return;
  }

  await Promise.all(
    publicIds
      .filter(Boolean)
      .map((publicId) =>
        cloudinary.uploader
          .destroy(publicId, { resource_type: "image" })
          .catch(() => null),
      ),
  );
};

module.exports = { uploadProductImages, deleteCloudinaryImages };
