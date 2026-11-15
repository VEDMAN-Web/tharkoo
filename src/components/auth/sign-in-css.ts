/** Styles for the sign-in card (H7.12). Numbers are copied from .relay/mockups/v2/04-Login.html. */
export const SIGN_IN_CSS = `
.tk-si-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:rgba(17,5,32,.36);overflow:auto}
.tk-si-page{padding:40px 0 72px}
.tk-si{box-sizing:border-box;width:100%;max-width:980px;margin:0 auto;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#1E0B38}
.tk-si *{box-sizing:border-box}
.tk-si-card{display:grid;grid-template-columns:400px minmax(0,1fr);border-radius:20px;overflow:hidden;background:rgba(255,255,255,.75);backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);border:1px solid rgba(255,255,255,.95);box-shadow:0 24px 64px rgba(45,18,72,.14)}
.tk-si-popup .tk-si-card{background:rgba(255,255,255,.98);backdrop-filter:none;-webkit-backdrop-filter:none;max-height:calc(100vh - 48px);overflow:auto}
.tk-si-side{padding:40px 36px;background:linear-gradient(160deg,#FFE4F1 0%,#F3E8FF 50%,#FFF1DE 100%);display:flex;flex-direction:column;gap:22px}
.tk-si-eyebrow{margin:0;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#A8124F}
.tk-si-pitch{margin:0;font-size:30px;line-height:1.15;letter-spacing:-.02em;color:#110520;font-weight:800}
.tk-si-points{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px}
.tk-si-point{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;border:1px solid rgba(255,255,255,.9);background:linear-gradient(135deg,rgba(255,255,255,.9),rgba(255,240,247,.9))}
.tk-si-point:nth-child(2){background:linear-gradient(135deg,rgba(255,255,255,.9),rgba(245,240,255,.9))}
.tk-si-point:nth-child(3){background:linear-gradient(135deg,rgba(255,255,255,.9),rgba(255,248,236,.9))}
.tk-si-num{width:32px;height:32px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;background:#FDF0F7;color:#A8124F}
.tk-si-point:nth-child(2) .tk-si-num{background:#F5F0FF;color:#5B21B6}
.tk-si-point:nth-child(3) .tk-si-num{background:#FFF5E6;color:#92400E}
.tk-si-point-text{font-size:14px;font-weight:600;color:#1E0B38}
.tk-si-main{position:relative;padding:40px 40px 36px;display:flex;flex-direction:column;gap:18px;min-width:0}
.tk-si-close{position:absolute;top:12px;right:12px;min-width:44px;min-height:44px;border:0;background:none;font:inherit;font-size:26px;line-height:1;color:#4A2870;cursor:pointer;border-radius:12px}
.tk-si-title{margin:0 0 6px;font-size:26px;letter-spacing:-.02em;color:#110520;font-weight:800;line-height:1.2}
.tk-si-help{margin:0;font-size:14px;line-height:1.55;color:#4A2870}
.tk-si-stack{display:flex;flex-direction:column;gap:16px}
.tk-si-roles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tk-si-role{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:14px;border-radius:14px;border:2px solid #EAD8F0;background:#fff;font:inherit;text-align:left;cursor:pointer;color:#110520}
.tk-si-role.is-on{border-color:#D1137A;background:#FFF5FA}
.tk-si-role-name{font-size:15px;font-weight:800;color:#110520}
.tk-si-role-sub{font-size:12px;color:#4A2870}
.tk-si-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:4px;border-radius:14px;background:#F5EEF9}
.tk-si-tab{min-height:44px;border:0;border-radius:11px;background:transparent;font:inherit;font-size:14px;font-weight:700;color:#1E0B38;cursor:pointer}
.tk-si-tab[aria-selected="true"]{background:#fff;box-shadow:0 2px 8px rgba(45,18,72,.10)}
.tk-si-tab:disabled{color:#8a7a99;cursor:not-allowed}
.tk-si-lab{display:block;margin:0 0 8px;font-size:14px;font-weight:700;color:#1E0B38}
.tk-si-phone{display:flex;gap:8px}
.tk-si-prefix{display:flex;align-items:center;padding:0 14px;min-height:48px;border:1.5px solid #EAD8F0;border-radius:12px;background:#fff;font-weight:700;color:#4A2870}
.tk-si-in{width:100%;min-width:0;box-sizing:border-box;min-height:48px;border:1.5px solid #EAD8F0;border-radius:12px;padding:0 14px;font:inherit;font-size:16px;color:#1E0B38;background:#fff;outline:none}
.tk-si-in:focus{border-color:#D1137A;box-shadow:0 0 0 4px rgba(233,30,140,.14)}
.tk-si-in[aria-invalid="true"]{border-color:#A8124F}
.tk-si-check{display:flex;align-items:center;gap:8px;min-height:44px;font-size:14px;font-weight:600;color:#1E0B38;cursor:pointer}
.tk-si-check input{width:18px;height:18px;flex:none;accent-color:#C2185B}
.tk-si-primary{width:100%;min-height:48px;border:0;border-radius:12px;background:linear-gradient(135deg,#D1137A,#A8124F);color:#fff;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.tk-si-primary:disabled{opacity:.55;cursor:not-allowed}
.tk-si-terms{margin:0;font-size:12px;line-height:1.5;color:#6B4A8A}
.tk-si-terms a{color:#C2185B;text-decoration:underline}
.tk-si-link{color:#C2185B}
.tk-si-link{min-height:44px;padding:0 4px;border:0;background:none;font:inherit;font-size:14px;font-weight:600;text-decoration:underline;cursor:pointer}
.tk-si-link:disabled{color:#8a7a99;text-decoration:none;cursor:default}
.tk-si-note{margin:4px 0 0;padding-top:16px;border-top:1px solid #F3E8F7;font-size:13px;line-height:1.55;color:#6B4A8A}
.tk-si-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px}
.tk-si-codes{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.tk-si-code{width:100%;min-width:0;min-height:56px;text-align:center;font-size:22px;font-weight:800;padding:0}
.tk-si-error{min-height:20px;margin:0;font-size:14px;color:#A8124F}
.tk-si-focus:focus-visible,.tk-si-in:focus-visible,.tk-si-role:focus-visible,.tk-si-tab:focus-visible,.tk-si-primary:focus-visible,.tk-si-link:focus-visible,.tk-si-close:focus-visible,.tk-si-check input:focus-visible{outline:3px solid #7C3AED;outline-offset:2px}
@media (max-width:820px){
  .tk-si-page{padding:24px 0 48px}
  .tk-si-card{grid-template-columns:minmax(0,1fr)}
  .tk-si-side{padding:16px 20px;gap:10px}
  .tk-si-eyebrow,.tk-si-pitch{display:none}
  .tk-si-points{gap:8px}
  .tk-si-point{padding:8px 12px;gap:10px;border-radius:12px}
  .tk-si-num{width:24px;height:24px;font-size:11px}
  .tk-si-point-text{font-size:13px}
  .tk-si-main{padding:24px 20px 28px;gap:16px}
  .tk-si-title{font-size:24px}
  .tk-si-codes{gap:6px}
  .tk-si-code{min-height:52px;font-size:20px}
}
@media (max-width:360px){.tk-si-code{font-size:18px}}
@media (prefers-reduced-motion:reduce){.tk-si *{transition:none !important;animation:none !important}}
`;
