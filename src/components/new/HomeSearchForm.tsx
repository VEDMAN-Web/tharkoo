import { Search } from "lucide-react";
import { searchPath, type UrlPaths } from "@/lib/urls";

type Option = { slug: string; name: string };

/**
 * H7.4: the search card under the home banner: keyword, city, category and the Search button.
 * A plain GET form to the search page, so it works without script and the results page reads the same fields.
 */
export function HomeSearchForm({
  paths,
  placeholder,
  labels,
  cities,
  categories,
}: {
  paths: UrlPaths;
  placeholder: string;
  labels: { keyword: string; city: string; category: string; allCities: string; allCategories: string; button: string };
  cities: Option[];
  categories: Option[];
}) {
  return (
    <form role="search" className="tkh-search" action={searchPath(paths)} method="get">
      <label className="tkh-field tkh-field-keyword">
        <Search size={18} aria-hidden />
        <span className="tkh-sr">{labels.keyword}</span>
        <input type="search" name="q" placeholder={placeholder || labels.keyword} autoComplete="off" />
      </label>
      <label className="tkh-field tkh-field-select">
        <span className="tkh-sr">{labels.city}</span>
        <select name="city" defaultValue="">
          <option value="">{labels.allCities}</option>
          {cities.map((city) => (
            <option key={city.slug} value={city.slug}>
              {city.name}
            </option>
          ))}
        </select>
      </label>
      <label className="tkh-field tkh-field-select">
        <span className="tkh-sr">{labels.category}</span>
        <select name="category" defaultValue="">
          <option value="">{labels.allCategories}</option>
          {categories.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="tkh-go">
        {labels.button}
      </button>
    </form>
  );
}
