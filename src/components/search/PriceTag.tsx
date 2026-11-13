import { formatPrice } from "./price";

/** The asking price on a result card. Renders nothing when the ad has no price. */
export function PriceTag({ price }: { price?: number | null }) {
  const text = formatPrice(price);
  if (!text) return null;
  return (
    <span className="tk-card-price" data-tk="card-price" style={{ fontWeight: 600 }}>
      {text}
    </span>
  );
}
