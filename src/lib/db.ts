import mongoose from "mongoose";

const globalForMongo = globalThis as unknown as {
  mongoose:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
};

const cache = globalForMongo.mongoose ?? { conn: null, promise: null };
globalForMongo.mongoose = cache;

export class MongoConfigError extends Error {
  constructor() {
    super(
      "MONGODB_URI is not set. Copy .env.example to .env.local or run npm run dev (memory Mongo).",
    );
    this.name = "MongoConfigError";
  }
}

export function mongoUri() {
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new MongoConfigError();
  return uri;
}

export async function connectDb() {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    const uri = mongoUri();
    cache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 20_000,
    }).catch((err: unknown) => {
      cache.promise = null;
      throw err;
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
