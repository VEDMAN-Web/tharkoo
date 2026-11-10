import { readFileSync } from "node:fs";
import mongoose from "mongoose";

const uriFile = "/tmp/tharkoo-e2e-mongo-uri";

export default async function globalSetup() {
  const uri = readFileSync(uriFile, "utf8").trim();
  if (!uri.startsWith("mongodb://")) throw new Error("e2e memory Mongo URI is missing");
  await mongoose.connect(uri);
  await mongoose.connection.db?.admin().ping();
  await mongoose.disconnect();
}
