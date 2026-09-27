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
  "BR-PE-REC": {
    categoryBase: { ...BASE, sanitation_drainage: 15, housing: 9, public_safety_lighting: 10 },
    seasonal: { sanitation_drainage: [4, 5, 6, 7], health: [3, 4, 5] },
    scenarioShare: 0.45,
    scenarios: [
      { category: "sanitation_drainage", locality: "Ibura", radiusKm: 1.3, share: 0.25, pattern: "seasonal", months: [4, 5, 6, 7] },
      { category: "housing", locality: "Coque", radiusKm: 0.8, share: 0.15, pattern: "steady" },
      { category: "public_safety_lighting", locality: "Brasília Teimosa", radiusKm: 0.8, share: 0.12, pattern: "steady" },
      { category: "health", locality: "Nova Descoberta", radiusKm: 1.0, share: 0.15, pattern: "emerging", problems: ["fever outbreak", "no doctor at clinic"] },
      { category: "waste_management", locality: "Água Fria", radiusKm: 1.0, share: 0.13, pattern: "steady" },
      { category: "water_supply", locality: "Várzea", radiusKm: 1.2, share: 0.2, pattern: "steady" },
    ],
    completed: [
      { category: "sanitation_drainage", locality: "Afogados", title: "Afogados canal lining", monthsAgo: 8, budgetUsd: 1_500_000 },
      { category: "public_safety_lighting", locality: "Encruzilhada", title: "Encruzilhada LED lighting", monthsAgo: 7, budgetUsd: 300_000 },
      { category: "health", locality: "Casa Amarela", title: "Casa Amarela family health unit", monthsAgo: 9, budgetUsd: 700_000 },
    ],
    planned: [
      { category: "roads_transport", locality: "Boa Viagem", title: "Boa Viagem beachfront boulevard", status: "approved", budgetUsd: 14_000_000, ringKm: 1.5 },
      { category: "roads_transport", locality: "Casa Forte", title: "Casa Forte bike lanes", status: "planned", budgetUsd: 3_000_000, ringKm: 1 },
      { category: "sanitation_drainage", locality: "Ibura", title: "Ibura hillside drainage (phase 1)", status: "planned", budgetUsd: 1_800_000, ringKm: 0.5 },
      { category: "housing", locality: "Madalena", title: "Madalena social housing", status: "approved", budgetUsd: 6_000_000, ringKm: 0.8 },
      { category: "water_supply", locality: "Torre", title: "Torre network renewal", status: "in_progress", budgetUsd: 2_200_000, ringKm: 0.8 },
      { category: "health", locality: "Boa Viagem", title: "Boa Viagem emergency unit", status: "approved", budgetUsd: 5_000_000, ringKm: 1 },
    ],
  },
  "ZA-GP-JHB": {
    categoryBase: { ...BASE, electricity: 16, water_supply: 13, public_safety_lighting: 11 },
    seasonal: { electricity: [6, 7, 8], sanitation_drainage: [11, 12, 1, 2] },
    scenarioShare: 0.45,
    scenarios: [
      { category: "electricity", locality: "Soweto", radiusKm: 3, share: 0.3, pattern: "seasonal", months: [5, 6, 7, 8] },
      { category: "water_supply", locality: "Yeoville", radiusKm: 1.2, share: 0.15, pattern: "emerging" },
      { category: "housing", locality: "Kliptown", radiusKm: 1.2, share: 0.15, pattern: "steady" },
      { category: "roads_transport", locality: "Meadowlands", radiusKm: 1.5, share: 0.12, pattern: "steady" },
      { category: "public_safety_lighting", locality: "Hillbrow", radiusKm: 1, share: 0.15, pattern: "steady" },
      { category: "sanitation_drainage", locality: "Diepkloof", radiusKm: 1.2, share: 0.13, pattern: "seasonal", months: [11, 12, 1, 2] },
    ],
    completed: [
      { category: "electricity", locality: "Orlando", title: "Orlando substation refurbishment", monthsAgo: 8, budgetUsd: 2_000_000 },
      { category: "water_supply", locality: "Riverlea", title: "Riverlea pipe replacement", monthsAgo: 9, budgetUsd: 900_000 },
      { category: "roads_transport", locality: "Pimville", title: "Pimville road rehabilitation", monthsAgo: 7, budgetUsd: 1_100_000 },
    ],
    planned: [
      { category: "roads_transport", locality: "Rosebank", title: "Rosebank transit precinct", status: "approved", budgetUsd: 12_000_000, ringKm: 1.2 },
      { category: "roads_transport", locality: "Randburg", title: "Randburg interchange", status: "planned", budgetUsd: 9_000_000, ringKm: 1.5 },
      { category: "electricity", locality: "Soweto", title: "Soweto smart meters (pilot)", status: "in_progress", budgetUsd: 2_500_000, ringKm: 1 },
      { category: "housing", locality: "Melville", title: "Melville inner-city housing", status: "approved", budgetUsd: 4_000_000, ringKm: 0.8 },
      { category: "public_safety_lighting", locality: "Johannesburg CBD", title: "CBD safety cameras", status: "planned", budgetUsd: 1_500_000, ringKm: 1 },
    ],
  },
  "RU-TA-KZN": {
    categoryBase: { ...BASE, roads_transport: 17, housing: 12, public_safety_lighting: 9, agriculture_irrigation: 0.5 },
    seasonal: { roads_transport: [3, 4, 5], housing: [11, 12, 1, 2], public_safety_lighting: [11, 12, 1] },
    scenarioShare: 0.45,
    scenarios: [
      { category: "roads_transport", locality: "Azino", radiusKm: 1.5, share: 0.3, pattern: "seasonal", months: [3, 4, 5] },
      { category: "housing", locality: "Aviastroitelny", radiusKm: 1.5, share: 0.25, pattern: "seasonal", months: [11, 12, 1, 2], problems: ["no heating", "dangerous building cracks"] },
      { category: "public_safety_lighting", locality: "Derbyshki", radiusKm: 1.5, share: 0.15, pattern: "seasonal", months: [11, 12, 1] },
      { category: "waste_management", locality: "Privolzhsky", radiusKm: 1.2, share: 0.15, pattern: "steady" },
      { category: "health", locality: "Gorki", radiusKm: 1, share: 0.15, pattern: "emerging" },
    ],
    completed: [
      { category: "roads_transport", locality: "Novo-Savinovsky", title: "Novo-Savinovsky road repair", monthsAgo: 8, budgetUsd: 1_200_000 },
      { category: "housing", locality: "Moskovsky", title: "Moskovsky heating network renewal", monthsAgo: 9, budgetUsd: 1_600_000 },
      { category: "public_safety_lighting", locality: "Sovetsky", title: "Sovetsky street lighting", monthsAgo: 7, budgetUsd: 400_000 },
    ],
    planned: [
      { category: "roads_transport", locality: "Kremlin", title: "Kremlin embankment promenade", status: "approved", budgetUsd: 10_000_000, ringKm: 1 },
      { category: "roads_transport", locality: "Vakhitovsky", title: "Vakhitovsky pedestrian zone", status: "planned", budgetUsd: 5_000_000, ringKm: 1 },
      { category: "housing", locality: "Aviastroitelny", title: "Aviastroitelny boiler house (partial)", status: "planned", budgetUsd: 1_000_000, ringKm: 0.5 },
      { category: "health", locality: "Vakhitovsky", title: "Vakhitovsky diagnostic centre", status: "approved", budgetUsd: 4_000_000, ringKm: 0.8 },
    ],
  },
  "CN-SC-CTU": {
    categoryBase: { ...BASE, sanitation_drainage: 12, roads_transport: 14, education: 9, digital_connectivity: 3 },
    seasonal: { sanitation_drainage: [6, 7, 8] },
    scenarioShare: 0.45,
    scenarios: [
      { category: "sanitation_drainage", locality: "Jinniu", radiusKm: 1.5, share: 0.25, pattern: "seasonal", months: [6, 7, 8] },
      { category: "roads_transport", locality: "Gaoxin", radiusKm: 2, share: 0.2, pattern: "steady" },
      { category: "education", locality: "Longtan", radiusKm: 1.5, share: 0.2, pattern: "steady" },
      { category: "digital_connectivity", locality: "Xipu", radiusKm: 1.5, share: 0.15, pattern: "steady" },
      { category: "health", locality: "Shuangqiao", radiusKm: 1.2, share: 0.2, pattern: "emerging" },
    ],
    completed: [
      { category: "sanitation_drainage", locality: "Hehuachi", title: "Hehuachi sponge-city retrofit", monthsAgo: 8, budgetUsd: 2_000_000 },
      { category: "education", locality: "Hongpailou", title: "Hongpailou primary school expansion", monthsAgo: 9, budgetUsd: 1_400_000 },
      { category: "roads_transport", locality: "Chenghua", title: "Chenghua road network repair", monthsAgo: 7, budgetUsd: 1_000_000 },
    ],
    planned: [
      { category: "roads_transport", locality: "Chunxi Road", title: "Chunxi Road commercial streetscape", status: "approved", budgetUsd: 11_000_000, ringKm: 1 },
      { category: "roads_transport", locality: "Jinjiang", title: "Jinjiang riverside boulevard", status: "in_progress", budgetUsd: 8_000_000, ringKm: 1.2 },
      { category: "education", locality: "Qingyang", title: "Qingyang international school campus", status: "planned", budgetUsd: 6_000_000, ringKm: 0.8 },
      { category: "sanitation_drainage", locality: "Jinniu", title: "Jinniu drainage upgrade (south)", status: "planned", budgetUsd: 1_500_000, ringKm: 0.6 },
      { category: "digital_connectivity", locality: "Gaoxin", title: "Gaoxin 5G smart-city grid", status: "approved", budgetUsd: 5_000_000, ringKm: 1.5 },
    ],
  },
};
