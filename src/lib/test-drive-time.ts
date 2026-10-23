const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

/**
 * Normalize follow-up time for Zoho Date field Test_Drive_Time (YYYY-MM-DD).
 * Clock time stays in the note / Description.
 */
export function normalizeTestDriveTime(input: string): {
  date?: string;
  note: string;
} {
  const raw = input.trim();
  if (!raw) return { note: "" };

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { date: raw, note: `Follow-up date: ${raw}` };
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const date = raw.slice(0, 10);
    return { date, note: `Follow-up preference: ${raw}` };
  }

  const lower = raw.toLowerCase();
  const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  let hours = 10;
  let minutes = 0;
  if (timeMatch) {
    hours = Number(timeMatch[1]) % 12;
    if (timeMatch[3] === "pm") hours += 12;
    minutes = Number(timeMatch[2] || 0);
  }

  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  const yearNow = istNow.getUTCFullYear();

  let y = yearNow;
  let month: number | null = null;
  let day: number | null = null;

  // "October 25", "Oct 25th", "25 October 2026"
  const named = lower.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*((?:19|20)\d{2}))?\b/,
  );
  const namedAlt = lower.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?(?:,?\s*((?:19|20)\d{2}))?\b/,
  );

  if (named) {
    month = MONTHS[named[1]];
    day = Number(named[2]);
    if (named[3]) y = Number(named[3]);
  } else if (namedAlt) {
    day = Number(namedAlt[1]);
    month = MONTHS[namedAlt[2]];
    if (namedAlt[3]) y = Number(namedAlt[3]);
  }

  // If month/day resolved to a past date this year, roll to next year.
  if (month != null && day != null) {
    let candidate = new Date(Date.UTC(y, month - 1, day));
    const istToday = new Date(
      Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()),
    );
    if (candidate < istToday && !named?.[3] && !namedAlt?.[3]) {
      candidate = new Date(Date.UTC(y + 1, month - 1, day));
    }
    return formatResult(candidate, raw, timeMatch, hours, minutes);
  }

  let target = new Date(istNow);
  if (/\bnext\s+monday\b/.test(lower) || /\bmonday\b/.test(lower)) {
    const dow = istNow.getUTCDay();
    const daysUntil = (1 - dow + 7) % 7 || 7;
    target = new Date(istNow.getTime() + daysUntil * 24 * 60 * 60 * 1000);
    return formatResult(target, raw, timeMatch, hours, minutes);
  }
  if (/\btomorrow\b/.test(lower)) {
    target = new Date(istNow.getTime() + 24 * 60 * 60 * 1000);
    return formatResult(target, raw, timeMatch, hours, minutes);
  }

  // Unparseable → notes only (Description), no Date field write.
  return { note: `Follow-up preference: ${raw}` };
}

function formatResult(
  target: Date,
  raw: string,
  timeMatch: RegExpMatchArray | null,
  hours: number,
  minutes: number,
): { date: string; note: string } {
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  const d = String(target.getUTCDate()).padStart(2, "0");
  const date = `${y}-${m}-${d}`;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const timeLabel = timeMatch ? `${hh}:${mm} IST` : "";
  return {
    date,
    note: timeLabel
      ? `Follow-up preference: ${raw} → ${date} ${timeLabel}`
      : `Follow-up preference: ${raw} → ${date}`,
  };
}
