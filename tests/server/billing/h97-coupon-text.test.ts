import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { COUPON_NOT_FOUND, validateCoupon } from "@/server/billing/coupons";
import { NotFoundError } from "@/server/http";
import { Coupon } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const user = String(new mongoose.Types.ObjectId());

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

describe("H9.7 the coupon error in plain words", () => {
  it("says the same friendly sentence for a wrong code and for a coupon that is switched off or malformed", async () => {
    expect(COUPON_NOT_FOUND).toBe("We couldn't find that coupon. Check the code and try again.");
    await Coupon.create({ code: "off", kind: "credits", credits: 10, status: "paused" });
    await Coupon.create({ code: "empty", kind: "credits", credits: 0, status: "active" });
    await Coupon.create({ code: "big", kind: "percent", percent: 150, status: "active" });
    for (const code of ["nope", "off", "empty", "big"]) {
      await expect(validateCoupon(code, user)).rejects.toThrow(COUPON_NOT_FOUND);
      await expect(validateCoupon(code, user)).rejects.toBeInstanceOf(NotFoundError);
    }
  });

  it("does not use the old words", async () => {
    await expect(validateCoupon("nope", user)).rejects.not.toThrow(/Coupon is invalid/);
  });
});
