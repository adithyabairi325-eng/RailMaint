import mongoose from "mongoose";

let isConnecting = false;

export async function connectDB(customUri) {
  if (process.env.NODE_ENV === "test" && process.env.IS_INTEGRATION_TEST !== "true") {
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 2) {
    return new Promise((resolve, reject) => {
      mongoose.connection.once("connected", () => resolve(mongoose.connection));
      mongoose.connection.once("error", (err) => reject(err));
    });
  }

  const isIntegrationTest = process.env.IS_INTEGRATION_TEST === "true";
  const mongoUri = customUri || (isIntegrationTest ? process.env.MONGODB_TEST_URI : process.env.MONGODB_URI);

  if (!mongoUri || typeof mongoUri !== "string" || !mongoUri.trim()) {
    if (isIntegrationTest) {
      throw new Error(
        "MONGODB_TEST_URI is missing. Please set MONGODB_TEST_URI to a dedicated test database (never production)."
      );
    }
    throw new Error(
      "MONGODB_URI is missing. Please set MONGODB_URI in backend/.env with your MongoDB Atlas connection string (e.g. MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/railmaint?retryWrites=true&w=majority)."
    );
  }

  const trimmedUri = mongoUri.trim();

  // Strict safety guard: Never allow integration tests to run against production database
  if (isIntegrationTest) {
    if (process.env.MONGODB_URI && trimmedUri === process.env.MONGODB_URI.trim()) {
      throw new Error(
        "CRITICAL SAFETY GUARD: MONGODB_TEST_URI matches production MONGODB_URI. Integration tests cannot run against production database!"
      );
    }
    // Must contain 'test' in the database name or path
    const parsedPath = trimmedUri.split("?")[0];
    if (!parsedPath.toLowerCase().includes("test")) {
      throw new Error(
        "CRITICAL SAFETY GUARD: MONGODB_TEST_URI database name must include 'test' (e.g. railmaint_test) to prevent accidental non-test database operations."
      );
    }
  } else {
    // Guard against local fallback - user explicitly requires MongoDB Atlas in normal operation
    if (trimmedUri.includes("127.0.0.1") || trimmedUri.includes("localhost")) {
      throw new Error(
        "Local MongoDB URI detected. RailMaint requires a MongoDB Atlas connection string. Please configure your Atlas URI in backend/.env."
      );
    }

    // Guard against unreplaced template placeholder
    if (trimmedUri.includes("<cluster-url>") || trimmedUri.includes("<password>")) {
      throw new Error(
        "Incomplete MONGODB_URI in backend/.env: Please replace '<cluster-url>' with your actual MongoDB Atlas cluster address (e.g., cluster0.xxxxx.mongodb.net)."
      );
    }
  }

  isConnecting = true;
  try {
    await mongoose.connect(trimmedUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnecting = false;
    console.log("[MongoDB Atlas] Successfully connected to database.");
    return mongoose.connection;
  } catch (error) {
    isConnecting = false;
    console.error("[MongoDB Atlas] Connection failed:", error.message);
    throw error;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
