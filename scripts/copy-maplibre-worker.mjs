// MapLibre v6 runs tile parsing in a module web worker. Bundlers cannot resolve its URL reliably,
// so we serve the worker (and the shared chunk it imports) as static files from /public.
import { copyFileSync, mkdirSync } from "node:fs";
const out = "public/maplibre";
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(`node_modules/maplibre-gl/dist/${f}`, `${out}/${f}`);
console.log("maplibre worker copied to /public/maplibre");
