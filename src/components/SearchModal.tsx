"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { useFocusTrap } from "./ui/useFocusTrap";
import { api } from "@/lib/ui/api";

type Cat = { slug: string; name: string; fields?: { key: string; label: string; type: string; options?: string[] }[] };
type City = { slug: string; name: string; stateSlug?: string; id?: string };
type Region = { slug: string; name: string; id?: string };

export function SearchModal({
  categories,
  onClose,
}: {
  placeholder?: string;
  categories: Cat[];
  cities?: City[];
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useFocusTrap<HTMLFormElement>(true, onClose);
  const [cats, setCats] = useState<Cat[]>(categories);
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [category, setCategory] = useState(categories[0]?.slug || "");
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [districts, setDistricts] = useState<{ slug: string; name: string }[]>([]);
  const [verified, setVerified] = useState(false);
  const [photos, setPhotos] = useState(false);
  const [openRow, setOpenRow] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    api<{ categories: Cat[] }>("/api/categories").then((res) => {
      if (res.ok && res.data.categories?.length) setCats(res.data.categories);
    });
    api<{ locations: Region[] }>("/api/locations?type=state").then((res) => {
      if (res.ok) setRegions(res.data.locations || []);
    });
    api<{ locations: City[] }>("/api/locations?type=city").then((res) => {
      if (res.ok) setCities(res.data.locations || []);
    });
    const id = window.setTimeout(() => {
      try {
        const stored = JSON.parse(localStorage.getItem("tk-recent-q") || "[]");
        if (Array.isArray(stored)) setRecent(stored.slice(0, 6));
      } catch {
        /* ignore stored searches */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const cityOptions = useMemo(
    () => cities.filter((item) => !region || item.stateSlug === region),
    [cities, region],
  );

  useEffect(() => {
    if (!city) {
      const id = window.setTimeout(() => {
        setDistricts([]);
        setDistrict("");
      }, 0);
      return () => window.clearTimeout(id);
    }
    const found = cities.find((item) => item.slug === city);
    if (!found?.id) return;
    api<{ locations: { slug: string; name: string }[] }>(`/api/locations/${found.id}/children`).then((res) => {
      if (res.ok) setDistricts((res.data.locations || []).filter((item) => item.slug));
    });
  }, [city, cities]);

  const current = cats.find((item) => item.slug === category) || cats[0];
  const fieldRows = (current?.fields || [])
    .filter((field) => field.type === "select" && field.options?.length)
    .slice(0, 4);

  function reset() {
    setQ("");
    setRegion("");
    setCity("");
    setDistrict("");
    setVerified(false);
    setPhotos(false);
    setPicked({});
    setCategory(cats[0]?.slug || "");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = q.trim();
    if (text) {
      const next = [text, ...recent.filter((item) => item !== text)].slice(0, 6);
      localStorage.setItem("tk-recent-q", JSON.stringify(next));
    }
    if (category && city && !text) {
      router.push(`/${category}/${city}/`);
      onClose();
      return;
    }
    const params = new URLSearchParams();
    if (text) params.set("q", text);
    if (category) params.set("category", category);
    if (city) params.set("city", city);
    if (verified) params.set("verified", "1");
    if (photos) params.set("photos", "1");
    router.push(`/search/?${params.toString()}`);
    onClose();
  }

  return (
    <div className="tk-modal-back" onClick={onClose}>
      <form
        className="tk-modal"
        data-tk="search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        ref={ref}
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="tk-modal-head">
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <Search size={14} /> Search
          </span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: "none", border: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div className="tk-modal-body">
          <div className="tk-modal-grid">
            <select data-tk="search-category" aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
              {cats.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
            <input data-tk="search-text" aria-label="Search here" placeholder="Search here..." value={q} onChange={(event) => setQ(event.target.value)} />
          </div>
          {recent.length ? (
            <div className="tk-filters" aria-label="Recent searches">
              {recent.map((item) => (
                <button key={item} type="button" className="tk-filter" onClick={() => setQ(item)}>
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          <div className="tk-modal-grid three">
            <select data-tk="search-region" aria-label="Select Region" value={region} onChange={(event) => { setRegion(event.target.value); setCity(""); }}>
              <option value="">Select Region</option>
              {regions.map((item) => (
                <option key={item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
            <select data-tk="search-city" aria-label="All the cities" value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">All the cities</option>
              {cityOptions.map((item) => (
                <option key={item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
            <select data-tk="search-district" aria-label="Select District" value={district} disabled={!city} onChange={(event) => setDistrict(event.target.value)}>
              <option value="">Select District</option>
              {districts.map((item) => (
                <option key={item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
          </div>
          <p style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 700, marginTop: 16 }}>
            <SlidersHorizontal size={20} /> Filters
          </p>
          <FilterRow label="Verification" open={openRow === "verified"} onToggle={() => setOpenRow(openRow === "verified" ? "" : "verified")}>
            <button type="button" className={`tk-filter ${verified ? "is-on" : ""}`} onClick={() => setVerified((v) => !v)}>
              Verified profiles only
            </button>
          </FilterRow>
          <FilterRow label="Photos" open={openRow === "photos"} onToggle={() => setOpenRow(openRow === "photos" ? "" : "photos")}>
            <button type="button" className={`tk-filter ${photos ? "is-on" : ""}`} onClick={() => setPhotos((v) => !v)}>
              With photos only
            </button>
          </FilterRow>
          {fieldRows.map((field) => (
            <FilterRow key={field.key} label={field.label} open={openRow === field.key} onToggle={() => setOpenRow(openRow === field.key ? "" : field.key)}>
              {(field.options || []).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`tk-filter ${picked[field.key] === option ? "is-on" : ""}`}
                  onClick={() => setPicked((prev) => ({ ...prev, [field.key]: prev[field.key] === option ? "" : option }))}
                >
                  {option}
                </button>
              ))}
            </FilterRow>
          ))}
        </div>
        <div className="tk-modal-foot">
          <button type="button" className="tk-text-btn" data-tk="search-delete-all" onClick={reset}>
            DELETE ALL
          </button>
          <button type="submit" className="tk-btn tk-btn-rose" data-tk="search-submit">
            <Search size={14} /> SEARCH
          </button>
        </div>
      </form>
    </div>
  );
}

function FilterRow({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button type="button" className={`tk-filter-row ${open ? "open" : ""}`} aria-expanded={open} onClick={onToggle}>
        <span>{label}</span>
        <ChevronRight size={14} />
      </button>
      {open ? <div className="tk-filters">{children}</div> : null}
    </div>
  );
}
