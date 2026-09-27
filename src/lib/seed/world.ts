import { cellArea, cellToLatLng, gridDisk, latLngToCell, UNITS } from "h3-js";
import type { Category } from "../categories";
import { CATEGORIES, CATEGORY_META } from "../categories";
import { nearestLocality, regionCells } from "../geo";
import type { RegionDef } from "../regions";
import { clip, haversineKm, hashString, pctRank, rng } from "../stats";
import { STORIES } from "./scenarios";

export type WorldCell = {
  h3: string;
  lat: number;
  lng: number;
  population: number;
  admin: string;
  vuln: number;
  conn: number;
};

export type Facility = { category: Category; type: string; name: string; lat: number; lng: number; h3: string };
export type Indicator = { h3: string; category: Category; key: string; value: number; gap: number; source: string; isProxy: boolean };
export type Project = {
  ref: string;
  title: string;
  description: string;
  category: Category;
  status: "planned" | "approved" | "in_progress" | "completed";
  budgetLocal: number;
  currency: string;
  startDate: string;
  endDate: string;
  completedDate: string | null;
  admin: string;
  cells: string[];
};
export type Doc = { title: string; docType: "budget" | "plan" | "policy" | "report"; published: string; content: string };

export type World = {
  cells: WorldCell[];
  facilities: Facility[];
  indicators: Indicator[];
  projects: Project[];
  docs: Doc[];
};

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function locality(region: RegionDef, name: string) {
  const l = region.localities.find((x) => x.name === name);
  if (!l) throw new Error(`Unknown locality ${name} in ${region.code}`);
  return l;
}

export function cellsWithin(region: RegionDef, cellSet: Set<string>, lat: number, lng: number, km: number): string[] {
  const c = latLngToCell(lat, lng, region.h3Res);
  const k = Math.max(1, Math.ceil(km / 0.8) + 1);
  return gridDisk(c, k).filter((h) => {
    if (!cellSet.has(h)) return false;
    const [a, b] = cellToLatLng(h);
    return haversineKm(a, b, lat, lng) <= Math.max(km, 0.5);
  });
}

