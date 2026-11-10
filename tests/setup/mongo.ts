import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let server: MongoMemoryServer | null = null;

export async function startMemoryMongo() {
  if (!server) server = await MongoMemoryServer.create();
  const uri = server.getUri("tharkoo");
  process.env.MONGODB_URI = uri;
  return uri;
}

export async function connectMemoryMongo() {
  const uri = process.env.MONGODB_URI || (await startMemoryMongo());
  if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
  return mongoose.connection;
}

export async function clearMemoryMongo() {
  const collections = mongoose.connection.collections;
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({});
  }
}

export async function disconnectMemoryMongo() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (server) {
    await server.stop();
    server = null;
  }
  delete process.env.MONGODB_URI;
}
