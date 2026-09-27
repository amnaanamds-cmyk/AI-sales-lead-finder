import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getService } from "@/lib/services";
import type { Lead, LeadScore, PitchLanguage, PitchTone, SiteCheck } from "@/lib/types";

// Spec §8: a small, cheap model for bulk scoring and a stronger one only for pitches.
const SCORING_MODEL = process.env.ANTHROPIC_SCORING_MODEL ?? "claude-haiku-4-5";
const PITCH_MODEL = process.env.ANTHROPIC_PITCH_MODEL ?? "claude-opus-5";

export const SCORE_BATCH_SIZE = 10;

let client: Anthropic | null = null;
function anthropic() {
  client ??= new Anthropic();
  return client;
}

export class AiError extends Error {}

const ScoreSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      score: z.number().int(),
      reason: z.string(),
      main_gap: z.string(),
    }),
  ),
});

function describeLead(id: string, lead: Lead, check: SiteCheck) {
  const website = !check.hasSite
    ? "none"
    : check.siteLive === false
      ? "listed but does not load"
      : [
          "live",
          check.ssl ? "HTTPS" : "no HTTPS",
          check.mobileOk === false ? "not mobile-friendly" : check.mobileOk ? "mobile-friendly" : "mobile unknown",
        ].join(", ");
  const socials = Object.keys(check.socials);
  return {
    id,
    name: lead.name,
    category: lead.category,
    area: lead.address,
    rating: lead.rating,
    reviews: lead.reviewCount,
    website,
    socials: socials.length ? socials.join(", ") : "none found",
  };
}

/** Score up to SCORE_BATCH_SIZE leads in one call. Returns scores keyed by the ids you pass. */
export async function scoreLeads(
  serviceId: string,
  items: { id: string; lead: Lead; check: SiteCheck }[],
): Promise<Map<string, LeadScore>> {
  const service = getService(serviceId);
  const businesses = items.map(({ id, lead, check }) => describeLead(id, lead, check));

  const response = await anthropic().messages.parse({
    model: SCORING_MODEL,
    max_tokens: 4000,
    system:
      "You are a sales analyst for Pakistani freelancers. For each local business, score 0-100 how likely it is " +
      "to need the user's service AND be able to pay for it. Base the score only on the data given. " +
      "`reason` is one short sentence a freelancer can act on. `main_gap` names the single most useful gap " +
      "to mention in a pitch (for example: \"no website\", \"site not mobile-friendly\", \"only 12 Google reviews\"), " +
      "and must be true according to the data.",
    messages: [
      {
        role: "user",
        content:
          `The user is a ${service.noun}. ${service.fit}\n\n` +
          `Businesses (JSON):\n${JSON.stringify(businesses)}\n\n` +
          "Return one result per business id.",
      },
    ],
    output_config: { format: zodOutputFormat(ScoreSchema) },
  });

  if (!response.parsed_output) throw new AiError(`scoring failed (stop_reason: ${response.stop_reason})`);

  const scores = new Map<string, LeadScore>();
  for (const r of response.parsed_output.results) {
    scores.set(r.id, { score: Math.max(0, Math.min(100, Math.round(r.score))), reason: r.reason, mainGap: r.main_gap });
  }
  return scores;
}

const LANGUAGE_RULES: Record<PitchLanguage, string> = {
  en: "Write in simple, natural English as used in Pakistan.",
  ur: "Write in Urdu using Urdu (Nastaliq/Arabic) script. Keep brand and tech words like \"website\" or \"Instagram\" in English letters.",
  roman_ur:
    "Write in Roman Urdu (Urdu in Latin letters, the way Pakistanis text on WhatsApp, e.g. \"Assalam o Alaikum, umeed hai aap khairiyat se hon\").",
};

const TONE_RULES: Record<PitchTone, string> = {
  formal: "Tone: respectful and professional (use \"aap\" in Urdu).",
  friendly: "Tone: warm and friendly, still polite (use \"aap\" in Urdu).",
};

/** Write a short WhatsApp pitch for one lead (spec §8 pitch prompt). */
export async function writePitch(opts: {
  serviceId: string;
  senderName: string | null;
  lead: Lead;
  mainGap: string;
  language: PitchLanguage;
  tone: PitchTone;
}): Promise<string> {
  const service = getService(opts.serviceId);
  const { lead } = opts;
  const compliment =
    lead.rating != null && lead.reviewCount > 0
      ? `They are rated ${lead.rating.toFixed(1)} from ${lead.reviewCount} Google reviews.`
      : "No rating data; compliment something general and true, like serving the local area.";

  const response = await anthropic().beta.messages.create({
    model: PITCH_MODEL,
    max_tokens: 2000,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system:
      "You write short first-contact WhatsApp messages for Pakistani freelancers reaching out to local businesses. " +
      "Rules: at most 60 words. Greet, give one sincere compliment, mention the specific gap, briefly say how the " +
      "sender can help, and end with a soft question (not a hard sell). No fake claims, no invented numbers, " +
      "no prices, no links, no hashtags, no emojis beyond one at most. Output only the message text.",
    messages: [
      {
        role: "user",
        content: [
          `Sender: ${opts.senderName ?? "a local freelancer"}, a ${service.noun}.`,
          `Business: ${lead.name}${lead.category ? ` (${lead.category})` : ""}${lead.address ? `, ${lead.address}` : ""}.`,
          `Gap to mention: ${opts.mainGap}.`,
          compliment,
          LANGUAGE_RULES[opts.language],
          TONE_RULES[opts.tone],
        ].join("\n"),
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new AiError("pitch request was declined");
  const text = response.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
  if (!text) throw new AiError(`empty pitch (stop_reason: ${response.stop_reason})`);
  return text;
}
