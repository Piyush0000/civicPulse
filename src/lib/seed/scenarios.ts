import type { Category } from "../categories";

// Planted demand patterns per region. Analytics must rediscover these (tests assert it).
export type Scenario = {
  category: Category;
  locality: string;
  radiusKm: number;
  share: number; // share of this region's scenario requests
  pattern: "steady" | "seasonal" | "emerging";
  months?: number[]; // 1..12 peak months for seasonal
  problems?: string[]; // restrict to problem keys
};

// Completed projects: requests in the footprint drop ~50% after completion.
export type CompletedProject = {
  category: Category;
  locality: string;
  title: string;
  monthsAgo: number;
  budgetUsd: number;
};

// Planned investments: some deliberately misaligned with demand so the budget view tells a story.
export type PlannedProject = {
  category: Category;
  locality: string;
  title: string;
  status: "planned" | "approved" | "in_progress";
  budgetUsd: number;
  ringKm?: number;
};

export type RegionStory = {
  categoryBase: Partial<Record<Category, number>>; // background category weights
  seasonal: Partial<Record<Category, number[]>>; // background seasonal peak months
  scenarios: Scenario[];
  completed: CompletedProject[];
  planned: PlannedProject[];
  scenarioShare: number;
};

const BASE: Partial<Record<Category, number>> = {
  water_supply: 12, sanitation_drainage: 11, roads_transport: 13, electricity: 9, health: 8, education: 7,
  housing: 6, waste_management: 10, public_safety_lighting: 8, digital_connectivity: 4, agriculture_irrigation: 1.5, other: 3,
};

