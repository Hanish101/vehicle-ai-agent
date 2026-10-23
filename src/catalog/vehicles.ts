export type VehicleSpecs = {
  segment: string;
  engine: string;
  transmission: string;
  fuel: string;
  seating: string;
  drive?: string;
};

export type Vehicle = {
  id: string;
  name: string;
  tagline: string;
  exShowroomLakh: number;
  highlights: string[];
  specs: VehicleSpecs;
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
    specs: {
      segment: "Mid-size SUV",
      engine: "2.0 L turbo petrol / 2.2 L diesel",
      transmission: "6-speed manual or automatic",
      fuel: "Petrol or diesel",
      seating: "6 or 7 seater",
      drive: "FWD (AWD on select variants)",
    },
  },
  {
    id: "xuv3xo",
    name: "XUV 3XO",
    tagline: "Compact SUV with twin screens and sunroof",
    exShowroomLakh: 7.49,
    highlights: [
      "Twin 10.25-inch screens",
      "Panoramic sunroof (top trims)",
      "Level 2 ADAS (AX series)",
      "Turbo petrol powertrain",
    ],
    specs: {
      segment: "Compact SUV",
      engine: "1.2 L turbo petrol",
      transmission: "6-speed manual or 6-speed automatic",
      fuel: "Petrol",
      seating: "5 seater",
      drive: "FWD",
    },
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
    specs: {
      segment: "Off-road SUV",
      engine: "2.0 L turbo petrol / 2.2 L diesel",
      transmission: "6-speed manual or automatic",
      fuel: "Petrol or diesel",
      seating: "4 seater",
      drive: "4x4 with low range",
    },
  },
  {
    id: "thar-roxx",
    name: "Thar Roxx",
    tagline: "Five-door Thar with more cabin space and ADAS",
    exShowroomLakh: 12.99,
    highlights: [
      "5-door body",
      "Level 2 ADAS (select trims)",
      "4x4 capability",
      "Larger rear cabin vs 3-door Thar",
    ],
    specs: {
      segment: "Off-road SUV",
      engine: "2.0 L turbo petrol / 2.2 L diesel",
      transmission: "6-speed manual or automatic",
      fuel: "Petrol or diesel",
      seating: "5 seater",
      drive: "4x4 (select variants)",
    },
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
    specs: {
      segment: "Full-size SUV",
      engine: "2.2 L diesel / 2.0 L turbo petrol",
      transmission: "6-speed manual or automatic",
      fuel: "Petrol or diesel",
      seating: "7 seater",
      drive: "RWD or 4x4",
    },
  },
  {
    id: "scorpio-classic",
    name: "Scorpio Classic",
    tagline: "Proven ladder-frame SUV for family and utility",
    exShowroomLakh: 13.99,
    highlights: [
      "Ladder-frame chassis",
      "7 seater layout",
      "Trusted diesel powertrain",
      "Strong towing and load capability",
    ],
    specs: {
      segment: "Full-size SUV",
      engine: "2.2 L mHawk diesel",
      transmission: "6-speed manual",
      fuel: "Diesel",
      seating: "7 or 9 seater (configuration dependent)",
      drive: "RWD or 4x4",
    },
  },
  {
    id: "bolero-neo",
    name: "Bolero Neo",
    tagline: "Tough UV with modern cabin and practical seating",
    exShowroomLakh: 9.99,
    highlights: [
      "Rugged UV platform",
      "7 seater option",
      "High ground clearance",
      "Efficient diesel",
    ],
    specs: {
      segment: "Utility vehicle",
      engine: "1.5 L turbo diesel",
      transmission: "5-speed manual or 6-speed AMT",
      fuel: "Diesel",
      seating: "7 seater",
      drive: "RWD",
    },
  },
  {
    id: "xuv400",
    name: "XUV400 EV",
    tagline: "Electric SUV with fast DC charging",
    exShowroomLakh: 15.49,
    highlights: [
      "Electric powertrain",
      "DC fast charging support",
      "Connected car features",
      "SUV proportions with zero tailpipe emissions",
    ],
    specs: {
      segment: "Compact electric SUV",
      engine: "Electric motor (single motor FWD)",
      transmission: "Single-speed reduction gear",
      fuel: "Electric (battery pack)",
      seating: "5 seater",
      drive: "FWD",
    },
  },
  {
    id: "marazzo",
    name: "Marazzo",
    tagline: "Premium MPV with captain seats and quiet cabin",
    exShowroomLakh: 14.59,
    highlights: [
      "Captain seats (select rows)",
      "Whale-tail inspired design",
      "Spacious third row access",
      "Diesel efficiency for long trips",
    ],
    specs: {
      segment: "MPV",
      engine: "1.5 L diesel",
      transmission: "6-speed manual",
      fuel: "Diesel",
      seating: "7 or 8 seater",
      drive: "FWD",
    },
  },
];

export function formatPriceLakh(lakh: number): string {
  return `Rs ${lakh.toFixed(2)} lakh ex-showroom (demo catalog)`;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/[\s-_]+/g, "");
}

export function findVehicle(query: string): Vehicle | undefined {
  const q = normalizeQuery(query);
  const raw = query.trim().toLowerCase();
  return VEHICLES.find((v) => {
    const id = normalizeQuery(v.id);
    const name = normalizeQuery(v.name);
    return (
      id === q ||
      name === q ||
      v.name.toLowerCase().includes(raw) ||
      raw.includes(v.name.toLowerCase())
    );
  });
}

/** Map free-text mentions to catalog display name for session.vehicle. */
export function vehicleNameFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/\bxuv\s*3xo\b|\b3xo\b/, "XUV 3XO"],
    [/\bxuv\s*400\b|\bxuv400\b/, "XUV400 EV"],
    [/\bthar\s*roxx\b|\broxx\b/, "Thar Roxx"],
    [/\bscorpio[\s-]*classic\b/, "Scorpio Classic"],
    [/\bscorpio[\s-]*n\b|\bscorpio\b/, "Scorpio-N"],
    [/\bxuv\s*700\b|\bxuv700\b/, "XUV700"],
    [/\bbolero\s*neo\b/, "Bolero Neo"],
    [/\bmarazzo\b/, "Marazzo"],
    [/\bthar\b/, "Thar"],
  ];
  for (const [re, name] of rules) {
    if (re.test(lower)) return name;
  }
  return findVehicle(text)?.name;
}

/** Demo OEM guidance for interval Q&A (not a live service schedule). */
export const SERVICE_INTERVAL_SUMMARY =
  "Periodic service: about every 10,000 km or 12 months, whichever comes first (demo catalog). Book a workshop slot or log a complaint when the customer wants action.";

function formatSpecs(v: Vehicle): string {
  const s = v.specs;
  const drive = s.drive ? `; drive: ${s.drive}` : "";
  return `Specs: ${s.segment}; engine ${s.engine}; ${s.transmission}; fuel ${s.fuel}; seating ${s.seating}${drive}`;
}

export function catalogSummary(): string {
  const vehicles = VEHICLES.map(
    (v) =>
      `- ${v.name}: ${formatPriceLakh(v.exShowroomLakh)}. ${v.tagline}. Highlights: ${v.highlights.join(", ")}. ${formatSpecs(v)}.`,
  ).join("\n");
  return `${vehicles}\n\nService intervals:\n- ${SERVICE_INTERVAL_SUMMARY}`;
}
