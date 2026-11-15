import type { ReactElement } from "react";
import { Globe } from "lucide-react";
import "./CountryFlag.css";

/**
 * H7.4d: a small inline SVG flag per country (16 x 12, radius 2). Emoji flags show as letters on Windows, so the site
 * draws its own. The set is simplified (no fine detail). A country without a drawing shows a neutral globe.
 */
const W = 16;
const H = 12;

const STRIPES_US = Array.from({ length: 13 }, (_, index) => (
  <rect key={`us-${index}`} x="0" y={(index * H) / 13} width={W} height={H / 13} fill={index % 2 === 0 ? "#B22234" : "#FFFFFF"} />
));

const DRAWINGS: Record<string, ReactElement[]> = {
  IN: [
    <rect key="top" width={W} height="4" fill="#FF9933" />,
    <rect key="mid" y="4" width={W} height="4" fill="#FFFFFF" />,
    <rect key="bottom" y="8" width={W} height="4" fill="#138808" />,
    <circle key="wheel" cx="8" cy="6" r="1.5" fill="none" stroke="#000080" strokeWidth="0.4" />,
  ],
  US: [...STRIPES_US, <rect key="canton" width="7" height={(H * 7) / 13} fill="#3C3B6E" />],
  GB: [
    <rect key="blue" width={W} height={H} fill="#012169" />,
    <path key="diag-white" d="M0 0L16 12M16 0L0 12" stroke="#FFFFFF" strokeWidth="2.4" />,
    <path key="diag-red" d="M0 0L16 12M16 0L0 12" stroke="#C8102E" strokeWidth="0.9" />,
    <path key="cross-white" d="M8 0V12M0 6H16" stroke="#FFFFFF" strokeWidth="4" />,
    <path key="cross-red" d="M8 0V12M0 6H16" stroke="#C8102E" strokeWidth="2" />,
  ],
  AE: [
    <rect key="green" width={W} height="4" fill="#00732F" />,
    <rect key="white" y="4" width={W} height="4" fill="#FFFFFF" />,
    <rect key="black" y="8" width={W} height="4" fill="#000000" />,
    <rect key="red" width="4" height={H} fill="#FF0000" />,
  ],
  SG: [
    <rect key="red" width={W} height="6" fill="#EF3340" />,
    <rect key="white" y="6" width={W} height="6" fill="#FFFFFF" />,
    <circle key="moon" cx="4.5" cy="3" r="1.6" fill="#FFFFFF" />,
    <circle key="moon-cut" cx="5" cy="3" r="1.4" fill="#EF3340" />,
  ],
  PK: [
    <rect key="green" width={W} height={H} fill="#01411C" />,
    <rect key="stripe" width="4" height={H} fill="#FFFFFF" />,
    <circle key="moon" cx="10.5" cy="6" r="2.4" fill="#FFFFFF" />,
    <circle key="moon-cut" cx="11.2" cy="5.4" r="2.1" fill="#01411C" />,
  ],
  CA: [
    <rect key="white" width={W} height={H} fill="#FFFFFF" />,
    <rect key="left" width="4" height={H} fill="#D52B1E" />,
    <rect key="right" x="12" width="4" height={H} fill="#D52B1E" />,
  ],
  BD: [
    <rect key="green" width={W} height={H} fill="#006A4E" />,
    <circle key="disc" cx="7" cy="6" r="3.2" fill="#F42A41" />,
  ],
};

/** The flag for a two-letter country code. Unknown codes and empty values show a neutral globe. */
export function CountryFlag({ code }: { code?: string | null }) {
  const key = String(code ?? "").trim().toUpperCase();
  const drawing = DRAWINGS[key];
  if (!drawing) {
    return (
      <span className="tkn-flag tkn-flag-none" aria-hidden="true">
        <Globe size={12} strokeWidth={2} focusable="false" />
      </span>
    );
  }
  return (
    <svg className="tkn-flag" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      <clipPath id={`tkn-flag-${key}`}>
        <rect width={W} height={H} rx="2" />
      </clipPath>
      <g clipPath={`url(#tkn-flag-${key})`}>{drawing}</g>
    </svg>
  );
}
