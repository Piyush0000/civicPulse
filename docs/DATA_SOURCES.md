# Data sources

The demo world is **synthetic and illustrative**, generated deterministically by `src/lib/seed/`. Neighbourhood names
and approximate coordinates are real; all values are invented. The table shows the open dataset each synthetic layer
stands in for in a real deployment.

| Layer | Demo (synthetic) | Production source | License | Refresh |
|---|---|---|---|---|
| Boundary / grid | H3 res-8 disc around the city centre (+ coastline mask) | National admin boundaries (e.g. Survey of India, IBGE, Stats SA, Rosstat, NBS) → `h3.polygonToCells` | Open government data | yearly |
| Population | Gaussian density surface around real neighbourhoods | WorldPop 100 m constrained (worldpop.org) summed per H3 cell | CC BY 4.0 | yearly |
| Facilities (clinics, hospitals, schools, water points) | Points sampled with lower density in deprived areas | OpenStreetMap via Overpass / Geofabrik (`amenity=clinic|hospital|school|drinking_water`, `man_made=water_well`) | ODbL | monthly |
| Road density | Function of vulnerability + density | OSM `highway=*` length per km² | ODbL | monthly |
| Night lights | Proxy from vulnerability | NASA Black Marble / VIIRS DNB | Public domain | monthly |
| Vulnerability | Illustrative per-neighbourhood values, inverse-distance interpolated | National MPI / census deprivation indices | Open government data | yearly |
| Connectivity | 1 − 0.55 × vulnerability + noise | Telecom regulator coverage, census ICT access | Open government data | yearly |
| Planned projects | Scenario projects (deliberately misaligned) + filler works | Municipal budget books; CSV upload at `/app/datasets` | Open government data | per budget cycle |
| Plan documents | Generated annual plan, budget speech, basic-services strategy | Published plans / budget speeches; text upload for RAG | Open government data | per budget cycle |
| Citizen requests | ~14k messages in 6 languages with planted hotspot scenarios | Live channels | n/a | live |

Planted scenarios live in `src/lib/seed/scenarios.ts`. `tests/synthetic-world.test.ts` asserts that the analytics
rediscovers every steady and emerging scenario as a hotspot and turns it into a recommendation.
