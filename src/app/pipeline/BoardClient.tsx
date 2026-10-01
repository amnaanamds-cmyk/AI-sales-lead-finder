"use client";

import { realApi } from "@/lib/api.real";
import { Board } from "./Board";

export function BoardClient(props: Omit<React.ComponentProps<typeof Board>, "api">) {
  return <Board {...props} api={realApi} />;
}
