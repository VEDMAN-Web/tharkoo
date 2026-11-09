import Link from "next/link";

export function Footer({
  siteName,
  legalName,
  cityCount,
  about,
}: {
  siteName: string;
  legalName: string;
  cityCount: number;
  about: string;
}) {
  const links = [
    ["About", "/about"],
    ["Help centre", "/help"],
    ["Submit a report", "/submit-report"],
    ["How to report a scam", "/help#scams"],
    ["Terms", "/terms"],
    ["Privacy", "/privacy"],
    ["Cookies", "/cookies"],
    ["Grievance officer", "/grievance"],
    ["Cities", "/cities"],
  ] as const;

  return (
    <footer className="mt-12 border-t bg-white">
      <div className="container-site grid gap-6 py-8 md:grid-cols-3">
        <div>
          <p className="font-semibold">{siteName}</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{about}</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="text-[var(--text-secondary)]">
              {label}
            </Link>
          ))}
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {cityCount} cities in India · © {new Date().getFullYear()} {legalName}
        </p>
      </div>
    </footer>
  );
}
