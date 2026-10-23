export type Vehicle = {
  id: string;
  name: string;
  tagline: string;
  exShowroomLakh: number;
  highlights: string[];
};

export const VEHICLES: Vehicle[] = [
  {
    id: "xuv700",
    name: "XUV700",
    tagline: "Premium family SUV with ADAS and panoramic sunroof",
    exShowroomLakh: 19.99,
    highlights: [
      "ADAS Level 2",
      "Panoramic sunroof",
      "Dual-zone climate",
      "7/6 seater options",
    ],
  },
  {
    id: "thar",
    name: "Thar",
    tagline: "Iconic off-roader with convertible soft-top options",
    exShowroomLakh: 14.49,
    highlights: [
      "4x4 with low range",
      "Removable roof options",
      "Rugged body-on-frame",
      "Adventure accessories pack",
    ],
  },
  {
    id: "scorpio-n",
    name: "Scorpio-N",
    tagline: "Bold SUV with strong road presence and 4x4",
    exShowroomLakh: 22.15,
    highlights: [
      "4x4 capability",
      "Powerful diesel / petrol",
      "Spacious third row",
      "Premium cabin finishes",
    ],
  },
];

export function formatPriceLakh(lakh: number): string {
  return `Rs ${lakh.toFixed(2)} lakh ex-showroom (demo catalog)`;
}

export function findVehicle(query: string): Vehicle | undefined {
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  return VEHICLES.find(
    (v) =>
      v.id === q ||
      v.name.toLowerCase().replace(/\s+/g, "") === q ||
      v.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
}

/** Demo OEM guidance for interval Q&A (not a live service schedule). */
export const SERVICE_INTERVAL_SUMMARY =
  "Periodic service: about every 10,000 km or 12 months, whichever comes first (demo catalog). Book a workshop slot or log a complaint when the customer wants action.";

export function catalogSummary(): string {
  const vehicles = VEHICLES.map(
    (v) =>
      `- ${v.name}: ${formatPriceLakh(v.exShowroomLakh)}. ${v.tagline}. Highlights: ${v.highlights.join(", ")}.`,
  ).join("\n");
  return `${vehicles}\n\nService intervals:\n- ${SERVICE_INTERVAL_SUMMARY}`;
}
