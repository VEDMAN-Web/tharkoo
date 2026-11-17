const GREY = "var(--adm-line2)";
const LINE = "var(--adm-line)";
const HOT = "var(--adm-primary-soft)";
const HOT_LINE = "var(--adm-primary)";

/** A small drawing of the page with the part the picture fills in pink. It is only an aid: the real crop is the preview next to it. */
export function WhereItShows({ spot }: { spot: "tile" | "banner" | "phone" }) {
  if (spot === "phone") {
    return (
      <svg viewBox="0 0 90 150" role="img" aria-label="A phone: the picture fills the top of the category page" data-tk="where-phone">
        <rect x="14" y="4" width="62" height="142" rx="10" fill="#fff" stroke={LINE} strokeWidth="2" />
        <rect x="20" y="12" width="50" height="62" rx="4" fill={HOT} stroke={HOT_LINE} strokeWidth="1.5" strokeDasharray="3 2" />
        <rect x="22" y="82" width="38" height="5" rx="2.5" fill={LINE} />
        <rect x="22" y="93" width="46" height="4" rx="2" fill={GREY} />
        <rect x="22" y="104" width="46" height="14" rx="3" fill={GREY} />
        <rect x="22" y="123" width="46" height="14" rx="3" fill={GREY} />
      </svg>
    );
  }
  if (spot === "banner") {
    return (
      <svg viewBox="0 0 190 120" role="img" aria-label="A computer page: the picture fills the top of the category page" data-tk="where-banner">
        <rect x="2" y="2" width="186" height="116" rx="8" fill="#fff" stroke={LINE} strokeWidth="2" />
        <rect x="2" y="2" width="186" height="14" rx="8" fill={GREY} />
        <rect x="9" y="22" width="172" height="34" rx="3" fill={HOT} stroke={HOT_LINE} strokeWidth="1.5" strokeDasharray="4 3" />
        <rect x="9" y="64" width="70" height="6" rx="3" fill={LINE} />
        <rect x="9" y="78" width="54" height="30" rx="3" fill={GREY} />
        <rect x="68" y="78" width="54" height="30" rx="3" fill={GREY} />
        <rect x="127" y="78" width="54" height="30" rx="3" fill={GREY} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 190 120" role="img" aria-label="The Home page: the picture is the tile of this category" data-tk="where-tile">
      <rect x="2" y="2" width="186" height="116" rx="8" fill="#fff" stroke={LINE} strokeWidth="2" />
      <rect x="2" y="2" width="186" height="14" rx="8" fill={GREY} />
      <rect x="9" y="22" width="172" height="20" rx="3" fill={GREY} />
      <rect x="9" y="52" width="54" height="56" rx="3" fill={HOT} stroke={HOT_LINE} strokeWidth="1.5" strokeDasharray="4 3" />
      <rect x="68" y="52" width="54" height="56" rx="3" fill={GREY} />
      <rect x="127" y="52" width="54" height="56" rx="3" fill={GREY} />
    </svg>
  );
}
