export const SIGN_IN_CSS = `
.tk-si-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:rgba(17,5,32,.36);overflow:auto}
.tk-si-page{display:flex;flex-direction:column;justify-content:center;min-height:calc(100vh - 70px);padding:24px 0}
.tk-si{box-sizing:border-box;width:100%;max-width:860px;margin:0 auto;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#1E0B38}
.tk-si *{box-sizing:border-box}
.tk-si-card{display:grid;grid-template-columns:340px minmax(0,1fr);max-height:560px;border-radius:20px;overflow:hidden;background:rgba(255,255,255,.75);backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);border:1px solid rgba(255,255,255,.95);box-shadow:0 24px 64px rgba(45,18,72,.14)}
.tk-si-popup .tk-si-card{background:rgba(255,255,255,.98);backdrop-filter:none;-webkit-backdrop-filter:none;max-height:calc(100vh - 48px);overflow:auto}
.tk-si-side{position:relative;background:linear-gradient(160deg,#FFE4F1 0%,#F3E8FF 50%,#FFF1DE 100%)}
.tk-si-side img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 20%}
.tk-si-main{position:relative;padding:28px 32px;display:flex;flex-direction:column;gap:12px;min-width:0}
.tk-si-close{position:absolute;top:12px;right:12px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;background:none;font:inherit;font-size:26px;line-height:1;color:#4A2870;cursor:pointer;border-radius:12px}
.tk-si-title{margin:0 0 6px;font-size:24px;letter-spacing:-.02em;color:#110520;font-weight:800;line-height:1.2}
.tk-si-help{margin:0;font-size:14px;line-height:1.55;color:#4A2870}
.tk-si-stack{display:flex;flex-direction:column;gap:12px}
.tk-si-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:4px;border-radius:14px;background:#F5EEF9}
.tk-si-tab{min-height:40px;border:0;border-radius:11px;background:transparent;font:inherit;font-size:14px;font-weight:700;color:#1E0B38;cursor:pointer}
.tk-si-tab[aria-selected="true"]{background:#fff;box-shadow:0 2px 8px rgba(45,18,72,.10)}
.tk-si-tab:disabled{color:#8a7a99;cursor:not-allowed}
.tk-si-lab{display:block;margin:0 0 8px;font-size:14px;font-weight:700;color:#1E0B38}
.tk-si-phone{display:flex;gap:8px}
.tk-si-prefix{display:flex;align-items:center;padding:0 14px;min-height:44px;border:1.5px solid #EAD8F0;border-radius:12px;background:#fff;font-weight:700;color:#4A2870}
.tk-si-in{width:100%;min-width:0;box-sizing:border-box;min-height:44px;border:1.5px solid #EAD8F0;border-radius:12px;padding:0 14px;font:inherit;font-size:16px;color:#1E0B38;background:#fff;outline:none}
.tk-si-in:focus{border-color:#D1137A;box-shadow:0 0 0 4px rgba(233,30,140,.14)}
.tk-si-in[aria-invalid="true"]{border-color:#A8124F}
.tk-si-check{display:flex;align-items:center;gap:8px;min-height:28px;font-size:14px;font-weight:600;color:#1E0B38;cursor:pointer}
.tk-si-check input{width:24px;height:24px;flex:none;accent-color:#C2185B}
.tk-si-primary{width:100%;min-height:46px;border:0;border-radius:12px;background:linear-gradient(135deg,#D1137A,#A8124F);color:#fff;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.tk-si-primary:disabled{opacity:.55;cursor:not-allowed}
.tk-si-terms{margin:0;font-size:12px;line-height:1.5;color:#6B4A8A}
.tk-si-terms a{color:#C2185B;text-decoration:underline}
.tk-si-link{min-height:44px;padding:0 4px;border:0;background:none;font:inherit;font-size:14px;font-weight:600;color:#C2185B;text-decoration:underline;cursor:pointer}
.tk-si-link:disabled{color:#8a7a99;text-decoration:none;cursor:default}
.tk-si-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px}
.tk-si-codes{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.tk-si-code{width:100%;min-width:0;min-height:56px;text-align:center;font-size:22px;font-weight:800;padding:0}
.tk-si-tag{margin-left:6px;padding:2px 8px;border-radius:999px;background:#FFF0F7;color:#A8124F;font-size:12px;font-weight:700}
.tk-si-box{display:flex;gap:10px;align-items:flex-start;margin:0;padding:14px;border-radius:14px;background:linear-gradient(135deg,#F5F0FF,#FFF0F7);font-size:13px;line-height:1.5;color:#4A2870}
.tk-si-box svg{flex:none;width:20px;height:20px;color:#A8124F}
.tk-si-error{min-height:20px;margin:0;font-size:14px;color:#A8124F}
.tk-si-focus:focus-visible,.tk-si-in:focus-visible,.tk-si-role:focus-visible,.tk-si-tab:focus-visible,.tk-si-primary:focus-visible,.tk-si-link:focus-visible,.tk-si-close:focus-visible,.tk-si-check input:focus-visible{outline:3px solid #7C3AED;outline-offset:2px}
@media (max-width:820px){
  .tk-si-page{min-height:0;padding:24px 16px 48px}
  .tk-si-card{grid-template-columns:minmax(0,1fr);max-height:none}
  .tk-si-side{display:none}
  .tk-si-main{padding:24px 20px 28px}
  .tk-si-title{font-size:24px}
  .tk-si-codes{gap:6px}
  .tk-si-code{min-height:52px;font-size:20px}
}
@media (max-width:360px){.tk-si-code{font-size:18px}}
@media (prefers-reduced-motion:reduce){.tk-si *{transition:none !important;animation:none !important}}
`;
