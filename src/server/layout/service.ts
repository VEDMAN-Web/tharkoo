import { randomUUID } from "node:crypto";
import { invalidateTags } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { isAdminRole } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { PageLayout, PageLayoutRevision, User } from "@/server/models";
import { PAGE_KEYS, type BlockBase, type PageKey } from "@/server/models/layout";
import { textDenied } from "@/server/shared/policy";
import { blockDef, blockEnvelope, isBlockType, POST_STEP_KEYS } from "@/server/layout/blocks";

const audit = new AuditRepository();

export const MAX_BLOCKS = 60;
const SCOPE_CATEGORY = /^category:[a-z0-9-]{1,80}$/;
const SCOPE_URL = /^url:\/[a-zA-Z0-9\-._~/]{0,300}$/;

export function layoutTag(key: PageKey) {
  return `layout:${key}`;
}

function requireAdmin(roles: string[]) {
  if (!isAdminRole(roles)) throw new ForbiddenError("Only an admin can edit page layouts");
}

export function assertKeyAndScope(key: string, scope: string): asserts key is PageKey {
  if (!(PAGE_KEYS as readonly string[]).includes(key)) throw new ValidationError("Unknown page");
  if (scope === "default") return;
  if (key !== "listing") throw new ValidationError("Only listing pages have more than the default layout");
  if (!SCOPE_CATEGORY.test(scope) && !SCOPE_URL.test(scope)) throw new ValidationError("Scope must be default, category:<slug> or url:<path>");
}

function* strings(value: unknown): Generator<string> {
  if (typeof value === "string") yield value;
  else if (Array.isArray(value)) for (const item of value) yield* strings(item);
  else if (value && typeof value === "object") for (const item of Object.values(value)) yield* strings(item);
}

function noDeniedText(index: number, ...values: unknown[]) {
  for (const value of values) {
    for (const text of strings(value)) {
      if (textDenied(text).denied) throw new ValidationError(`Block ${index + 1} contains a term that is not allowed on Tharkoo. Change the wording and save again.`);
    }
  }
}

/** Validates the whole block list for one page and returns clean blocks. Throws ValidationError with a readable message. */
export function validateBlocks(key: PageKey, input: unknown, knownIds: ReadonlySet<string>): BlockBase[] {
  if (!Array.isArray(input)) throw new ValidationError("Blocks must be a list");
  if (input.length > MAX_BLOCKS) throw new ValidationError(`A page can have at most ${MAX_BLOCKS} blocks`);
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  const out: BlockBase[] = [];
  input.forEach((raw, index) => {
    const head = blockEnvelope.safeParse(raw);
    if (!head.success) throw new ValidationError(`Block ${index + 1}: ${head.error.issues[0]?.message ?? "invalid"}`);
    const block = head.data;
    const def = blockDef(block.type);
    if (!def || !isBlockType(block.type)) throw new ValidationError(`Block ${index + 1}: unknown type "${block.type}"`);
    if (!def.pages.includes(key)) throw new ValidationError(`Block ${index + 1}: "${block.type}" cannot be used on this page`);
    const props = def.schema.safeParse(block.props);
    if (!props.success) {
      const issue = props.error.issues[0];
      const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
      throw new ValidationError(`Block ${index + 1} (${block.type}) ${where}${issue?.message ?? "is invalid"}`);
    }
    if (block.startsAt && block.endsAt && Date.parse(block.startsAt) >= Date.parse(block.endsAt)) {
      throw new ValidationError(`Block ${index + 1}: the end date must be after the start date`);
    }
    const count = (counts.get(block.type) ?? 0) + 1;
    counts.set(block.type, count);
    if (def.max !== undefined && count > def.max) throw new ValidationError(`A page can have at most ${def.max} "${block.type}" block${def.max === 1 ? "" : "s"}`);
    const data = props.data as Record<string, unknown>;
    if (block.type === "postStep") {
      const stepKey = String(data.stepKey);
      if (!(POST_STEP_KEYS as readonly string[]).includes(stepKey)) throw new ValidationError(`Block ${index + 1}: unknown step`);
      if (stepKey !== "promote" && !block.visible) throw new ValidationError(`Block ${index + 1}: only the promote step can be hidden`);
    }
    noDeniedText(index, block.label, data);
    // Ids: keep an id the server already knows (so reorders keep identity); everything else is new.
    let id = block.id && knownIds.has(block.id) && !seen.has(block.id) ? block.id : "";
    if (!id) id = randomUUID();
    seen.add(id);
    out.push({
      id,
      type: block.type,
      visible: block.visible,
      ...(block.label ? { label: block.label } : {}),
      ...(block.devices?.length ? { devices: [...new Set(block.devices)] } : {}),
      startsAt: block.startsAt ?? null,
      endsAt: block.endsAt ?? null,
      props: data,
    });
  });
  const stepKeys = out.filter((block) => block.type === "postStep").map((block) => String(block.props.stepKey));
  if (new Set(stepKeys).size !== stepKeys.length) throw new ValidationError("Each post step can appear only once");
  return out;
}

