"use client";

import { realApi } from "@/lib/api.real";
import { LeadSearch } from "./LeadSearch";

/** LeadSearch wired to the real backend (functions can't be passed from a server component). */
export function SearchClient(props: Omit<React.ComponentProps<typeof LeadSearch>, "api">) {
  return <LeadSearch {...props} api={realApi} />;
}
