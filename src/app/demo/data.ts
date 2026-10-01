import type { Lead, SiteCheck } from "@/lib/types";

/**
 * Fictional sample businesses for the demo. Names, numbers and websites are made up;
 * websites use the reserved .example domain and numbers the unused +92 300 0000xxx range.
 */
type Row = [
  name: string,
  category: string,
  area: string,
  city: string,
  rating: number | null,
  reviews: number,
  site: "none" | "down" | "nossl" | "nomobile" | "good" | "facebook",
  socials: string,
];

const ROWS: Row[] = [
  ["Khyber Tikka House", "Restaurant", "University Road", "Peshawar", 4.6, 412, "none", ""],
  ["Namak Mandi Karahi Point", "Restaurant", "University Road", "Peshawar", 4.4, 236, "facebook", "facebook"],
  ["Chapli Corner", "Restaurant", "Saddar", "Peshawar", 4.2, 98, "nomobile", "facebook"],
  ["Hayatabad Grill & BBQ", "Restaurant", "Hayatabad", "Peshawar", 4.5, 187, "good", "facebook,instagram"],
  ["Qissa Khwani Chai Khana", "Cafe", "Saddar", "Peshawar", 4.7, 64, "none", ""],
  ["Frontier Pizza Co.", "Restaurant", "Hayatabad", "Peshawar", 3.9, 151, "nossl", "facebook"],
  ["Glamour Beauty Salon", "Beauty salon", "University Road", "Peshawar", 4.3, 57, "none", "instagram"],
  ["Royal Barbers", "Barber shop", "Hayatabad", "Peshawar", 4.8, 23, "none", ""],
  ["Shifa Medical Store", "Pharmacy", "University Road", "Peshawar", 4.1, 140, "none", ""],
  ["Iron Fit Gym", "Gym", "Hayatabad", "Peshawar", 4.4, 89, "down", "instagram"],
  ["Peshawar Dental Care", "Dental clinic", "University Road", "Peshawar", 4.9, 31, "nomobile", ""],
  ["Gandhara Sweets & Bakers", "Bakery", "Saddar", "Peshawar", 4.5, 520, "none", "facebook"],
  ["Sarhad Real Estate", "Real estate agency", "Hayatabad", "Peshawar", 4.0, 12, "nossl", "facebook"],
  ["Little Stars Montessori", "School", "Hayatabad", "Peshawar", 4.6, 44, "facebook", "facebook"],

  ["Gulberg Desi Kitchen", "Restaurant", "Gulberg", "Lahore", 4.5, 860, "good", "facebook,instagram,tiktok"],
  ["Lakshmi Chowk Nihari", "Restaurant", "Gulberg", "Lahore", 4.6, 1240, "none", "facebook"],
  ["Café Anarkali", "Cafe", "Gulberg", "Lahore", 4.3, 310, "nomobile", "instagram"],
  ["DHA Burger Lab", "Restaurant", "DHA", "Lahore", 4.1, 205, "nossl", "instagram"],
  ["Johar Town Shawarma", "Restaurant", "Johar Town", "Lahore", 4.4, 77, "none", ""],
  ["Noor Bridal Studio", "Beauty salon", "DHA", "Lahore", 4.7, 132, "facebook", "facebook,instagram"],
  ["Zara Hair & Beauty", "Beauty salon", "Johar Town", "Lahore", 4.2, 18, "none", ""],
  ["PowerHouse Fitness", "Gym", "Johar Town", "Lahore", 4.0, 264, "good", "instagram"],
  ["Lahore Physio Clinic", "Clinic", "Gulberg", "Lahore", 4.8, 39, "none", ""],
  ["Kashmiri Shawls House", "Clothing store", "Gulberg", "Lahore", 4.5, 58, "down", "facebook"],
  ["Rehmat Pharmacy", "Pharmacy", "DHA", "Lahore", 4.2, 330, "nossl", ""],
  ["Bake n Brew", "Bakery", "DHA", "Lahore", 4.6, 143, "facebook", "facebook,instagram"],
  ["Shalimar Properties", "Real estate agency", "DHA", "Lahore", 4.3, 26, "nomobile", "facebook"],

  ["Clifton Seafood Shack", "Restaurant", "Clifton", "Karachi", 4.3, 690, "nossl", "facebook,instagram"],
  ["Burns Road Bun Kabab", "Restaurant", "Saddar", "Karachi", 4.7, 1530, "none", ""],
  ["Tariq Road Biryani Centre", "Restaurant", "Tariq Road", "Karachi", 4.4, 405, "facebook", "facebook"],
  ["Sea Breeze Café", "Cafe", "Clifton", "Karachi", 4.0, 222, "good", "instagram,facebook"],
  ["Gulshan Chai Adda", "Cafe", "Gulshan-e-Iqbal", "Karachi", 4.5, 71, "none", "instagram"],
  ["Mehndi & Makeup by Sana", "Beauty salon", "Gulshan-e-Iqbal", "Karachi", 4.9, 48, "none", "instagram"],
  ["Gentlemen's Cut", "Barber shop", "Clifton", "Karachi", 4.4, 112, "nomobile", "instagram"],
  ["FitZone Karachi", "Gym", "Gulshan-e-Iqbal", "Karachi", 3.8, 176, "down", "facebook"],
  ["Al-Shifa Family Clinic", "Clinic", "Tariq Road", "Karachi", 4.1, 94, "none", ""],
  ["Karachi Fabrics", "Clothing store", "Tariq Road", "Karachi", 4.2, 63, "facebook", "facebook"],
  ["Sweet Tooth Bakery", "Bakery", "Gulshan-e-Iqbal", "Karachi", 4.6, 288, "nossl", "facebook,instagram"],
  ["Seaview Realtors", "Real estate agency", "Clifton", "Karachi", 4.4, 35, "good", "facebook"],

  ["Afghan Kabuli Pulao House", "Restaurant", "University Road", "Peshawar", 4.3, 156, "none", ""],
  ["Tehkal Fried Fish", "Restaurant", "University Road", "Peshawar", 4.1, 73, "nossl", "facebook"],
  ["Board Bazaar Shinwari", "Restaurant", "University Road", "Peshawar", 4.7, 298, "facebook", "facebook,tiktok"],
  ["Cafe Arbab", "Cafe", "University Road", "Peshawar", 4.0, 42, "nomobile", "instagram"],
  ["Hira Ladies Salon", "Beauty salon", "Gulberg", "Lahore", 4.4, 211, "none", "facebook"],
  ["The Mane Studio", "Beauty salon", "Gulberg", "Lahore", 4.6, 88, "good", "instagram,facebook"],
  ["Model Town Beauty Lounge", "Beauty salon", "Model Town", "Lahore", 3.9, 34, "nossl", ""],
  ["Gold's Arena Gym", "Gym", "Clifton", "Karachi", 4.5, 402, "good", "instagram,facebook"],
  ["Lyari Boxing & Fitness", "Gym", "Lyari", "Karachi", 4.8, 27, "none", "facebook"],
  ["Defence Strength Club", "Gym", "DHA", "Karachi", 4.2, 133, "nomobile", "instagram"],
  ["Kohsar Chai House", "Cafe", "F-7", "Islamabad", 4.3, 96, "none", "instagram"],
  ["G-9 Coffee Corner", "Cafe", "G-9", "Islamabad", 4.1, 38, "nossl", ""],
  ["F-7 Bistro", "Restaurant", "F-7", "Islamabad", 4.5, 540, "good", "instagram,facebook"],
  ["Margalla Karahi", "Restaurant", "G-9", "Islamabad", 4.3, 167, "none", "facebook"],
  ["Blue Area Coffee Co.", "Cafe", "Blue Area", "Islamabad", 4.6, 205, "nomobile", "instagram"],
  ["Capital Smiles Dental", "Dental clinic", "F-7", "Islamabad", 4.8, 72, "nossl", ""],
  ["Elegance Salon & Spa", "Beauty salon", "F-7", "Islamabad", 4.5, 129, "facebook", "facebook,instagram"],
  ["G-9 Fitness Club", "Gym", "G-9", "Islamabad", 4.1, 58, "none", ""],
  ["Islamabad Prime Estates", "Real estate agency", "Blue Area", "Islamabad", 4.2, 19, "none", "facebook"],
  ["Hill View Pharmacy", "Pharmacy", "G-9", "Islamabad", 4.0, 85, "none", ""],
  ["Daily Bread Bakers", "Bakery", "F-7", "Islamabad", 4.4, 310, "down", "facebook"],
];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export type DemoBusiness = { lead: Lead; check: SiteCheck };