export function buildWorld(region: RegionDef, now: Date): World {
  const r = rng(hashString(region.code + ":world"));
  const hexes = regionCells(region);
  const cellSet = new Set(hexes);
  const areaKm2 = cellArea(hexes[0], UNITS.km2);

  // ---- population, vulnerability, connectivity ----
  const cells: WorldCell[] = hexes.map((h) => {
    const [lat, lng] = cellToLatLng(h);
    let dens = 0;
    let wSum = 0;
    let vSum = 0;
    for (const l of region.localities) {
      const d = haversineKm(lat, lng, l.lat, l.lng);
      dens = Math.max(dens, l.density * Math.exp(-(d * d) / (2 * 2.2 * 2.2)));
      const w = 1 / Math.max(0.3, d) ** 2;
      wSum += w;
      vSum += w * l.vuln;
    }
    const dc = haversineKm(lat, lng, region.center[0], region.center[1]);
    const edgeFade = clip(1.15 - dc / region.radiusKm, 0.25, 1);
    const density = region.peakDensityPerKm2 * (0.12 + 0.88 * dens) * edgeFade * (0.8 + 0.4 * r.next());
    const vuln = clip(vSum / wSum + r.normal() * 0.05, 0.02, 0.98);
    const conn = clip(1 - 0.55 * vuln + r.normal() * 0.05, 0.15, 0.98);
    return {
      h3: h,
      lat,
      lng,
      population: Math.round(density * areaKm2),
      admin: nearestLocality(region, lat, lng).loc.name,
      vuln: Math.round(vuln * 1000) / 1000,
      conn: Math.round(conn * 1000) / 1000,
    };
  });
  const byH3 = new Map(cells.map((c) => [c.h3, c]));

  // ---- facilities (OSM-like, illustrative): fewer in deprived areas ----
  const facilities: Facility[] = [];
  const place = (n: number, category: Category, type: string, label: string, weight: (c: WorldCell) => number) => {
    const ws = cells.map(weight);
    for (let i = 0; i < n; i++) {
      const c = r.weighted(cells, ws);
      const lat = c.lat + r.normal() * 0.002;
      const lng = c.lng + r.normal() * 0.002;
      facilities.push({ category, type, name: `${c.admin} ${label} ${i + 1}`, lat, lng, h3: c.h3 });
    }
  };
  const n = cells.length;
  place(Math.round(n / 18), "health", "clinic", "Clinic", (c) => c.population * (1.1 - c.vuln) ** 2);
  place(Math.round(n / 60), "health", "hospital", "Hospital", (c) => c.population * (1.1 - c.vuln) ** 3);
  place(Math.round(n / 7), "education", "school", "School", (c) => c.population * (1.2 - c.vuln));
  place(Math.round(n / 9), "water_supply", "water_point", "Water Point", (c) => c.population * (1.1 - c.vuln) ** 2);

  // ---- indicators -> gap per category (0..1, higher = worse) ----
  const indicators: Indicator[] = [];
  const counts = (cat: Category, type?: string) => {
    const m = new Map<string, number>();
    for (const f of facilities) if (f.category === cat && (!type || f.type === type)) m.set(f.h3, (m.get(f.h3) || 0) + 1);
    return m;
  };
  const ringSum = (m: Map<string, number>, h: string) => gridDisk(h, 1).reduce((a, x) => a + (m.get(x) || 0), 0);
  const ringPop = (h: string) => gridDisk(h, 1).reduce((a, x) => a + (byH3.get(x)?.population || 0), 0);
  const healthPts = facilities.filter((f) => f.category === "health");
  const schools = counts("education");
  const water = counts("water_supply");

  const roadDensity = cells.map((c) => clip(6 * (1 - c.vuln) + 4 * (c.population / (region.peakDensityPerKm2 * areaKm2)) + r.normal(), 0.3, 14));
  const roadGap = pctRank(roadDensity).map((p) => 1 - p);
  const nightLight = cells.map((c) => clip((1 - c.vuln) * 50 + r.normal() * 6, 1, 70));
  const lightGap = pctRank(nightLight).map((p) => 1 - p);
  const asProxy = new Set<Category>(["sanitation_drainage", "housing", "waste_management", "public_safety_lighting", "agriculture_irrigation", "other"]);

  cells.forEach((c, i) => {
    let dmin = Infinity;
    for (const f of healthPts) dmin = Math.min(dmin, haversineKm(c.lat, c.lng, f.lat, f.lng));
    indicators.push({ h3: c.h3, category: "health", key: "km_to_nearest_clinic", value: round2(dmin), gap: clip(dmin / 5), source: "synthetic OSM-like facilities (illustrative)", isProxy: false });

    const pop = Math.max(ringPop(c.h3), 1);
    const sp = (ringSum(schools, c.h3) / pop) * 1000;
    indicators.push({ h3: c.h3, category: "education", key: "schools_per_1000", value: round2(sp), gap: 1 - clip(sp / 0.12), source: "synthetic OSM-like facilities (illustrative)", isProxy: false });

    const wp = (ringSum(water, c.h3) / pop) * 1000;
    const wGap = 0.5 * (1 - clip(wp / 0.1)) + 0.5 * c.vuln;
    indicators.push({ h3: c.h3, category: "water_supply", key: "water_points_per_1000", value: round2(wp), gap: wGap, source: "synthetic OSM-like + census blend (illustrative)", isProxy: false });

    indicators.push({ h3: c.h3, category: "roads_transport", key: "road_km_per_km2", value: round2(roadDensity[i]), gap: roadGap[i], source: "synthetic OSM-like roads (illustrative)", isProxy: false });
    indicators.push({ h3: c.h3, category: "electricity", key: "night_light_radiance", value: round2(nightLight[i]), gap: lightGap[i], source: "synthetic VIIRS-like (illustrative)", isProxy: false });
    indicators.push({ h3: c.h3, category: "digital_connectivity", key: "connectivity_index", value: c.conn, gap: 1 - c.conn, source: "synthetic survey (illustrative)", isProxy: false });
    for (const cat of asProxy) {
      indicators.push({ h3: c.h3, category: cat, key: "vulnerability_proxy", value: c.vuln, gap: c.vuln, source: "proxy: vulnerability index", isProxy: true });
    }
  });

  // ---- projects ----
  const story = STORIES[region.code];
  const projects: Project[] = [];
  const toLocal = (usd: number) => Math.round(usd / region.usdRate);
  let refN = 1;
  for (const cp of story.completed) {
    const l = locality(region, cp.locality);
    const completed = new Date(now.getTime() - cp.monthsAgo * 30 * DAY);
    projects.push({
      ref: `${region.code}-P${String(refN++).padStart(3, "0")}`,
      title: cp.title,
      description: `${CATEGORY_META[cp.category].action} in ${cp.locality}. Completed ${iso(completed)}.`,
      category: cp.category,
      status: "completed",
      budgetLocal: toLocal(cp.budgetUsd),
      currency: region.currency,
      startDate: iso(new Date(completed.getTime() - 200 * DAY)),
      endDate: iso(completed),
      completedDate: iso(completed),
      admin: cp.locality,
      cells: cellsWithin(region, cellSet, l.lat, l.lng, 1.2),
    });
  }
  for (const pp of story.planned) {
    const l = locality(region, pp.locality);
    const start = new Date(now.getTime() + (pp.status === "in_progress" ? -120 : 60 + r.int(0, 200)) * DAY);
    projects.push({
      ref: `${region.code}-P${String(refN++).padStart(3, "0")}`,
      title: pp.title,
      description: `${pp.title}. Status: ${pp.status.replace("_", " ")}.`,
      category: pp.category,
      status: pp.status,
      budgetLocal: toLocal(pp.budgetUsd),
      currency: region.currency,
      startDate: iso(start),
      endDate: iso(new Date(start.getTime() + r.int(300, 900) * DAY)),
      completedDate: null,
      admin: pp.locality,
      cells: cellsWithin(region, cellSet, l.lat, l.lng, pp.ringKm ?? 1),
    });
  }
  // Filler small works across other categories so every category has some spend.
  const fillers = region.code === "IN-DL" ? 25 : 8;
  for (let i = 0; i < fillers; i++) {
    const cat = r.pick(CATEGORIES.filter((c) => c !== "other"));
    const l = r.pick(region.localities);
    const status = r.pick(["planned", "approved", "in_progress"] as const);
    const start = new Date(now.getTime() + r.int(-100, 250) * DAY);
    const usd = Math.round((0.1 + r.next() * 1.4) * 1_000_000);
    projects.push({
      ref: `${region.code}-P${String(refN++).padStart(3, "0")}`,
      title: `${CATEGORY_META[cat].label.en} works, ${l.name}`,
      description: `Routine ${CATEGORY_META[cat].label.en.toLowerCase()} works in ${l.name}.`,
      category: cat,
      status,
      budgetLocal: toLocal(usd),
      currency: region.currency,
      startDate: iso(start),
      endDate: iso(new Date(start.getTime() + r.int(120, 500) * DAY)),
      completedDate: null,
      admin: l.name,
      cells: cellsWithin(region, cellSet, l.lat, l.lng, 0.5),
    });
  }

  return { cells, facilities, indicators, projects, docs: buildDocs(region, projects, now) };
}

