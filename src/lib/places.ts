import "server-only";
import type { Lead } from "@/lib/types";

type PlacesResponse = {
  places?: {
    id: string;
    displayName?: { text: string };
    primaryTypeDisplayName?: { text: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
  }[];
  nextPageToken?: string;
};

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const PAGE_SIZE = 20;
/** Text Search returns at most 60 results across 3 pages. */
export const MAX_RESULTS = 60;

// Only request what the lead list needs: every extra field can move the call to a pricier SKU.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.primaryTypeDisplayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "nextPageToken",
].join(",");

export class PlacesError extends Error {}

/** Search Google Places for businesses in Pakistan, up to `limit` results. */
export async function searchPlaces(textQuery: string, limit: number): Promise<Lead[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new PlacesError("GOOGLE_PLACES_API_KEY is not set");

  const leads: Lead[] = [];
  let pageToken: string | undefined;
  const target = Math.min(limit, MAX_RESULTS);

  while (leads.length < target) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        pageSize: Math.min(PAGE_SIZE, target - leads.length),
        pageToken,
        regionCode: "PK",
        languageCode: "en",
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new PlacesError(`Places API ${res.status}: ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as PlacesResponse;
    for (const p of data.places ?? []) {
      leads.push({
        placeId: p.id,
        name: p.displayName?.text ?? "Unnamed business",
        category: p.primaryTypeDisplayName?.text ?? null,
        address: p.formattedAddress ?? null,
        phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
        website: p.websiteUri ?? null,
        rating: p.rating ?? null,
        reviewCount: p.userRatingCount ?? 0,
        mapsUrl: p.googleMapsUri ?? null,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return leads.slice(0, target);
}
