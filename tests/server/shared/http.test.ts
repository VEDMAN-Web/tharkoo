import { describe, expect, it } from "vitest";
import { handle, parseInput, PolicyViolationError, success } from "@/server/http";
import { loginBodySchema, registerBodySchema } from "@/server/shared/schemas";

describe("http envelope", () => {
  it("builds the success envelope", () => {
    expect(success({ userId: "1" }, "req-1", { page: 1 })).toEqual({
      ok: true,
      data: { userId: "1" },
      meta: { requestId: "req-1", page: 1 },
      error: null,
    });
  });

  it("maps a bad body to VALIDATION_ERROR", async () => {
    const route = handle(() => {
      parseInput(loginBodySchema, {});
      return Response.json(success({ ok: true }, "unused"));
    });
    const response = await route(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "x-request-id": "req-http" },
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBe("req-http");
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.data).toBeNull();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.meta.requestId).toBe("req-http");
  });

  it("maps a policy error and requires register attestation", async () => {
    expect(registerBodySchema.safeParse({ email: "a@example.com", password: "password123" }).success).toBe(
      false,
    );
    const route = handle(() => {
      throw new PolicyViolationError("Not allowed");
    });
    const response = await route(new Request("http://localhost/api/listings"));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("POLICY_VIOLATION");
  });
});
