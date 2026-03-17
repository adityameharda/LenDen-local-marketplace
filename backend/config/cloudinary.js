const { v2: cloudinary } = require("cloudinary");

const getCloudinaryUrl = () => {
  return (
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUD_STORAGE_KEYS?.startsWith("cloudinary://")
      ? process.env.CLOUD_STORAGE_KEYS
      : "")
  );
};

const hasExplicitCredentials = () => {
  return (
    Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
    Boolean(process.env.CLOUDINARY_API_KEY) &&
    Boolean(process.env.CLOUDINARY_API_SECRET)
  );
};

const configureCloudinary = () => {
  const cloudinaryUrl = getCloudinaryUrl();

  if (cloudinaryUrl) {
    cloudinary.config({
      cloudinary_url: cloudinaryUrl,
      secure: true,
    });
    return true;
  }

  if (hasExplicitCredentials()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    return true;
  }

  return false;
};

const isCloudinaryConfigured = () => {
  return configureCloudinary();
};

module.exports = { cloudinary, isCloudinaryConfigured, configureCloudinary };
