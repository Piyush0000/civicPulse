# 5-minute demo script

Setup: `npm run dev`, log in as `policy@civicpulse.local` in one tab, and open `/submit` on a phone (or phone-sized window).
Optional: a Telegram bot token in `.env.local` so a judge can message it live.

| Time | Screen | Say / do |
|---|---|---|
| 0:00 | `/` landing | "Governments hear citizens through a dozen fragmented channels, and budgets rarely follow what they hear. CivicPulse closes that loop, for every BRICS language, and even for people without a smartphone." The hero map rotates through the 5 BRICS cities (k-anonymous public data). |
| 0:30 | `/submit` on the phone | Pick **हिन्दी**, tap the mic and say *"संगम विहार में स्कूल के पास तीन महीने से हैंडपंप खराब है, बच्चे बीमार पड़ रहे हैं"*. Submit. The success screen shows the tracking code and the AI steps completing live: *Water supply · critical · Sangam Vihar*. |
| 1:15 | `/app/map` | The report ripples onto the 3D map in real time. Click **Simulate citizen wave** and 14 citizens arrive in Hindi, Hinglish and English over 25 s. Click the tall Sangam Vihar tower: **Why this score**, broken into demand, gap, population and vulnerability, plus the Gi* z-score and the original-language voices with translations. |
| 2:00 | `/app/recommendations/…` | Open "Fix drainage and sanitation in Seelampur & Mustafabad". The policy brief cites plan documents [D1] and carries a badge: *every number verified against evidence*. Real citizen quotes. Type a note and **Accept**: "This decision is now entry #N in a hash chain." |
| 2:45 | `/app/budget` → `/app/optimizer` | "Roads get most of the capital budget, while drainage and water, which citizens are asking for, are under-funded." Optimizer: US$15M with a 40% equity floor reaches many times more people in need per dollar than the current plan. |
| 3:30 | `/app/copilot` | Ask "What is emerging right now? Any outbreaks?" It flags the fever outbreak in Jahangirpuri as an emerging hotspot. Open the tool trace: every number came from a tool call. |
| 4:00 | `/app/impact` → `/app/brics` | Completed projects: complaints fell about 50% vs flat control areas (difference-in-differences). BRICS federation: each country keeps its data and shares only signed, k-anonymous aggregates. |
| 4:30 | `/ussd` → `/transparency` | Dial `*123#` on the feature-phone simulator: report in 4 keypresses, no internet needed. Finish on the public ledger verification: "Chain intact. Open source, self-hostable, zero paid services: a Digital Public Good." |

Backup plan with no internet: everything above works offline except map tiles (hexagons still render) and free-tier AI.
The rule-based pipeline, SSE, PGlite and the analytics are all local.
