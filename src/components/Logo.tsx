import Link from "next/link";

function Mark({ height = 25 }: { height?: number }) {
  const width = Math.round((height / 25) * 48);
  return (
    <svg width={width} height={height} viewBox="0 0 270 128" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        d="M200.027 45.0441C179.436 45.0441 153.214 68.3569 134.704 97.1499C132.214 101.018 128.044 128 200.027 128C253.498 128 272.412 112.857 258.343 92.5214C244.117 71.9569 226.225 45.0441 200.027 45.0441Z"
        fill="#448BC6"
      />
      <path
        fillRule="evenodd"
        d="M217.998 17.9702C217.998 8.045 209.947 0 200.028 0C190.096 0 182.054 8.045 182.054 17.9702C182.054 27.8954 190.096 35.9404 200.028 35.9404C209.947 35.9404 217.998 27.8954 217.998 17.9702Z"
        fill="#448BC6"
      />
      <path
        fillRule="evenodd"
        d="M48.6387 31.8361C51.7309 34.3616 55.6355 35.9404 59.943 35.9404C63.9688 35.9404 67.6473 34.5679 70.6445 32.3307C78.9581 33.7196 88.6475 31.9638 86.1384 31.3382C83.4982 30.6798 80.6123 23.7812 77.792 16.7484C77.5037 12.5883 75.8397 8.83116 73.1995 5.92565C69.9108 2.31261 65.2135 0 59.943 0C55.2916 0 51.0889 1.81471 47.9017 4.71366C44.7276 7.60606 42.6606 11.5499 42.1726 16.0048C38.0354 23.3587 33.1842 30.6798 30.9567 31.3382C28.6278 32.026 40.253 34.0602 48.6387 31.8361Z"
        fill="#BE206B"
      />
      <path
        fillRule="evenodd"
        d="M111.631 90.9809C97.402 70.4164 83.8736 57.0451 81.8165 54.988C80.421 53.5926 70.4336 44.5747 58.5987 45.0628C46.7637 44.5747 36.7763 53.5926 35.3776 54.988C33.3237 57.0451 19.7953 70.4164 5.56586 90.9809C-8.49979 111.313 2.60139 127.999 56.0731 127.999H61.1242C114.596 127.999 125.697 111.313 111.631 90.9809Z"
        fill="#BE206B"
      />
    </svg>
  );
}

export function Logo({
  name,
  href = "/",
  size = "md",
  country,
}: {
  name: string;
  href?: string | null;
  size?: "md" | "lg";
  country?: string;
}) {
  const mark = (
    <span className={`logo-lockup ${size === "lg" ? "logo-lockup-lg" : ""}`}>
      <span className="logo-row">
        <Mark height={size === "lg" ? 32 : 25} />
        <span className="logo-word">{name.toLowerCase()}</span>
      </span>
      {country ? <span className="logo-country">{country}</span> : null}
    </span>
  );
  if (!href) return mark;
  return (
    <Link href={href} className="logo-mark-link" title={name}>
      {mark}
    </Link>
  );
}
