const dotenv = require("dotenv");

dotenv.config();

const app = require("./app");
const connectDb = require("./config/db");
const ensureAdmin = require("./utils/ensureAdmin");

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDb();
  await ensureAdmin();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
