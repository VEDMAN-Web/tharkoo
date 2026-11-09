import Link from "next/link";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string };

export function Footer({
  siteName,
  legalName,
  cityCount,
  about,
  categories,
  cities,
}: {
  siteName: string;
  legalName: string;
  cityCount: number;
  about: string;
  categories: Cat[];
  cities: City[];
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
  ] as const;
  const top = cities.slice(0, 5);

  return (
    <footer className="mt-10 bg-white">
      <div className="container-site border-t py-8">
        <p className="text-sm leading-6 text-[#555]">{about}</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((cat) => (
            <div key={cat.slug}>
              <Link href={`/${cat.slug}/`} className="font-bold text-[#222] no-underline hover:underline">
                {cat.name}
              </Link>
              <ul className="mt-2 space-y-1 text-sm">
                {top.map((city) => (
                  <li key={city.slug}>
                    <Link href={`/${cat.slug}/${city.slug}/`}>
                      {cat.name} {city.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href={`/${cat.slug}/`}>All cities</Link>
                </li>
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-t pt-4 text-xs text-[#777]">
          {links.map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
          <span>
            {cityCount} cities · © {new Date().getFullYear()} {legalName} · {siteName}
          </span>
        </div>
      </div>
    </footer>
  );
}
