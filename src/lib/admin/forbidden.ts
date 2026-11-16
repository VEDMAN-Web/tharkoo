import { PERMS } from "@/lib/admin/perms";
import { roleWords } from "@/lib/admin/role-words";
import { SCREENS, screenForPath } from "@/lib/admin/screens";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function forbiddenInfo(pathname: string): { screen: string; who: string } {
  const target = screenForPath(pathname);
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const found = SCREENS.filter((entry) => (entry.href === "/admin/" ? path === entry.href : path.startsWith(entry.href))).sort((a, b) => b.href.length - a.href.length)[0];
  const allowed: readonly string[] = target.only ? [target.only] : PERMS[target.view];
  return { screen: found?.label ?? "this screen", who: roleWords(allowed) };
}

const STYLE = `
:root{--bg:#f6f7fb;--surface:#fff;--line:#e6e8ef;--text:#161a2b;--muted:#5b6275;--pri:#c2185b;--pri-h:#a8124f;--pri-soft:#fdecf3}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:100%;max-width:460px;padding:28px 24px;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:0 1px 2px rgba(22,26,43,.05),0 4px 14px rgba(22,26,43,.05);text-align:center}
.lock{display:grid;place-items:center;width:52px;height:52px;margin:0 auto 14px;border-radius:50%;background:var(--pri-soft);color:var(--pri-h)}
h1{margin:0 0 8px;font-size:22px;font-weight:800;letter-spacing:-.01em}p{margin:0 0 10px;color:var(--muted)}
.who{color:var(--text);font-weight:700}
a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:8px;padding:0 18px;border-radius:8px;background:var(--pri);color:#fff;font-weight:700;text-decoration:none}
a:hover{background:var(--pri-h)}a:focus-visible{outline:2px solid var(--pri);outline-offset:2px}
`;

/** The 403 page for a staff screen the viewer's role does not open. One H1, noindex, a way back to the Dashboard. */
export function forbiddenHtml(pathname: string): string {
  const { screen, who } = forbiddenInfo(pathname);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>403 | Tharkoo staff</title><style>${STYLE}</style></head><body><main data-tk="admin-403"><span class="lock" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span><h1>You cannot open ${escapeHtml(screen)}</h1><p>Your staff role does not open this screen.</p><p>Who can open it: <span class="who">${escapeHtml(who)}</span>.</p><a href="/admin/">Back to Dashboard</a></main></body></html>`;
}
