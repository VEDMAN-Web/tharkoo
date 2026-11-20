/** H17.6: the alt text of an ad photo, "{ad title}, {area or city}, photo N". A photo-less word for an ad without a title. */
export function adPhotoAlt(title: string, place: string, number: number): string {
  const name = title.trim() || "Ad";
  const where = place.trim();
  return where ? `${name}, ${where}, photo ${number}` : `${name}, photo ${number}`;
}

/** H17.6: how many cards at the start of a list count as the first row; only their first photo loads eagerly. */
export const FIRST_ROW_CARDS = 4;
