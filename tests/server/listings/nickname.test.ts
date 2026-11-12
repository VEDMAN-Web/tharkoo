import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { patchListing, ownerView } from "@/server/listings/service";
import { draftToForm } from "@/lib/ui/post-form";
import { Listing } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(disconnectMemoryMongo);
beforeEach(clearMemoryMongo);

describe("saved nickname", () => {
  it("is saved with the details and loaded again when the ad is edited", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const row = await Listing.create({ ownerId, status: "draft", categoryId: new mongoose.Types.ObjectId(), title: "Used cycle", description: "A well kept cycle" });
    const id = row._id.toString();
    await patchListing(id, ownerId.toString(), { stage: "details", nickname: "  Ravi  " }, "req-1");
    const saved = ownerView((await Listing.findById(id))!.toObject());
    expect(saved.nickname).toBe("Ravi");
    expect(draftToForm({ ...saved, price: undefined } as never).nickname).toBe("Ravi");
  });

  it("still reads an older nickname kept in the attributes", () => {
    expect(draftToForm({ attributes: { nickname: "Old" } }).nickname).toBe("Old");
    expect(draftToForm({}).nickname).toBe("");
  });
});
