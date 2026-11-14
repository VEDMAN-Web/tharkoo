import { clientKey } from "@/lib/rate-limit";
import {
  LOGIN_MAX,
  RATE_WINDOW_MS,
  SESSION_COOKIE,
  assertOrigin,
  clearSessionCookieHeader,
  clearSessionHintCookie,
  readCookie,
  sessionCookieHeader,
  sessionHintCookie,
} from "@/server/auth/http";
import { sendLoginCode, verifyLoginCode } from "@/server/auth/otp";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import {
  confirmPhone,
  forgotPassword,
  listSessions,
  loginUser,
  logoutSession,
  permissionsFor,
  registerUser,
  requireUser,
  resetPassword,
  revokeOwnedSession,
  startPhone,
  verifyEmail,
} from "@/server/auth/service";
import { z } from "zod";
import { NotFoundError, failure, handle, parseInput, requestIdFrom, success } from "@/server/http";
import {
  forgotPasswordBodySchema,
  loginBodySchema,
  phoneConfirmBodySchema,
  phoneStartBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  verifyEmailBodySchema,
} from "@/server/shared/schemas/auth";

const otpSendBodySchema = z.object({
  phone: z.string().trim().min(8).max(20),
});

const otpVerifyBodySchema = z.object({
  phone: z.string().trim().min(8).max(20),
  code: z.string().trim().regex(/^\d{6}$/),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function segmentsOf(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  const prefix = "/api/auth";
  if (!path.startsWith(`${prefix}/`)) return [];
  return path.slice(prefix.length + 1).split("/").filter(Boolean);
}

async function readBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function json(data: unknown, requestId: string, status = 200, cookies: string[] = []) {
  const headers = new Headers({ "x-request-id": requestId });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return Response.json(success(data, requestId), { status, headers });
}

async function limit(key: string, max: number, requestId: string) {
  const result = await consumeRateLimit(key, max, RATE_WINDOW_MS);
  if (result.ok) return null;
  return Response.json(failure({ code: "RATE_LIMITED", message: "Too many requests" }, requestId), {
    status: 429,
    headers: { "retry-after": String(result.retryAfter), "x-request-id": requestId },
  });
}

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const segments = segmentsOf(request);
  const path = segments.join("/");
  assertOrigin(request);
  const token = readCookie(request, SESSION_COOKIE);
  const ip = clientKey(request.headers);

  if (request.method === "POST" && path === "register") {
    const body = parseInput(registerBodySchema, await readBody(request));
    const blocked = await limit(`register:${ip}`, 20, requestId);
    if (blocked) return blocked;
    return json(await registerUser(body), requestId, 201);
  }
  if (request.method === "POST" && path === "verify-email") {
    const body = parseInput(verifyEmailBodySchema, await readBody(request));
    const blocked = await limit(`verify:${ip}`, 20, requestId);
    if (blocked) return blocked;
    return json(await verifyEmail(body.token), requestId);
  }
  if (request.method === "POST" && path === "login") {
    const body = parseInput(loginBodySchema, await readBody(request));
    const blocked = await limit(`login:${body.email.toLowerCase()}`, LOGIN_MAX, requestId);
    if (blocked) return blocked;
    const result = await loginUser({
      email: body.email,
      password: body.password,
      userAgent: request.headers.get("user-agent"),
      ip,
      existingToken: token,
    });
    return json({ user: result.user }, requestId, 200, [sessionCookieHeader(result.token), sessionHintCookie()]);
  }
  if (request.method === "POST" && path === "logout") {
    await logoutSession(token);
    return json({ ok: true }, requestId, 200, [clearSessionCookieHeader(), clearSessionHintCookie()]);
  }
  if (request.method === "GET" && path === "me") {
    const found = await requireUser(token);
    return json(
      {
        user: found.user,
        verification: { status: found.user.verificationStatus },
        permissions: permissionsFor(found.user.roles),
      },
      requestId,
    );
  }
  if (request.method === "POST" && path === "forgot-password") {
    const body = parseInput(forgotPasswordBodySchema, await readBody(request));
    const blocked = await limit(`forgot:${ip}`, 10, requestId);
    if (blocked) return blocked;
    return json(await forgotPassword(body.email), requestId);
  }
  if (request.method === "POST" && path === "reset-password") {
    const body = parseInput(resetPasswordBodySchema, await readBody(request));
    const blocked = await limit(`reset:${ip}`, 10, requestId);
    if (blocked) return blocked;
    return json(await resetPassword(body.token, body.password), requestId);
  }
  if (request.method === "POST" && path === "phone/start") {
    const found = await requireUser(token);
    const body = parseInput(phoneStartBodySchema, await readBody(request));
    const blocked = await limit(`phone:${found.user.id}`, 5, requestId);
    if (blocked) return blocked;
    return json(await startPhone(found.user.id, body.phone), requestId);
  }
  if (request.method === "POST" && path === "phone/confirm") {
    const found = await requireUser(token);
    const body = parseInput(phoneConfirmBodySchema, await readBody(request));
    return json(await confirmPhone(found.user.id, body.challengeId, body.code), requestId);
  }
  if (request.method === "POST" && path === "otp/send") {
    const body = parseInput(otpSendBodySchema, await readBody(request));
    const sent = await sendLoginCode({ phone: body.phone, ip });
    if (!sent.ok) {
      return Response.json(failure({ code: "RATE_LIMITED", message: "Too many codes requested. Try again later." }, requestId), {
        status: 429,
        headers: { "retry-after": String(sent.retryAfter), "x-request-id": requestId },
      });
    }
    return json({ sent: true }, requestId);
  }
  if (request.method === "POST" && path === "otp/verify") {
    const body = parseInput(otpVerifyBodySchema, await readBody(request));
    const blocked = await limit(`otp-verify:${ip}`, LOGIN_MAX, requestId);
    if (blocked) return blocked;
    const result = await verifyLoginCode({
      phone: body.phone,
      code: body.code,
      userAgent: request.headers.get("user-agent"),
      ip,
      existingToken: token,
    });
    return json({ user: result.user }, requestId, 200, [sessionCookieHeader(result.token), sessionHintCookie()]);
  }
  if (request.method === "GET" && path === "sessions") {
    const found = await requireUser(token);
    return json(await listSessions(found.user.id, found.sessionId), requestId);
  }
  if (request.method === "DELETE" && segments[0] === "sessions" && segments[1]) {
    const found = await requireUser(token);
    return json(await revokeOwnedSession(found.user.id, segments[1]), requestId);
  }
  throw new NotFoundError("Not found");
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);
export const DELETE = handle(dispatch);
