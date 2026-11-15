/**
 * H7.4b: the search form inside a listing title band. A plain GET form to the search page, so it works without
 * JavaScript. It keeps the category (and the city, when there is one) so the search stays inside this listing.
 */
export function ListingSearchForm({
  action,
  categorySlug,
  citySlug,
  placeholder,
}: {
  action: string;
  categorySlug: string;
  citySlug?: string;
  placeholder: string;
}) {
  return (
    <form role="search" action={action} method="get" className="tkn-search-glass tkn-ls-search">
      <label className="tkn-ls-field">
        <span className="tkn-sr">Search keyword</span>
        <input type="search" name="q" placeholder={placeholder} autoComplete="off" />
      </label>
      <input type="hidden" name="category" value={categorySlug} />
      {citySlug ? <input type="hidden" name="city" value={citySlug} /> : null}
      <button type="submit" className="tkn-ls-go">
        Search
      </button>
    </form>
  );
}
