/** A business as returned to the browser. Fetched live, never stored (see docs/PROJECT.md §11). */
export type Lead = {
  placeId: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number;
  mapsUrl: string | null;
};
