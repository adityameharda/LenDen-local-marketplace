const dns = require("dns");
const mongoose = require("mongoose");

const connectDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  dns.setServers(["8.8.8.8", "1.1.1.1"]);

  await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });

  console.log("MongoDB connected");
};

module.exports = connectDb;
