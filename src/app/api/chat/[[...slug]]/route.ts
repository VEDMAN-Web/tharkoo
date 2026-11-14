import { z } from "zod";
import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { NotFoundError, handle, parseInput, requestIdFrom, success } from "@/server/http";
import {
  blockConversation,
  deleteChatMessage,
  listInbox,
  listMessages,
  listReportedConversations,
  readReportedConversation,
  reportConversation,
  sendMessage,
  startConversation,
  unreadCount,
} from "@/server/chat/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startSchema = z.object({ listingId: z.string().min(1).max(40) });
const textSchema = z.object({ text: z.string().max(5000).optional() });
const reportSchema = z.object({ reason: z.string().max(500).optional() });

function segmentsOf(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  return path.replace(/^\/api\/chat\/?/, "").split("/").filter(Boolean);
}

/** A message is JSON ({ text }) or multipart (text and/or one photo). */
async function messageInput(request: Request) {
  if (!(request.headers.get("content-type") || "").includes("multipart/form-data")) {
    return { text: parseInput(textSchema, await request.json().catch(() => undefined)).text, image: null as File | null };
  }
  const form = await request.formData();
  const photo = form.get("image");
  return { text: String(form.get("text") || ""), image: photo instanceof File && photo.size > 0 ? photo : null };
}

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const { user } = await requireUser(readCookie(request, SESSION_COOKIE));
  const [first, id, third] = segmentsOf(request);
  const method = request.method;
  const staff = { email: user.email, roles: user.roles };
  let data: unknown;
  if (first === "conversations" && !id && method === "GET") data = await listInbox(user.id);
  else if (first === "conversations" && !id && method === "POST") {
    data = await startConversation(user.id, parseInput(startSchema, await request.json().catch(() => undefined)).listingId);
  } else if (first === "unread" && method === "GET") data = { unread: await unreadCount(user.id) };
  else if (first === "conversations" && id && third === "messages" && method === "GET") {
    data = await listMessages(user.id, id, { after: new URL(request.url).searchParams.get("after") || undefined });
  } else if (first === "conversations" && id && third === "messages" && method === "POST") {
    const input = await messageInput(request);
    const image = input.image ? { type: input.image.type, data: Buffer.from(await input.image.arrayBuffer()) } : null;
    data = await sendMessage(user.id, id, { text: input.text, image });
  } else if (first === "conversations" && id && third === "block" && method === "POST") data = await blockConversation(user.id, id, requestId);
  else if (first === "conversations" && id && third === "report" && method === "POST") {
    data = await reportConversation(user.id, id, parseInput(reportSchema, await request.json().catch(() => ({}))), requestId);
  } else if (first === "admin" && id === "reported" && method === "GET") data = await listReportedConversations(staff);
  else if (first === "admin" && id === "conversations" && third && method === "GET") data = await readReportedConversation(staff, third, requestId);
  else if (first === "admin" && id === "messages" && third && method === "DELETE") data = await deleteChatMessage(staff, third, requestId);
  else throw new NotFoundError("Not found");
  return Response.json(success(data, requestId), { headers: { "x-request-id": requestId } });
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);
export const DELETE = handle(dispatch);
