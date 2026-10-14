const isProduction = process.env.NODE_ENV === "production";

const jwtSecret = process.env.JWT_SECRET;
if (isProduction && !jwtSecret) {
  throw new Error("JWT_SECRET must be set when NODE_ENV=production");
}
if (!jwtSecret) {
  console.warn("[config] JWT_SECRET not set - using an insecure development default");
}

export const PORT = Number(process.env.PORT) || 3000;
export const JWT_SECRET = jwtSecret || "dev-only-insecure-secret";
export const JWT_EXPIRES_IN = "7d";
export const DB_PATH = process.env.DB_PATH || "data/notes.db";
export const BCRYPT_ROUNDS = 10;
