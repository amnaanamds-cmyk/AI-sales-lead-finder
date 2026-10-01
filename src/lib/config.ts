/** Which outside services are set up. Missing ones switch features off or to fallbacks. */
export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Local development without a Google Places key: search the built-in sample businesses
 * instead. Only when explicitly switched on, never silently in production.
 */
export function sampleDataMode() {
  return !process.env.GOOGLE_PLACES_API_KEY && process.env.LEADNAMA_SAMPLE_DATA === "1";
}

export function dataAttribution() {
  return sampleDataMode() ? "Sample businesses (development mode). Names and numbers are fictional." : "Business data © Google";
}
