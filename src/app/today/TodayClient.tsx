"use client";

import { realApi } from "@/lib/api.real";
import { Today } from "./Today";

export function TodayClient(props: Omit<React.ComponentProps<typeof Today>, "api">) {
  return <Today {...props} api={realApi} />;
}