export const STORIES: Record<string, RegionStory> = {
  "IN-DL": {
    categoryBase: BASE,
    seasonal: { sanitation_drainage: [7, 8, 9], water_supply: [4, 5, 6], electricity: [5, 6, 7], health: [8, 9, 10] },
    scenarioShare: 0.42,
    scenarios: [
      { category: "water_supply", locality: "Sangam Vihar", radiusKm: 1.6, share: 0.22, pattern: "seasonal", months: [4, 5, 6, 7], problems: ["broken handpump", "irregular water tanker", "no piped water"] },
      { category: "sanitation_drainage", locality: "Mustafabad", radiusKm: 1.5, share: 0.14, pattern: "seasonal", months: [7, 8, 9] },
      { category: "sanitation_drainage", locality: "Seelampur", radiusKm: 1.1, share: 0.07, pattern: "seasonal", months: [7, 8, 9] },
      { category: "waste_management", locality: "Okhla", radiusKm: 1.5, share: 0.1, pattern: "steady" },
      { category: "health", locality: "Jahangirpuri", radiusKm: 1.4, share: 0.11, pattern: "emerging", problems: ["fever outbreak", "medicine shortage", "no doctor at clinic"] },
      { category: "education", locality: "Uttam Nagar", radiusKm: 1.5, share: 0.1, pattern: "steady" },
      { category: "electricity", locality: "Badarpur", radiusKm: 1.5, share: 0.1, pattern: "seasonal", months: [5, 6, 7] },
      { category: "public_safety_lighting", locality: "Govindpuri", radiusKm: 1.0, share: 0.08, pattern: "steady" },
      { category: "roads_transport", locality: "Burari", radiusKm: 2.0, share: 0.08, pattern: "steady" },
    ],
    completed: [
      { category: "water_supply", locality: "Mehrauli", title: "Mehrauli piped water extension", monthsAgo: 8, budgetUsd: 2_400_000 },
      { category: "sanitation_drainage", locality: "Shahdara", title: "Shahdara storm-water drain desilting", monthsAgo: 9, budgetUsd: 1_800_000 },
      { category: "public_safety_lighting", locality: "Laxmi Nagar", title: "Laxmi Nagar LED street lighting", monthsAgo: 7, budgetUsd: 450_000 },
      { category: "health", locality: "Rohini", title: "Rohini Aam Aadmi Mohalla Clinics (5 units)", monthsAgo: 10, budgetUsd: 900_000 },
      { category: "roads_transport", locality: "Janakpuri", title: "Janakpuri inner-road resurfacing", monthsAgo: 8, budgetUsd: 1_300_000 },
      { category: "waste_management", locality: "Tilak Nagar", title: "Tilak Nagar door-to-door waste collection", monthsAgo: 7, budgetUsd: 350_000 },
      { category: "education", locality: "Pitampura", title: "Pitampura school building extension", monthsAgo: 9, budgetUsd: 1_100_000 },
      { category: "electricity", locality: "Mayur Vihar", title: "Mayur Vihar feeder upgrade", monthsAgo: 6, budgetUsd: 1_600_000 },
    ],
    planned: [
      { category: "roads_transport", locality: "Vasant Kunj", title: "Vasant Kunj elevated corridor", status: "approved", budgetUsd: 48_000_000, ringKm: 2 },
      { category: "roads_transport", locality: "Dwarka", title: "Dwarka expressway link road", status: "in_progress", budgetUsd: 36_000_000, ringKm: 2.5 },
      { category: "roads_transport", locality: "Connaught Place", title: "Connaught Place heritage streetscape", status: "planned", budgetUsd: 14_000_000, ringKm: 1 },
      { category: "roads_transport", locality: "Saket", title: "Saket flyover widening", status: "approved", budgetUsd: 22_000_000, ringKm: 1.5 },
      { category: "roads_transport", locality: "Burari", title: "Burari road resurfacing (phase 1)", status: "planned", budgetUsd: 2_000_000, ringKm: 0.8 },
      { category: "sanitation_drainage", locality: "Mustafabad", title: "Mustafabad trunk drain (north segment)", status: "in_progress", budgetUsd: 4_500_000, ringKm: 0.7 },
      { category: "water_supply", locality: "Dwarka", title: "Dwarka water treatment plant upgrade", status: "approved", budgetUsd: 9_000_000, ringKm: 2 },
      { category: "water_supply", locality: "Sangam Vihar", title: "Sangam Vihar tanker route rationalisation", status: "planned", budgetUsd: 600_000, ringKm: 0.5 },
      { category: "health", locality: "Saket", title: "Saket super-speciality wing", status: "approved", budgetUsd: 18_000_000, ringKm: 1.2 },
      { category: "education", locality: "Janakpuri", title: "Janakpuri smart classrooms", status: "planned", budgetUsd: 3_000_000, ringKm: 1.2 },
      { category: "electricity", locality: "Connaught Place", title: "CP underground cabling", status: "in_progress", budgetUsd: 7_500_000, ringKm: 1.2 },
      { category: "public_safety_lighting", locality: "Lajpat Nagar", title: "Lajpat Nagar CCTV network", status: "approved", budgetUsd: 1_200_000, ringKm: 1.2 },
      { category: "waste_management", locality: "Okhla", title: "Okhla waste-to-energy plant expansion", status: "planned", budgetUsd: 12_000_000, ringKm: 0.8 },
      { category: "digital_connectivity", locality: "Karol Bagh", title: "Karol Bagh public Wi-Fi", status: "planned", budgetUsd: 800_000, ringKm: 1 },
      { category: "housing", locality: "Rohini", title: "Rohini EWS housing blocks", status: "approved", budgetUsd: 16_000_000, ringKm: 1 },
    ],
  },
  "IN-MH": {
    categoryBase: { ...BASE, sanitation_drainage: 15, housing: 10, roads_transport: 14 },
    seasonal: { sanitation_drainage: [6, 7, 8, 9], roads_transport: [7, 8, 9], health: [8, 9, 10] },
    scenarioShare: 0.45,
    scenarios: [
      { category: "sanitation_drainage", locality: "Kurla", radiusKm: 1.4, share: 0.2, pattern: "seasonal", months: [6, 7, 8, 9] },
      { category: "housing", locality: "Dharavi", radiusKm: 1.0, share: 0.15, pattern: "steady" },
      { category: "waste_management", locality: "Govandi", radiusKm: 1.2, share: 0.15, pattern: "steady" },
      { category: "health", locality: "Mankhurd", radiusKm: 1.0, share: 0.15, pattern: "emerging", problems: ["fever outbreak", "medicine shortage", "no doctor at clinic"] },
      { category: "water_supply", locality: "Malvani", radiusKm: 1.2, share: 0.15, pattern: "steady" },
      { category: "roads_transport", locality: "Andheri", radiusKm: 1.5, share: 0.1, pattern: "seasonal", months: [7, 8, 9] },
      { category: "public_safety_lighting", locality: "Sion", radiusKm: 0.8, share: 0.1, pattern: "steady" },
    ],
    completed: [
      { category: "sanitation_drainage", locality: "Dadar", title: "Dadar storm-water drain widening", monthsAgo: 8, budgetUsd: 2_200_000 },
      { category: "health", locality: "Chembur", title: "Chembur Aapla Dawakhana clinics", monthsAgo: 9, budgetUsd: 700_000 },
      { category: "public_safety_lighting", locality: "Ghatkopar", title: "Ghatkopar LED street lighting", monthsAgo: 7, budgetUsd: 400_000 },
    ],
    planned: [
      { category: "roads_transport", locality: "Bandra", title: "Bandra coastal road connector", status: "in_progress", budgetUsd: 60_000_000, ringKm: 2 },
      { category: "roads_transport", locality: "Powai", title: "Powai elevated corridor", status: "approved", budgetUsd: 28_000_000, ringKm: 1.5 },
      { category: "roads_transport", locality: "Borivali", title: "Borivali flyover", status: "planned", budgetUsd: 15_000_000, ringKm: 1.2 },
      { category: "sanitation_drainage", locality: "Kurla", title: "Kurla Mithi river desilting (phase 1)", status: "in_progress", budgetUsd: 3_000_000, ringKm: 0.6 },
      { category: "housing", locality: "Dharavi", title: "Dharavi redevelopment (sector 1)", status: "approved", budgetUsd: 20_000_000, ringKm: 0.5 },
      { category: "water_supply", locality: "Andheri", title: "Andheri pipeline replacement", status: "approved", budgetUsd: 5_000_000, ringKm: 1.2 },
      { category: "health", locality: "Bandra", title: "Bandra super-speciality hospital wing", status: "approved", budgetUsd: 12_000_000, ringKm: 1 },
    ],
  },
  "IN-TN": {
    categoryBase: { ...BASE, sanitation_drainage: 14, water_supply: 15 },
    seasonal: { sanitation_drainage: [10, 11, 12], water_supply: [4, 5, 6], health: [10, 11, 12] },
    scenarioShare: 0.45,
    scenarios: [
      { category: "sanitation_drainage", locality: "Velachery", radiusKm: 1.5, share: 0.22, pattern: "seasonal", months: [10, 11, 12] },
      { category: "water_supply", locality: "Perambur", radiusKm: 1.2, share: 0.18, pattern: "steady", problems: ["irregular water tanker", "no piped water", "low water pressure"] },
      { category: "waste_management", locality: "Kodungaiyur", radiusKm: 1.2, share: 0.15, pattern: "steady", problems: ["garbage burning", "illegal dump"] },
      { category: "health", locality: "Vyasarpadi", radiusKm: 1.0, share: 0.18, pattern: "emerging", problems: ["fever outbreak", "medicine shortage"] },
      { category: "housing", locality: "Royapuram", radiusKm: 0.8, share: 0.14, pattern: "steady" },
      { category: "public_safety_lighting", locality: "Saidapet", radiusKm: 0.8, share: 0.13, pattern: "steady" },
    ],
    completed: [
      { category: "sanitation_drainage", locality: "T. Nagar", title: "T. Nagar storm-water drain network", monthsAgo: 8, budgetUsd: 2_000_000 },
      { category: "water_supply", locality: "Anna Nagar", title: "Anna Nagar 24x7 water supply pilot", monthsAgo: 9, budgetUsd: 1_500_000 },
      { category: "roads_transport", locality: "Guindy", title: "Guindy road resurfacing", monthsAgo: 7, budgetUsd: 900_000 },
    ],
    planned: [
      { category: "roads_transport", locality: "Adyar", title: "Adyar elevated expressway link", status: "approved", budgetUsd: 30_000_000, ringKm: 1.5 },
      { category: "roads_transport", locality: "Mylapore", title: "Mylapore heritage streetscape", status: "planned", budgetUsd: 8_000_000, ringKm: 1 },
      { category: "sanitation_drainage", locality: "Velachery", title: "Velachery lake inlet drain (partial)", status: "planned", budgetUsd: 2_000_000, ringKm: 0.5 },
      { category: "water_supply", locality: "Guindy", title: "Guindy desalinated water main", status: "in_progress", budgetUsd: 6_000_000, ringKm: 1.2 },
      { category: "health", locality: "Adyar", title: "Adyar multi-speciality block", status: "approved", budgetUsd: 9_000_000, ringKm: 1 },
    ],
  },
  "IN-WB": {
    categoryBase: { ...BASE, sanitation_drainage: 14, health: 10, housing: 9 },
    seasonal: { sanitation_drainage: [6, 7, 8, 9], health: [8, 9, 10] },
    scenarioShare: 0.45,
    scenarios: [
      { category: "sanitation_drainage", locality: "Tiljala", radiusKm: 1.2, share: 0.22, pattern: "seasonal", months: [6, 7, 8, 9] },
      { category: "health", locality: "Metiabruz", radiusKm: 1.2, share: 0.2, pattern: "emerging", problems: ["fever outbreak", "no doctor at clinic"] },
      { category: "waste_management", locality: "Topsia", radiusKm: 0.9, share: 0.15, pattern: "steady" },
      { category: "housing", locality: "Rajabazar", radiusKm: 0.8, share: 0.15, pattern: "steady" },
      { category: "water_supply", locality: "Howrah", radiusKm: 1.2, share: 0.15, pattern: "steady" },
      { category: "roads_transport", locality: "Behala", radiusKm: 1.5, share: 0.13, pattern: "steady" },
    ],
    completed: [
      { category: "public_safety_lighting", locality: "Park Street", title: "Park Street LED lighting", monthsAgo: 7, budgetUsd: 300_000 },
      { category: "sanitation_drainage", locality: "Ballygunge", title: "Ballygunge drainage pumping station", monthsAgo: 9, budgetUsd: 1_800_000 },
      { category: "health", locality: "Dum Dum", title: "Dum Dum urban health centre", monthsAgo: 8, budgetUsd: 600_000 },
    ],
    planned: [
      { category: "roads_transport", locality: "Salt Lake", title: "Salt Lake IT corridor flyover", status: "approved", budgetUsd: 22_000_000, ringKm: 1.5 },
      { category: "roads_transport", locality: "Park Street", title: "Park Street beautification", status: "planned", budgetUsd: 6_000_000, ringKm: 0.8 },
      { category: "sanitation_drainage", locality: "Tiljala", title: "Tiljala canal desilting (partial)", status: "planned", budgetUsd: 1_200_000, ringKm: 0.5 },
      { category: "housing", locality: "Jadavpur", title: "Jadavpur affordable housing", status: "approved", budgetUsd: 7_000_000, ringKm: 0.8 },
      { category: "health", locality: "Salt Lake", title: "Salt Lake super-speciality hospital", status: "in_progress", budgetUsd: 10_000_000, ringKm: 1 },
    ],
  },
  "IN-TS": {
    categoryBase: { ...BASE, water_supply: 15, roads_transport: 14, electricity: 10 },
    seasonal: { water_supply: [3, 4, 5, 6], sanitation_drainage: [7, 8, 9], electricity: [4, 5, 6] },
    scenarioShare: 0.45,
    scenarios: [
      { category: "water_supply", locality: "Falaknuma", radiusKm: 1.4, share: 0.22, pattern: "steady", problems: ["irregular water tanker", "contaminated water", "no piped water"] },
      { category: "sanitation_drainage", locality: "Malakpet", radiusKm: 1.2, share: 0.18, pattern: "seasonal", months: [7, 8, 9] },
      { category: "health", locality: "Yakutpura", radiusKm: 1.0, share: 0.18, pattern: "emerging", problems: ["fever outbreak", "medicine shortage"] },
      { category: "roads_transport", locality: "Uppal", radiusKm: 1.5, share: 0.15, pattern: "steady" },
      { category: "education", locality: "Tolichowki", radiusKm: 1.2, share: 0.14, pattern: "steady" },
      { category: "electricity", locality: "LB Nagar", radiusKm: 1.2, share: 0.13, pattern: "seasonal", months: [4, 5, 6] },
    ],
    completed: [
      { category: "roads_transport", locality: "Kukatpally", title: "Kukatpally road resurfacing", monthsAgo: 8, budgetUsd: 1_200_000 },
      { category: "water_supply", locality: "Secunderabad", title: "Secunderabad pipeline renewal", monthsAgo: 9, budgetUsd: 1_400_000 },
      { category: "public_safety_lighting", locality: "Charminar", title: "Charminar heritage-zone lighting", monthsAgo: 7, budgetUsd: 350_000 },
    ],
    planned: [
      { category: "roads_transport", locality: "Gachibowli", title: "Gachibowli strategic road development", status: "in_progress", budgetUsd: 26_000_000, ringKm: 1.5 },
      { category: "roads_transport", locality: "Banjara Hills", title: "Banjara Hills skywalk", status: "approved", budgetUsd: 9_000_000, ringKm: 1 },
      { category: "digital_connectivity", locality: "Madhapur", title: "Madhapur smart-city Wi-Fi", status: "approved", budgetUsd: 4_000_000, ringKm: 1.2 },
      { category: "water_supply", locality: "Falaknuma", title: "Falaknuma reservoir (partial)", status: "planned", budgetUsd: 1_500_000, ringKm: 0.5 },
      { category: "health", locality: "Gachibowli", title: "Gachibowli multi-speciality hospital", status: "approved", budgetUsd: 11_000_000, ringKm: 1 },
    ],
  },
};
