"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Heart, Menu, Search } from "lucide-react";
import { Logo } from "./Logo";
import { SearchModal } from "./SearchModal";
import { CityPicker } from "./CityPicker";
import { useCity } from "./CityContext";
import { Dialog } from "./ui/Dialog";
import { IconButton } from "./ui/IconButton";
import { Button } from "./ui/Button";
import { isStaffRole } from "@/lib/ui/api";
import { readSaved } from "./ui/SaveButton";
import { PlaceholderArt } from "./ui/PlaceholderArt";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string; stateSlug?: string };

export function Header({
  siteName,
  categories,
  cities,
  searchPlaceholder,
  postCta,
  user = null,
}: {
  siteName: string;
  countryName: string;
  categories: Cat[];
  cities: City[];
  searchPlaceholder: string;
  postCta: string;
  user?: { email: string; roles: string[] } | null;
}) {
  const path = usePathname() || "/";
  const { city } = useCity();
  const [search, setSearch] = useState(false);
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const [saved, setSaved] = useState(0);
  const onListing = categories.some((cat) => path === `/${cat.slug}` || path.startsWith(`/${cat.slug}/`));

  useEffect(() => {
    const sync = () => setSaved(readSaved().length);
    sync();
    window.addEventListener("tk-saved", sync);
    return () => window.removeEventListener("tk-saved", sync);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        event.preventDefault();
        setSearch(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearch(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cityLabel = city || "All India";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-[rgba(11,11,14,0.8)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-2 px-4 md:px-6 lg:gap-4 lg:px-8">
          <Logo name={siteName} />
          <button
            type="button"
            className="hidden h-11 min-w-0 flex-1 items-center rounded-md border border-line bg-surface px-3 text-left text-muted lg:flex"
            onClick={() => setSearch(true)}
          >
            <span className="truncate">Search jobs, homes, cars, pets... in {cityLabel}</span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Search" className="lg:hidden" onClick={() => setSearch(true)}>
              <Search />
            </IconButton>
            <button type="button" className="hidden h-11 items-center rounded-pill border border-line px-3 t-small sm:inline-flex" onClick={() => setPicker(true)}>
              {cityLabel}
            </button>
            <IconButton label={cityLabel} className="sm:hidden" onClick={() => setPicker(true)}>
              <span className="t-caption">{cityLabel.slice(0, 1)}</span>
            </IconButton>
            <Link href="/u/account/saved/" className="relative inline-grid size-11 place-items-center" aria-label="Saved ads">
              <Heart size={18} />
              {saved ? <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-pill bg-gold px-1 t-caption text-ink">{saved}</span> : null}
            </Link>
            <div className="relative">
              <button type="button" className="hidden h-11 items-center px-2 t-small lg:inline-flex" onClick={() => setAccount((v) => !v)}>
                Account
              </button>
              {account ? (
                <div className="absolute right-0 top-12 z-50 grid w-48 rounded-lg border border-line bg-surface p-2 shadow-md">
                  {user ? (
                    <>
                      <Link href="/u/account/dashboard/" className="min-h-11 px-2 py-2 t-small" onClick={() => setAccount(false)}>
                        Account
                      </Link>
                      {isStaffRole(user.roles) ? (
                        <Link href="/admin/" className="min-h-11 px-2 py-2 t-small" onClick={() => setAccount(false)}>
                          Admin
                        </Link>
                      ) : null}
                      <Link href="/u/logout/" className="min-h-11 px-2 py-2 t-small" onClick={() => setAccount(false)}>
                        Log out
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link href="/u/login/" className="min-h-11 px-2 py-2 t-small" onClick={() => setAccount(false)}>
                        Log in
                      </Link>
                      <Link href="/u/register/" className="min-h-11 px-2 py-2 t-small" onClick={() => setAccount(false)}>
                        Register
                      </Link>
                    </>
                  )}
                </div>
              ) : null}
            </div>
            <Button href="/u/post-insert/" className="hidden lg:inline-flex" prefetch={false}>
              {postCta}
            </Button>
            <IconButton label="Menu" className="lg:hidden" onClick={() => setMenu(true)}>
              <Menu />
            </IconButton>
          </div>
        </div>
        {onListing ? (
          <div className="border-t border-line">
            <div className="mx-auto flex w-full max-w-[1200px] gap-2 overflow-x-auto px-4 py-2 md:px-6 lg:px-8">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/${cat.slug}/`}
                  prefetch={false}
                  className={`inline-flex h-9 shrink-0 items-center rounded-pill border px-3 t-small ${path.startsWith(`/${cat.slug}`) ? "border-[color:var(--gold-line)] text-gold" : "border-line text-muted"}`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </header>
      {search ? (
        <SearchModal placeholder={searchPlaceholder} categories={categories} cities={cities} onClose={() => setSearch(false)} />
      ) : null}
      {picker ? <CityPicker cities={cities} onClose={() => setPicker(false)} /> : null}
      <Dialog open={menu} title="Menu" onClose={() => setMenu(false)} sheet>
        <div className="grid gap-4 pb-20">
          <h2 className="t-h3">Categories</h2>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <Link key={cat.slug} href={`/${cat.slug}/`} prefetch={false} onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-lg border border-line p-2">
                <span className="size-10 overflow-hidden rounded-md">
                  <PlaceholderArt seed={cat.slug} category={cat.slug} decorative />
                </span>
                <span className="t-small">{cat.name}</span>
              </Link>
            ))}
          </div>
          <Link href="/cities/" prefetch={false} className="t-small text-gold" onClick={() => setMenu(false)}>
            All cities
          </Link>
          {user ? (
            <Link href="/u/account/dashboard/" onClick={() => setMenu(false)}>
              Account
            </Link>
          ) : (
            <Link href="/u/login/" onClick={() => setMenu(false)}>
              Log in
            </Link>
          )}
        </div>
        <div className="sticky bottom-0 bg-raised pt-2">
          <Button href="/u/post-insert/" className="w-full" onClick={() => setMenu(false)}>
            {postCta}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
