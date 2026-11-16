import { z } from "zod";
import { handle, parseInput, requestIdFrom, success } from "@/server/http";
import { suggestSupportArticles } from "@/server/support/articles";
import { SUPPORT_TOPICS } from "@/server/support/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  topic: z.enum(SUPPORT_TOPICS).optional().default("something_else"),
  q: z.string().trim().max(120).optional().default(""),
});

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const query = parseInput(querySchema, Object.fromEntries(new URL(request.url).searchParams));
  const articles = await suggestSupportArticles(query.topic, query.q);
  return Response.json(success(articles, requestId));
}

export const GET = handle(dispatch);