export const DEMO_BUSINESSES: DemoBusiness[] = ROWS.map((r, i) => {
  const [name, category, area, city, rating, reviews, site, socials] = r;
  const id = `demo-${slug(name)}`;
  const socialMap = Object.fromEntries(
    socials
      .split(",")
      .filter(Boolean)
      .map((s) => [s, `https://www.${s}.com/${slug(name).replace(/-/g, "")}`]),
  );
  const website =
    site === "none" ? null : site === "facebook" ? socialMap.facebook ?? null : `https://${slug(name)}.example`;
  const check: SiteCheck =
    site === "none" || site === "facebook"
      ? { hasSite: false, siteLive: null, ssl: null, mobileOk: null, socials: socialMap }
      : site === "down"
        ? { hasSite: true, siteLive: false, ssl: false, mobileOk: null, socials: socialMap }
        : { hasSite: true, siteLive: true, ssl: site !== "nossl", mobileOk: site !== "nomobile", socials: socialMap };
  // Every third business has a landline (no WhatsApp), like real listings.
  const phone = i % 3 === 2 ? `+92 ${city === "Karachi" ? "21" : city === "Lahore" ? "42" : city === "Islamabad" ? "51" : "91"} 0000${String(100 + i)}` : `+92 300 0000${String(100 + i)}`;
  return {
    lead: {
      placeId: id,
      name,
      category,
      address: `${area}, ${city}`,
      phone,
      website,
      rating,
      reviewCount: reviews,
      mapsUrl: null,
    },
    check,
  };
});

