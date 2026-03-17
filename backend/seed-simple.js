const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Product = require("./models/Product");
const User = require("./models/User");
const connectDb = require("./config/db");

dotenv.config();

const sampleProducts = [
  {
    title: "iPhone 15 Pro Max",
    description:
      "Latest iPhone 15 Pro Max, 256GB, Space Black, mint condition, all accessories included",
    category: "Electronics",
    price: 999,
    condition: "New",
    images: [],
    location: {
      city: "San Francisco",
      state: "CA",
      coordinates: { type: "Point", coordinates: [-122.4194, 37.7749] },
    },
  },
  {
    title: "Standing Desk Converter",
    description:
      "Adjustable height standing desk converter, 32 inches wide, like new",
    category: "Furniture",
    price: 250,
    condition: "Used",
    images: [],
    location: {
      city: "New York",
      state: "NY",
      coordinates: { type: "Point", coordinates: [-74.006, 40.7128] },
    },
  },
  {
    title: "Sony WH-1000XM5 Headphones",
    description:
      "Premium noise-cancelling wireless headphones, 30 hour battery, perfect condition",
    category: "Electronics",
    price: 350,
    condition: "New",
    images: [],
    location: {
      city: "Los Angeles",
      state: "CA",
      coordinates: { type: "Point", coordinates: [-118.2437, 34.0522] },
    },
  },
  {
    title: "Mountain Bike - Trek X-Caliber",
    description:
      "29 inch mountain bike, 21 speed, great for trails, has some cosmetic wear",
    category: "Sports",
    price: 450,
    condition: "Used",
    images: [],
    location: {
      city: "Portland",
      state: "OR",
      coordinates: { type: "Point", coordinates: [-122.6762, 45.5152] },
    },
  },
  {
    title: "MacBook Pro 16-inch M3 Max",
    description:
      "2023 MacBook Pro, 16GB RAM, 512GB SSD, barely used, all original packaging",
    category: "Electronics",
    price: 1800,
    condition: "New",
    images: [],
    location: {
      city: "Seattle",
      state: "WA",
      coordinates: { type: "Point", coordinates: [-122.3321, 47.6062] },
    },
  },
  {
    title: "LEGO Star Wars Collection",
    description:
      "Complete LEGO Star Wars set collection - 8 sets, never opened, collectible",
    category: "Toys",
    price: 600,
    condition: "New",
    images: [],
    location: {
      city: "Boston",
      state: "MA",
      coordinates: { type: "Point", coordinates: [-71.0589, 42.3601] },
    },
  },
  {
    title: "Vintage Leather Sofa",
    description:
      "Brown leather sofa, 3-seater, Italian design, excellent condition, needs to go today",
    category: "Furniture",
    price: 800,
    condition: "Used",
    images: [],
    location: {
      city: "Chicago",
      state: "IL",
      coordinates: { type: "Point", coordinates: [-87.6298, 41.8781] },
    },
  },
  {
    title: "Canon EOS R6 Camera",
    description:
      "Professional mirrorless camera, 20MP, with 24-105mm lens, 2500 shutter count",
    category: "Electronics",
    price: 2200,
    condition: "Used",
    images: [],
    location: {
      city: "Miami",
      state: "FL",
      coordinates: { type: "Point", coordinates: [-80.1918, 25.7617] },
    },
  },
  {
    title: "Rolex Submariner",
    description:
      "2019 Rolex Submariner Date, Steel, complete with box and papers",
    category: "Jewelry",
    price: 8500,
    condition: "Used",
    images: [],
    location: {
      city: "Austin",
      state: "TX",
      coordinates: { type: "Point", coordinates: [-97.7431, 30.2672] },
    },
  },
  {
    title: "Baby Stroller - Premium Edition",
    description:
      "High-end baby stroller, multiple recline positions, excellent suspension, like new",
    category: "Baby",
    price: 400,
    condition: "New",
    images: [],
    location: {
      city: "Denver",
      state: "CO",
      coordinates: { type: "Point", coordinates: [-104.9903, 39.7392] },
    },
  },
  {
    title: "Fender Stratocaster Guitar",
    description:
      "American-made Fender Strat, 1998, excellent condition, includes case and amp",
    category: "Music",
    price: 1200,
    condition: "Used",
    images: [],
    location: {
      city: "Nashville",
      state: "TN",
      coordinates: { type: "Point", coordinates: [-86.7816, 36.1627] },
    },
  },
  {
    title: "Brand New Dyson V15 Vacuum",
    description:
      "Latest Dyson cordless vacuum, sealed in box, never used, laser detection",
    category: "Home",
    price: 650,
    condition: "New",
    images: [],
    location: {
      city: "Phoenix",
      state: "AZ",
      coordinates: { type: "Point", coordinates: [-112.0742, 33.4484] },
    },
  },
];

const seedDatabase = async () => {
  try {
    console.log("LeniDeni database seed script");
    console.log("Connecting to MongoDB...");
    await connectDb();
    console.log("Connected to MongoDB\n");

    console.log("Setting up demo seller...");
    let seller = await User.findOne({ email: "seller@demo.com" });

    if (!seller) {
      seller = await User.create({
        name: "Demo Seller",
        email: "seller@demo.com",
        phone: "5551234567",
        password: "DemoPassword123!",
        location: {
          city: "San Francisco",
          state: "CA",
          coordinates: { type: "Point", coordinates: [-122.4194, 37.7749] },
        },
      });
      console.log("Created new demo seller account (seller@demo.com)\n");
    } else {
      console.log(`Using existing seller: ${seller.email}\n`);
    }

    console.log("Clearing existing products...");
    const deleted = await Product.deleteMany({});
    console.log(`Deleted ${deleted.deletedCount} existing products\n`);

    const productsWithSeller = sampleProducts.map((product) => ({
      ...product,
      seller: seller._id,
      isApproved: true,
    }));

    console.log("Adding sample products...");
    const created = await Product.insertMany(productsWithSeller);
    console.log(`Successfully added ${created.length} products\n`);

    console.log("Products added:");
    console.log("-".repeat(70));
    created.forEach((product, index) => {
      console.log(`${index + 1}. ${product.title}`);
      console.log(
        `   Category: ${product.category} | Condition: ${product.condition} | Price: $${product.price}`,
      );
      console.log(
        `   Location: ${product.location.city}, ${product.location.state}`,
      );
      console.log("");
    });

    console.log("-".repeat(70));
    console.log("\nDatabase seeding completed successfully!");
    console.log("\nNext steps:");
    console.log("   1. Visit http://localhost:5000 to browse products");
    console.log("   2. Login to view dashboard and create more listings");
    console.log(
      "   3. Use filter form to search by category, price, and location\n",
    );

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("\nError during seeding:", error.message);
    console.error("\nTroubleshooting:");

    if (
      error.message.includes("ETIMEOUT") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("ECONNREFUSED")
    ) {
      console.error("   - MongoDB Atlas is unreachable");
      console.error("   - Check your internet connection");
      console.error(
        "   - Verify MongoDB cluster is running at: https://cloud.mongodb.com",
      );
      console.error("   - Check if IP is whitelisted in MongoDB Network Access");
    } else if (error.message.includes("auth")) {
      console.error("   - Authentication error with MongoDB");
      console.error("   - Verify username and password in MONGODB_URI");
    }

    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

seedDatabase();
