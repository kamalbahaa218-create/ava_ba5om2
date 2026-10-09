/** All history previews show exactly the latest two entries. */
export function historyPreview<T>(rows: readonly T[], expanded: boolean): readonly T[] {
  return expanded ? rows : rows.slice(0, 2);
}

export type ScheduledStep = { programDate?: string; startTime?: string | null };
export type JourneyState = "pending" | "active" | "completed";

/** Service schedules use Cairo time, regardless of the viewer's timezone. */
export function journeyStates(items: readonly ScheduledStep[], now: Date): JourneyState[] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (name: string) => parts.find((p) => p.type === name)?.value ?? "";
  const date = `${value("year")}-${value("month")}-${value("day")}`;
  const current = `${date}T${value("hour")}:${value("minute")}:${value("second")}`;
  const scheduled = items.map((item) =>
    item.programDate && item.startTime
      ? `${item.programDate}T${item.startTime.slice(0, 8).padEnd(8, ":00")}`
      : null,
  );
  let active = -1;
  scheduled.forEach((time, i) => {
    if (
      time &&
      time <= current &&
      items[i]?.programDate === date &&
      (active < 0 || time >= (scheduled[active] ?? ""))
    )
      active = i;
  });
  return scheduled.map((time, i) =>
    !time || time > current ? "pending" : i === active ? "active" : "completed",
  );
}

/** Read every authorized history row, including records beyond API page limits. */
export async function readFullHistory<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const result = await page(from, from + size - 1);
    if (result.error) throw result.error;
    const batch = result.data ?? [];
    rows.push(...batch);
    if (batch.length < size) return rows;
  }
}
