/**
 * The listing page keeps showing the old results while a new filter loads. This marks the page as busy (see listing-spec.css),
 * so the results dim a little and a thin bar runs along the top until the new results are in.
 */
export function setListingBusy(on: boolean) {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.setAttribute("data-ls-busy", "");
  else document.documentElement.removeAttribute("data-ls-busy");
}
