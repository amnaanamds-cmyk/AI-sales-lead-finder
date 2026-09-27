/** Plans, prices and feature gates (docs/PROJECT.md §9). Keep allowances in sync with `plan_allowance()` in SQL. */

export type Plan = "free" | "freelancer" | "agency";

export const PLANS: Record<Plan, { name: string; pricePkr: number; leads: number; blurb: string }> = {
  free: { name: "Free", pricePkr: 0, leads: 20, blurb: "English pitches only" },
  freelancer: { name: "Freelancer", pricePkr: 1500, leads: 300, blurb: "All languages, pipeline board" },
  agency: { name: "Agency", pricePkr: 5000, leads: 1500, blurb: "Everything, plus CSV exports" },
};

/** Pay-as-you-go packs. Product id encodes the credit count: `pack_<credits>`. */
export const PACKS = [
  { id: "pack_100", credits: 100, pricePkr: 600 },
  { id: "pack_500", credits: 500, pricePkr: 2500 },
] as const;

export type ProductId = "freelancer" | "agency" | (typeof PACKS)[number]["id"];

export function productPrice(id: string): { pricePkr: number; label: string } | null {
  if (id === "freelancer" || id === "agency") {
    return { pricePkr: PLANS[id].pricePkr, label: `LeadNama ${PLANS[id].name} (30 days)` };
  }
  const pack = PACKS.find((p) => p.id === id);
  return pack ? { pricePkr: pack.pricePkr, label: `LeadNama ${pack.credits} lead credits` } : null;
}

const RANK: Record<Plan, number> = { free: 0, freelancer: 1, agency: 2 };

export const FEATURES = {
  allLanguages: "freelancer",
  pipeline: "freelancer",
  csvExport: "agency",
} as const satisfies Record<string, Plan>;

export function canUse(plan: Plan, feature: keyof typeof FEATURES): boolean {
  return RANK[plan] >= RANK[FEATURES[feature]];
}
