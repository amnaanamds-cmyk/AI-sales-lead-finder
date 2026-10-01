import "server-only";
import { DEMO_BUSINESSES, searchDemo } from "@/app/demo/data";
import { sampleDataMode } from "@/lib/config";
import type { Lead } from "@/lib/types";

type PlaceResult = {
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
};

type PlacesResponse = { places?: PlaceResult[]; nextPageToken?: string };

function toLead(p: PlaceResult): Lead {
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "Unnamed business",
    category: p.primaryTypeDisplayName?.text ?? null,
    address: p.formattedAddress ?? null,
    phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? 0,
    mapsUrl: p.googleMapsUri ?? null,
  };
}

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

/** Find businesses by type and location: Google Places, or the sample data in sample-data mode. */
export async function searchBusinesses(
  q: { category: string; area: string; city: string },
  limit: number,
): Promise<{ query: string; leads: Lead[] }> {
  const location = [q.area, q.city].filter(Boolean).join(", ");
  const query = `${q.category} in ${location}, Pakistan`;
  if (sampleDataMode()) {
    return { query: `${query} (sample data)`, leads: searchDemo(q.category, q.area, q.city).slice(0, limit).map((b) => b.lead) };
  }
  return { query, leads: await searchPlaces(query, limit) };
}

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
        pageSize: PAGE_SIZE, // must stay the same across pages of one search
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
    leads.push(...(data.places ?? []).map(toLead));

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return leads.slice(0, target);
}

const DETAILS_FIELD_MASK = FIELD_MASK.split(",")
  .filter((f) => f.startsWith("places."))
  .map((f) => f.slice("places.".length))
  .join(",");

/** Fetch one place's current details by id (Place Details, New). Returns null if it's gone. */
export async function getPlaceDetails(placeId: string): Promise<Lead | null> {
  if (sampleDataMode()) return DEMO_BUSINESSES.find((b) => b.lead.placeId === placeId)?.lead ?? null;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new PlacesError("GOOGLE_PLACES_API_KEY is not set");

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en&regionCode=PK`,
    {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": DETAILS_FIELD_MASK },
      cache: "no-store",
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new PlacesError(`Place Details ${res.status}`);
  return toLead((await res.json()) as PlaceResult);
}

/** Fetch details for many places with limited concurrency. Missing places are skipped. */
export async function getManyPlaceDetails(placeIds: string[], concurrency = 8): Promise<Map<string, Lead>> {
  const out = new Map<string, Lead>();
  let next = 0;
  async function worker() {
    while (next < placeIds.length) {
      const id = placeIds[next++];
      try {
        const lead = await getPlaceDetails(id);
        if (lead) out.set(id, lead);
      } catch (err) {
        console.error(err);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, placeIds.length) }, worker));
  return out;
}
