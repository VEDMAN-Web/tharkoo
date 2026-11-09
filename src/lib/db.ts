import mongoose from "mongoose";

const globalForMongo = globalThis as unknown as {
  mongoose:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
};

const cache = globalForMongo.mongoose ?? { conn: null, promise: null };
globalForMongo.mongoose = cache;

export function mongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local or run npm run dev (memory Mongo).",
    );
  }
  return uri;
}

export async function connectDb() {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose.connect(mongoUri(), { bufferCommands: false });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
