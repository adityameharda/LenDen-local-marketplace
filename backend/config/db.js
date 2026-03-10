const mongoose = require("mongoose");

const connectDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });

  console.log("MongoDB connected");
};

module.exports = connectDb;
