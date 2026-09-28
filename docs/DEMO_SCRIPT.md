# 6-minute demo script

Setup: `npm run dev`. Open three tabs: `/login` as **MP** (`mp@civicpulse.local`), `/login` as **CM's office** (`cm@civicpulse.local`),
and `/login?portal=citizen` as **citizen** (`citizen@civicpulse.local`). Password for all: `demo1234`.

| Time | Screen | Say / do |
|---|---|---|
| 0:00 | `/` landing | "City governments hear citizens through a dozen fragmented channels, and budgets rarely follow what they hear. CivicPulse closes that loop, in every Indian language, even for people without a smartphone." |
| 0:30 | `/submit` on a phone | Pick **हिन्दी**, tap the mic and speak a complaint (or type it), optionally add a photo, submit. The AI steps complete live: category, urgency, neighbourhood, tracking ID. |
| 1:10 | `/app/map` (Live Pulse) | The report ripples onto the 3D map. **Simulate citizen wave**. Click a tall tower: **Why this score**, with demand, gap, population, vulnerability and the Gi* z-score. |
| 1:45 | `/app/zones` | **Zone ratings**: Jahangirpuri, Mustafabad and Seelampur are the high-priority wards (need score, complaints per 10k, backlog) and are outlined on the map. Service stars show how well each ward is served. |
| 2:20 | `/app/recommendations/…` (MP tab) | #1 "Fix drainage in Seelampur & Mustafabad". The AI brief cites plan documents; every number is verified. MP clicks **Endorse & forward to CM**. |
| 2:50 | Same page (CM tab) | CM's office **Approves**: funding route (SBM-U 2.0), indicative sanction, ledger entry #N. Open a project marked **Disputed**: the department said "done", but most residents say *not fixed*, so the complaints are reopened. |
| 3:40 | `/app/funds` | Follow the money: roads schemes are almost exhausted, while AMRUT/SBM have crores of headroom for citizen-driven projects. Sync button = government finance API / data.gov.in. |
| 4:15 | `/app/whatif` (MP tab) | "If I build a hospital in Sangam Vihar?" Click the map → **Simulate**: people covered, people newly within 3 km, complaints avoided, cost per beneficiary. *Better site: Jahangirpuri.* The Gemini briefing uses only these numbers. |
| 5:00 | `/citizen` (citizen tab) | Sunita sees her three complaints: one verified fixed, one in progress. Where work is reported done she answers **"Is it really fixed?"** with a rating. |
| 5:30 | `/ussd` → `/transparency` | Feature-phone `*123#` flow; public ledger verification. "Open source, self-hostable, zero paid services: a Digital Public Good." |

No internet? Everything works offline except map tiles and free-tier AI. The rule-based pipeline, template briefs, SSE, PGlite and analytics are all local.
