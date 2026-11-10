import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppendOnlyError } from "@/server/audit/append-only";
import { AuditRepository } from "@/server/audit/repository";
import { AuditEvent, ListingVersion, WalletEntry } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

async function appendAudit() {
  const repository = new AuditRepository();
  return repository.append({
    actorType: "system",
    action: "test.append",
    targetType: "listing",
    targetId: "target-1",
    requestId: "req-1",
  });
}

describe("audit log is append-only", () => {
  it("exposes only append and list on the repository", () => {
    const repository = new AuditRepository();
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(repository)).filter(
      (name) => name !== "constructor",
    );
    expect(methods.sort()).toEqual(["append", "list"]);
  });

  it("rejects updates, deletes, and bulk writes after an insert", async () => {
    const created = await appendAudit();
    const id = created._id;

    await expect(AuditEvent.updateOne({ _id: id }, { $set: { action: "tamper" } })).rejects.toBeInstanceOf(
      AppendOnlyError,
    );
    await expect(AuditEvent.updateMany({ _id: id }, { $set: { action: "tamper" } })).rejects.toBeInstanceOf(
      AppendOnlyError,
    );
    await expect(AuditEvent.deleteOne({ _id: id })).rejects.toBeInstanceOf(AppendOnlyError);
    await expect(AuditEvent.deleteMany({ _id: id })).rejects.toBeInstanceOf(AppendOnlyError);
    await expect(
      AuditEvent.findOneAndUpdate({ _id: id }, { $set: { action: "tamper" } }),
    ).rejects.toBeInstanceOf(AppendOnlyError);
    await expect(
      AuditEvent.replaceOne(
        { _id: id },
        { actorType: "system", action: "x", targetType: "listing", targetId: "t", requestId: "r" },
      ),
    ).rejects.toBeInstanceOf(AppendOnlyError);
    await expect(
      AuditEvent.bulkWrite([
        { updateOne: { filter: { _id: id }, update: { $set: { action: "tamper" } } } },
      ]),
    ).rejects.toBeInstanceOf(AppendOnlyError);

    const stored = await AuditEvent.findById(id);
    expect(stored?.action).toBe("test.append");
    stored!.action = "tamper";
    await expect(stored!.save()).rejects.toBeInstanceOf(AppendOnlyError);
    expect(await AuditEvent.countDocuments({ action: "test.append" })).toBe(1);
    expect(await AuditEvent.countDocuments({ action: "tamper" })).toBe(0);

    await AuditEvent.bulkWrite([
      {
        insertOne: {
          document: {
            actorType: "system",
            action: "test.insert",
            targetType: "listing",
            targetId: "target-2",
            requestId: "req-2",
          },
        },
      },
    ]);
    expect(await AuditEvent.countDocuments({ action: "test.insert" })).toBe(1);
  });

  it("lists the appended event", async () => {
    await appendAudit();
    const repository = new AuditRepository();
    const events = await repository.list({ action: "test.append" });
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe("test.append");
  });
});

describe("listing versions and wallet entries are append-only", () => {
  it("blocks update, delete, and bulk write on listing versions", async () => {
    const created = await ListingVersion.create({
      listingId: new mongoose.Types.ObjectId(),
      version: 1,
      snapshot: { title: "Hatchback" },
      actorId: new mongoose.Types.ObjectId(),
    });
    const id = created._id;
    await expect(
      ListingVersion.updateOne({ _id: id }, { $set: { version: 2 } }),
    ).rejects.toBeInstanceOf(AppendOnlyError);
    await expect(ListingVersion.deleteOne({ _id: id })).rejects.toBeInstanceOf(AppendOnlyError);
    await expect(
      ListingVersion.bulkWrite([
        { deleteOne: { filter: { _id: id } } },
      ]),
    ).rejects.toBeInstanceOf(AppendOnlyError);
    expect(await ListingVersion.countDocuments({ _id: id })).toBe(1);
  });

  it("blocks updates on wallet entries", async () => {
    const created = await WalletEntry.create({
      userId: new mongoose.Types.ObjectId(),
      delta: 10,
      reason: "pack",
      refType: "payment",
      refId: "pay-1",
      balanceAfter: 10,
      idempotencyKey: "wallet-1",
    });
    await expect(
      WalletEntry.updateOne({ _id: created._id }, { $set: { delta: 99 } }),
    ).rejects.toBeInstanceOf(AppendOnlyError);
    await expect(
      WalletEntry.bulkWrite([{ deleteMany: { filter: { _id: created._id } } }]),
    ).rejects.toBeInstanceOf(AppendOnlyError);
    expect((await WalletEntry.findById(created._id))?.delta).toBe(10);
  });
});
