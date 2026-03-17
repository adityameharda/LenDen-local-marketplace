const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Product = require("./models/Product");
const User = require("./models/User");
const connectDb = require("./config/db");

dotenv.config();

const sampleProducts = [
  {
    title: "Smartphone Pro Max",
    description:
      "Latest model smartphone with 5G, 256GB storage, excellent condition",
    category: "Electronics",
    price: 799,
    condition: "New",
    images: [],
    isApproved: true,
    location: {
      city: "San Francisco",
      state: "CA",
      coordinates: {
        type: "Point",
        coordinates: [-122.4194, 37.7749],
      },
    },
  },
  {
    title: "Designer Office Chair",
    description: "Ergonomic office chair, mint condition, adjustable height",
    category: "Furniture",
    price: 180,
    condition: "Used",
    images: [],
    isApproved: true,
    location: {
      city: "New York",
      state: "NY",
      coordinates: {
        type: "Point",
        coordinates: [-74.006, 40.7128],
      },
    },
  },
  {
    title: "Gaming Console 2.0",
    description: "Latest gaming console with 2 controllers, games included",
    category: "Electronics",
    price: 420,
    condition: "New",
    images: [],
    isApproved: true,
    location: {
      city: "Los Angeles",
      state: "CA",
      coordinates: {
        type: "Point",
        coordinates: [-118.2437, 34.0522],
      },
    },
  },
  {
    title: "Vintage Bicycle",
    description: "Classic bike from the 1970s, restored and working great",
    category: "Sports",
    price: 150,
    condition: "Used",
    images: [],
    isApproved: true,
    location: {
      city: "Portland",
      state: "OR",
      coordinates: {
        type: "Point",
        coordinates: [-122.6762, 45.5152],
      },
    },
  },
  {
    title: "MacBook Pro 14 inch",
    description: "2022 model, M1 Pro chip, 16GB RAM, 512GB SSD, like new",
    category: "Electronics",
    price: 1200,
    condition: "Used",
    images: [],
    isApproved: true,
    location: {
      city: "Seattle",
      state: "WA",
      coordinates: {
        type: "Point",
        coordinates: [-122.3321, 47.6062],
      },
    },
  },
  {
    title: "Yoga Mat and Blocks Set",
    description:
      "Non-slip yoga mat (6mm) with 2 yoga blocks, perfect for beginners",
    category: "Sports",
    price: 35,
    condition: "New",
    images: [],
    isApproved: true,
    location: {
      city: "Boston",
      state: "MA",
      coordinates: {
        type: "Point",
        coordinates: [-71.0589, 42.3601],
      },
    },
  },
];

const seedDatabase = async () => {
  try {
    console.log("Connecting to database...");
    await connectDb();
    console.log("Connected to database");

    console.log("Finding or creating demo seller...");
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
          coordinates: {
            type: "Point",
            coordinates: [-122.4194, 37.7749],
          },
        },
      });
      console.log("Created demo seller user");
    } else {
      console.log("Using existing seller user");
    }

    console.log("Clearing existing products...");
    await Product.deleteMany({});
    console.log("Cleared existing products");

    const productsToInsert = sampleProducts.map((product) => ({
      ...product,
      seller: seller._id,
    }));

    console.log("Adding sample products...");
    const createdProducts = await Product.insertMany(productsToInsert);
    console.log(
      `Successfully added ${createdProducts.length} sample products\n`,
    );

    console.log("Products added:");
    createdProducts.forEach((product) => {
      console.log(`  - ${product.title} - $${product.price}`);
    });

    console.log("\nDatabase seeding complete!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

seedDatabase();