const SYNONYMS: Record<string, string[]> = {
  restaurant: ["restaurant", "food", "karahi", "biryani", "bbq", "pizza", "burger", "dhaba", "hotel"],
  cafe: ["cafe", "café", "coffee", "chai", "tea"],
  salon: ["salon", "beauty", "parlour", "parlor", "makeup", "bridal", "spa"],
  barber: ["barber", "hair"],
  gym: ["gym", "fitness"],
  pharmacy: ["pharmacy", "medical store", "chemist"],
  clinic: ["clinic", "doctor", "dental", "dentist", "physio", "hospital"],
  bakery: ["bakery", "bakers", "sweets", "cake"],
  "real estate": ["real estate", "property", "properties", "estate", "realtor"],
  "clothing store": ["clothing", "boutique", "fashion", "shawl", "fabric"],
  school: ["school", "montessori", "academy"],
};

/** Simple local search over the sample data: category words + city (+ optional area). */
export function searchDemo(category: string, area: string, city: string): DemoBusiness[] {
  const words = category.toLowerCase().replace(/s\b/g, "").split(/[\s,]+/).filter(Boolean);
  const terms = new Set<string>(words);
  for (const [key, list] of Object.entries(SYNONYMS)) {
    if (list.some((s) => words.some((w) => s.startsWith(w) || w.startsWith(s.replace(/s$/, ""))))) {
      list.forEach((s) => terms.add(s));
      terms.add(key);
    }
  }
  const c = city.trim().toLowerCase();
  const a = area.trim().toLowerCase();
  return DEMO_BUSINESSES.filter(({ lead }) => {
    const hay = `${lead.category} ${lead.name}`.toLowerCase();
    const addr = (lead.address ?? "").toLowerCase();
    return (
      (!c || addr.includes(c)) &&
      (!a || addr.includes(a)) &&
      [...terms].some((t) => hay.includes(t))
    );
  });
}
