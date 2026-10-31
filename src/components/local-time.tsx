"use client";

import { useSyncExternalStore } from "react";

export function LocalTime({ iso }: { iso: string | null }) {
  const label = useSyncExternalStore(
    subscribe,
    () => (iso ? format(iso) : "—"),
    () => (iso ? format(iso, "UTC") : "—"),
  );
  if (!iso) return <span>—</span>;
  return <time dateTime={iso}>{label}</time>;
}

function subscribe() {
  return () => {};
}

function format(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso));
}