function idsOf(blocks: readonly BlockBase[] | undefined) {
  return new Set((blocks ?? []).map((block) => block.id));
}

async function actorId(email: string) {
  if (!email) return null;
  const user = await User.findOne({ email }).select("_id");
  return user?._id?.toString() ?? null;
}

async function record(action: string, email: string, key: PageKey, scope: string, before: unknown, after: unknown, reason?: string) {
  await audit.append({
    actorId: await actorId(email),
    actorType: "admin",
    action,
    targetType: "layout",
    targetId: `${key}/${scope}`,
    before: before as Record<string, unknown>,
    after: after as Record<string, unknown>,
    reason,
    requestId: randomUUID(),
  });
}

export async function getPublished(key: PageKey, scope: string): Promise<BlockBase[] | null> {
  await connectDb();
  const doc = await PageLayout.findOne({ key, scope, publishedAt: { $ne: null } }).lean();
  return doc ? (doc.published as BlockBase[]) : null;
}

export async function getDraft(key: PageKey, scope: string): Promise<BlockBase[] | null> {
  await connectDb();
  const doc = await PageLayout.findOne({ key, scope }).lean();
  return doc ? (doc.draft as BlockBase[]) : null;
}

export async function saveDraft(input: { key: string; scope: string; blocks: unknown; email: string; roles: string[] }) {
  requireAdmin(input.roles);
  assertKeyAndScope(input.key, input.scope);
  const { key, scope } = input;
  await connectDb();
  const current = await PageLayout.findOne({ key, scope }).lean();
  const before = (current?.draft ?? []) as BlockBase[];
  const known = new Set([...idsOf(before), ...idsOf(current?.published as BlockBase[] | undefined)]);
  const clean = validateBlocks(key, input.blocks, known);
  const kept = idsOf(clean);
  for (const old of before) {
    const def = blockDef(old.type);
    if (def && !def.deletable && !kept.has(old.id)) {
      throw new ValidationError(`The "${old.type}" block is required on this page and cannot be removed`);
    }
  }
  const saved = await PageLayout.findOneAndUpdate(
    { key, scope },
    { $set: { draft: clean, updatedBy: input.email }, $setOnInsert: { published: [], version: 0, publishedBy: "", publishedAt: null } },
    { upsert: true, new: true },
  ).lean();
  await record("layout.save", input.email, key, scope, { blocks: before }, { blocks: clean });
  return { blocks: saved?.draft as BlockBase[], version: saved?.version ?? 0 };
}

export async function publish(input: { key: string; scope: string; email: string; roles: string[]; note?: string }) {
  requireAdmin(input.roles);
  assertKeyAndScope(input.key, input.scope);
  const { key, scope } = input;
  const note = (input.note ?? "").trim().slice(0, 200);
  if (note && textDenied(note).denied) throw new ValidationError("The note contains a term that is not allowed");
  await connectDb();
  const current = await PageLayout.findOne({ key, scope }).lean();
  if (!current) throw new NotFoundError("There is no draft to publish yet");
  const version = current.version + 1;
  const now = new Date();
  const updated = await PageLayout.findOneAndUpdate(
    { key, scope, version: current.version },
    { $set: { published: current.draft, version, publishedBy: input.email, publishedAt: now } },
    { new: true },
  ).lean();
  if (!updated) throw new ConflictError("Someone else published at the same moment. Reload and try again.");
  await PageLayoutRevision.create({ key, scope, version, blocks: current.draft, publishedBy: input.email, publishedAt: now, note });
  await record("layout.publish", input.email, key, scope, { version: current.version, blocks: current.published }, { version, blocks: current.draft }, note || undefined);
  invalidateTags([layoutTag(key)]);
  return { version };
}

export async function restore(input: { key: string; scope: string; version: number; email: string; roles: string[] }) {
  requireAdmin(input.roles);
  assertKeyAndScope(input.key, input.scope);
  const { key, scope } = input;
  await connectDb();
  const revision = await PageLayoutRevision.findOne({ key, scope, version: input.version }).lean();
  if (!revision) throw new NotFoundError("That version does not exist");
  const current = await PageLayout.findOne({ key, scope }).lean();
  const before = (current?.draft ?? []) as BlockBase[];
  await PageLayout.findOneAndUpdate(
    { key, scope },
    { $set: { draft: revision.blocks, updatedBy: input.email }, $setOnInsert: { published: [], version: 0, publishedBy: "", publishedAt: null } },
    { upsert: true },
  );
  await record("layout.restore", input.email, key, scope, { blocks: before }, { blocks: revision.blocks, restoredVersion: input.version });
  return { blocks: revision.blocks as BlockBase[] };
}

export async function listRevisions(key: PageKey, scope: string, roles: string[], limit = 50) {
  requireAdmin(roles);
  assertKeyAndScope(key, scope);
  await connectDb();
  const rows = await PageLayoutRevision.find({ key, scope }).sort({ version: -1 }).limit(Math.min(limit, 100)).select("version publishedBy publishedAt note").lean();
  return rows.map((row) => ({ version: row.version, publishedBy: row.publishedBy, publishedAt: row.publishedAt, note: row.note ?? "" }));
}
