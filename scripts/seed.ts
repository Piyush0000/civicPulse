// Usage: npm run seed            (seed if empty)
//        npm run seed -- --reset (wipe and reseed)
// Stop `npm run dev` first when using the embedded PGlite database (single-process).
import { seedAll } from "../src/lib/seed/run";

const reset = process.argv.includes("--reset");
const only = process.argv.find((a) => a.startsWith("--regions="))?.split("=")[1]?.split(",");
const t0 = Date.now();
seedAll({ reset, regions: only, onProgress: (m, p) => console.log(`[${String(p).padStart(3)}%] ${m}`) })
  .then(() => {
    console.log(`Seed complete in ${Math.round((Date.now() - t0) / 1000)}s`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
