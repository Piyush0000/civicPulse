// End-to-end smoke test against a running production server (`npm start`).
// Waits for the demo world to seed, then exercises the real flows citizens and officials use.
// Usage: BASE_URL=http://localhost:3000 node scripts/smoke.mjs

const BASE = (process.env.BASE_URL || "http://localhost:3000") + "/api/v1";
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 240000);
let failures = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, { method = "GET", body, cookie, form } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, text, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}

function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!ok) failures++;
}

async function login(email, portal) {
  const r = await call("/auth/login", { method: "POST", body: { email, password: "demo1234", portal } });
  check(`login ${email} (${portal})`, r.status === 200 && !!r.cookie, `HTTP ${r.status}`);
  return r.cookie;
}

async function main() {
  // 1. server up + seed finished
  const t0 = Date.now();
  let seed = null;
  while (Date.now() - t0 < TIMEOUT_MS) {
    try {
      const s = await call("/system/status");
      seed = s.json?.seed;
      if (seed?.status === "done") break;
      if (seed) console.log(`  seeding… ${seed.progress ?? 0}% ${seed.message ?? ""}`);
    } catch {
      /* server still starting */
    }
    await sleep(3000);
  }
  check("demo world seeded", seed?.status === "done", `${Math.round((Date.now() - t0) / 1000)}s`);
  if (seed?.status !== "done") throw new Error("seed did not finish");

  check("health", (await call("/health")).json?.ok === true);
  const regions = (await call("/public/regions")).json;
  check("5 pilot regions with data", Array.isArray(regions) && regions.length === 5 && regions.every((r) => r.requests > 500));

  // 2. portals + RBAC
  const cm = await login("cm@civicpulse.local", "gov");
  const mp = await login("mp@civicpulse.local", "gov");
  const citizen = await login("citizen@civicpulse.local", "citizen");
  check("CM cannot use citizen portal", (await call("/auth/login", { method: "POST", body: { email: "cm@civicpulse.local", password: "demo1234", portal: "citizen" } })).status === 401);
  check("citizen cannot open dashboard data", (await call("/overview?region=IN-DL", { cookie: citizen })).status === 403);
  check("anonymous cannot open dashboard data", (await call("/overview?region=IN-DL")).status === 401);

  // 3. analytics
  const ov = (await call("/overview?region=IN-DL", { cookie: cm })).json;
  check("overview has hotspots", ov?.hotspots?.hotspots > 0, `${ov?.hotspots?.hotspots} hotspot cells`);
  const recs = (await call("/recommendations?region=IN-DL", { cookie: cm })).json;
  check("ranked recommendations", Array.isArray(recs) && recs.length >= 5);
  const zones = (await call("/zones?region=IN-DL", { cookie: cm })).json;
  check("zone ratings with priority zones", Array.isArray(zones) && zones.some((z) => z.priorityZone));
  const funds = (await call("/allocations?region=IN-DL", { cookie: cm })).json;
  check("fund allocations", funds?.schemes?.length > 5 && funds.totals.sanctioned > 0);
  const wi = await call("/whatif?region=IN-DL", { method: "POST", cookie: mp, body: { type: "hospital", lat: 28.496, lng: 77.24 } });
  check("what-if simulation", wi.status === 200 && wi.json?.peopleBenefiting > 0, `HTTP ${wi.status}, ${wi.json?.peopleBenefiting} people`);
  check("MP cannot approve", (await call(`/recommendations/${recs[0].id}?region=IN-DL`, { method: "PATCH", cookie: mp, body: { status: "accepted" } })).status === 403);

  // 4. citizen intake → AI pipeline (offline providers in CI)
  const fd = new FormData();
  fd.set("region_code", "IN-DL");
  fd.set("consent", "true");
  fd.set("text", "संगम विहार में स्कूल के पास 3 महीने से हैंडपंप खराब है, बच्चे बीमार पड़ रहे हैं");
  const sub = await call("/public/requests", { method: "POST", form: fd });
  const code = sub.json?.tracking_code;
  check("citizen submission", sub.status === 200 && /^CP-/.test(code ?? ""), code);
  let tr = null;
  for (let i = 0; i < 30; i++) {
    tr = (await call(`/public/requests/${code}`)).json;
    if (["completed", "failed"].includes(tr?.pipelineStatus)) break;
    await sleep(1000);
  }
  check("pipeline structured the complaint", tr?.pipelineStatus === "completed" && tr?.category === "water_supply", `${tr?.pipelineStatus} ${tr?.category} ${tr?.urgency} ${tr?.area}`);

  const mine = (await call("/citizen/me", { cookie: citizen })).json;
  check("citizen sees own complaints", mine?.complaints?.length > 0);

  // 5. trust
  const ledger = (await call("/ledger/verify")).json;
  check("ledger hash chain intact", ledger?.ok === true, `${ledger?.count} entries`);
  const api = (await call("/openapi.json")).json;
  check("OpenAPI document", Object.keys(api?.paths ?? {}).length > 40);

  if (failures) {
    console.error(`\n${failures} smoke check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll smoke checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
