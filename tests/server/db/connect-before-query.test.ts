import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Guards against the production build failure in relay #67: an exported server function that
 * runs a Mongoose query must call connectDb() before it does. With bufferCommands=false a query
 * that runs before the first connection throws, which broke the static prerender of search.
 *
 * Static check over src/server:
 * - a query is a call such as `Listing.find(...)` or `Category.collection.updateOne(...)`
 *   (receiver is a PascalCase model name, so array `.find` and CONSTANT receivers are ignored);
 * - a function "queries" if it queries directly or calls a function that queries (same file or
 *   through a named import of another src/server file);
 * - it "connects" only if its own body calls connectDb();
 * - every exported function or exported class method that queries must connect.
 */

const SERVER_PREFIX = "src/server/";

const QUERY_METHODS = new Set([
  "find",
  "findOne",
  "findById",
  "countDocuments",
  "aggregate",
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findByIdAndUpdate",
  "findOneAndDelete",
  "findByIdAndDelete",
  "deleteOne",
  "deleteMany",
  "insertMany",
  "create",
  "distinct",
  "estimatedDocumentCount",
  "exists",
  "bulkWrite",
]);

interface FnInfo {
  key: string;
  exported: boolean;
  queries: boolean;
  connects: boolean;
  calls: string[];
}

function leftmostName(expr: ts.Expression): string | null {
  let current: ts.Expression = expr;
  while (ts.isPropertyAccessExpression(current) || ts.isCallExpression(current)) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current.text : null;
}

function isQueryCall(node: ts.Node): boolean {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  if (!QUERY_METHODS.has(node.expression.name.text)) return false;
  const root = leftmostName(node.expression.expression);
  return root !== null && /^[A-Z][a-z]/.test(root);
}

function isConnectCall(node: ts.Node): boolean {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "connectDb";
}

function hasExport(node: ts.Node): boolean {
  return (ts.getModifiers(node as ts.HasModifiers) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** Resolves `@/server/x` and `./x` specifiers to a file in the source map, or null. */
function resolveSpec(fromFile: string, spec: string, sources: Map<string, string>): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith(".")) base = posix.join(posix.dirname(fromFile), spec);
  else return null;
  for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
    if (sources.has(candidate)) return candidate;
  }
  return null;
}

/** Walks one function body: direct queries and connects, plus the calls it makes. */
function scanBody(body: ts.Node, ctx: { file: string; owner: string | null; imports: Map<string, string>; locals: Set<string> }) {
  const out = { queries: false, connects: false, calls: [] as string[] };
  const visit = (node: ts.Node) => {
    if (isQueryCall(node)) out.queries = true;
    if (isConnectCall(node)) out.connects = true;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) {
        const imported = ctx.imports.get(callee.text);
        if (imported) out.calls.push(imported);
        else if (ctx.locals.has(callee.text)) out.calls.push(`${ctx.file}#${callee.text}`);
      } else if (ts.isPropertyAccessExpression(callee) && callee.expression.kind === ts.SyntaxKind.ThisKeyword && ctx.owner) {
        out.calls.push(`${ctx.file}#${ctx.owner}.${callee.name.text}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return out;
}

function importsOf(file: string, sf: ts.SourceFile, sources: Map<string, string>) {
  const imports = new Map<string, string>();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const bindings = stmt.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const target = resolveSpec(file, stmt.moduleSpecifier.text, sources);
    if (!target) continue;
    for (const el of bindings.elements) imports.set(el.name.text, `${target}#${(el.propertyName ?? el.name).text}`);
  }
  return imports;
}

function localNamesOf(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) names.add(stmt.name.text);
    if (ts.isClassDeclaration(stmt) && stmt.name) names.add(stmt.name.text);
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) if (ts.isIdentifier(decl.name)) names.add(decl.name.text);
    }
  }
  return names;
}

function collectFile(file: string, text: string, sources: Map<string, string>, fns: Map<string, FnInfo>) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports = importsOf(file, sf, sources);
  const locals = localNamesOf(sf);
  const add = (key: string, exported: boolean, body: ts.Node, owner: string | null) => {
    const scan = scanBody(body, { file, owner, imports, locals });
    fns.set(key, { key, exported, queries: scan.queries, connects: scan.connects, calls: scan.calls });
  };
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) {
      add(`${file}#${stmt.name.text}`, hasExport(stmt), stmt.body, null);
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        const init = decl.initializer;
        if (ts.isIdentifier(decl.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          add(`${file}#${decl.name.text}`, hasExport(stmt), init.body, null);
        }
      }
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      const className = stmt.name.text;
      for (const member of stmt.members) {
        if (ts.isMethodDeclaration(member) && member.body && ts.isIdentifier(member.name)) {
          add(`${file}#${className}.${member.name.text}`, hasExport(stmt), member.body, className);
        }
      }
    }
  }
}

/** Propagates `queries` through calls until nothing changes. */
function propagateQueries(fns: Map<string, FnInfo>) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const fn of fns.values()) {
      if (!fn.queries && fn.calls.some((key) => fns.get(key)?.queries)) {
        fn.queries = true;
        changed = true;
      }
    }
  }
}

/** Returns the exported functions that run a query without calling connectDb() themselves. */
export function unconnectedExportedQueries(sources: Map<string, string>): string[] {
  const fns = new Map<string, FnInfo>();
  for (const [file, text] of sources) collectFile(file, text, sources, fns);
  propagateQueries(fns);
  return [...fns.values()]
    .filter((fn) => fn.exported && fn.queries && !fn.connects)
    .map((fn) => fn.key)
    .sort();
}

function sourceFilesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFilesIn(full);
    return entry.endsWith(".ts") && !entry.endsWith(".d.ts") ? [full] : [];
  });
}

function loadServerSources(): Map<string, string> {
  const root = join(process.cwd(), "src", "server");
  const sources = new Map<string, string>();
  for (const full of sourceFilesIn(root)) {
    const rel = full.slice(process.cwd().length + 1).split("\\").join("/");
    if (rel.startsWith(SERVER_PREFIX)) sources.set(rel, readFileSync(full, "utf8"));
  }
  return sources;
}

describe("exported server functions that run a query connect first", () => {
  it("the guard flags an exported query that does not connect, directly or through a helper", () => {
    const sources = new Map<string, string>([
      [
        "src/server/q.ts",
        [
          'import { connectDb } from "@/lib/db";',
          'import { Listing } from "@/server/models";',
          'import { helperQ } from "./b";',
          "export async function loadThing() { return Listing.find({}).lean(); }",
          "export async function loadSafe() { await connectDb(); return Listing.find({}).lean(); }",
          "export async function viaHelper() { return helper(); }",
          "async function helper() { return Listing.find({}).lean(); }",
          "const LIST = [1, 2];",
          "export function pure() { return LIST.find((n) => n > 1); }",
          "export async function usesB() { return helperQ(); }",
        ].join("\n"),
      ],
      ["src/server/b.ts", 'import { Listing } from "@/server/models";\nexport async function helperQ() { return Listing.find({}); }'],
    ]);
    expect(unconnectedExportedQueries(sources)).toEqual([
      "src/server/b.ts#helperQ",
      "src/server/q.ts#loadThing",
      "src/server/q.ts#usesB",
      "src/server/q.ts#viaHelper",
    ]);
  });

  it("no exported server function runs a query without connecting first", () => {
    expect(unconnectedExportedQueries(loadServerSources())).toEqual([]);
  });
});