const round2 = (x: number) => Math.round(x * 100) / 100;

function fmtMoney(amount: number, currency: string): string {
  if (currency === "INR") {
    const crore = amount / 1e7;
    return `₹${crore >= 1 ? crore.toFixed(1) + " crore" : (amount / 1e5).toFixed(1) + " lakh"}`;
  }
  const sym: Record<string, string> = { BRL: "R$", ZAR: "R", RUB: "₽", CNY: "¥" };
  const m = amount / 1e6;
  return `${sym[currency] || currency} ${m.toFixed(1)} million`;
}

function buildDocs(region: RegionDef, projects: Project[], now: Date): Doc[] {
  const fy = now.getUTCFullYear();
  const active = projects.filter((p) => p.status !== "completed").sort((a, b) => b.budgetLocal - a.budgetLocal);
  const done = projects.filter((p) => p.status === "completed");
  const byCat = new Map<string, number>();
  for (const p of active) byCat.set(p.category, (byCat.get(p.category) || 0) + p.budgetLocal);
  const total = [...byCat.values()].reduce((a, b) => a + b, 0);
  const catLines = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c, v]) => `- ${CATEGORY_META[c as Category].label.en}: ${fmtMoney(v, region.currency)} (${Math.round((v / total) * 100)}% of capital outlay)`);

  const plan = [
    `${region.name} Annual Infrastructure Plan ${fy}-${String(fy + 1).slice(2)} (ILLUSTRATIVE, SYNTHETIC DOCUMENT)`,
    ``,
    `1. Vision. The municipal administration of ${region.name} commits to modern, connected and liveable neighbourhoods. The flagship priority for this plan period is mobility and urban form, with major corridor and streetscape investments.`,
    ``,
    `2. Capital outlay by sector:`,
    ...catLines,
    ``,
    `3. Flagship projects:`,
    ...active.slice(0, 8).map((p) => `- ${p.title} (${p.admin}): ${fmtMoney(p.budgetLocal, p.currency)}, status ${p.status.replace("_", " ")}, scheduled ${p.startDate} to ${p.endDate}.`),
    ``,
    `4. Basic services. Water supply, drainage and primary health continue under routine maintenance budgets. Ward-level works are prioritised based on councillor recommendations and complaints received at zonal offices.`,
    ``,
    `5. Monitoring. Progress will be reported quarterly. Citizen feedback mechanisms are fragmented across helplines, zonal offices and social media and will be consolidated in future.`,
  ].join("\n");

  const budget = [
    `${region.name} Budget Speech Highlights ${fy} (ILLUSTRATIVE, SYNTHETIC DOCUMENT)`,
    ``,
    `The total capital budget for civic infrastructure is ${fmtMoney(total, region.currency)}.`,
    `Roads and transport receive the largest allocation, reflecting the administration's focus on decongestion and economic growth.`,
    ...active
      .filter((p) => p.category === "roads_transport")
      .slice(0, 4)
      .map((p) => `An allocation of ${fmtMoney(p.budgetLocal, p.currency)} is made for the ${p.title}.`),
    `For drinking water, allocations are limited to ongoing schemes: ${active.filter((p) => p.category === "water_supply").map((p) => p.title).join("; ") || "no new water schemes"}.`,
    `For drainage and sanitation: ${active.filter((p) => p.category === "sanitation_drainage").map((p) => `${p.title} (${fmtMoney(p.budgetLocal, p.currency)})`).join("; ") || "no dedicated allocation this year"}.`,
    `Health: ${active.filter((p) => p.category === "health").map((p) => `${p.title} (${fmtMoney(p.budgetLocal, p.currency)})`).join("; ") || "no new facilities"}.`,
    ``,
    `Completed last year: ${done.map((p) => `${p.title} (${p.completedDate})`).join("; ")}.`,
  ].join("\n");

  const sector = [
    `${region.name} Basic Services Strategy (ILLUSTRATIVE, SYNTHETIC DOCUMENT)`,
    ``,
    `Water. Service levels vary sharply between planned colonies and informal or unauthorised settlements. Where piped supply is absent, households depend on tankers and community handpumps, whose maintenance is irregular. The strategy recommends mapping unserved pockets and prioritising community water points.`,
    ``,
    `Drainage. Seasonal waterlogging recurs in low-lying, densely built neighbourhoods. Desilting before the rainy season and trunk-drain completion are the principal measures. ${active.filter((p) => p.category === "sanitation_drainage").map((p) => `${p.title} is ${p.status.replace("_", " ")}.`).join(" ")}`,
    ``,
    `Health. Primary care access is uneven; outer and informal areas have fewer clinics per capita. Mobile clinics and extended hours are suggested for areas reporting fever outbreaks.`,
    ``,
    `Street lighting and safety. LED retrofits have reduced complaints where implemented. Women's safety audits recommend lighting in lanes and near transit stops.`,
    ``,
    `Education. Enrolment growth in outer areas has outpaced classroom construction, leading to overcrowding.`,
  ].join("\n");

  return [
    { title: `${region.name} Annual Infrastructure Plan ${fy}-${String(fy + 1).slice(2)}`, docType: "plan", published: `${fy}-04-01`, content: plan },
    { title: `${region.name} Budget Speech Highlights ${fy}`, docType: "budget", published: `${fy}-03-15`, content: budget },
    { title: `${region.name} Basic Services Strategy`, docType: "policy", published: `${fy - 1}-11-20`, content: sector },
  ];
}
