# 🚗 Pool Finder
**A fleet vehicle pool optimizer built for the Geotab Hackathon**

> *Analyzes 90 days of hourly utilization to find vehicles that are never needed on the road at the same time — and tells you exactly how many you can safely eliminate.*

---

## 🎥 Demo Video
*Coming soon — link will be added here*

---

## Why I Built This

I work at Xcel Energy, one of the largest utility fleets in the country at over 8,000 mixed vehicles. At Geotab Connect this year, I kept hearing the same frustration from fleet managers across utilities, municipalities, and construction firms: rising costs, pressure to cut budgets, no clear answer for how to do more with less.

The problem isn't that these fleets are wasteful — it's that the inefficiency is invisible. Every vehicle is assigned. Every vehicle is being used. But vehicles aren't competing for the same hours, they're taking turns. A service van back in the yard by 2pm while an identical van doesn't leave until 4pm. A backhoe deployed on a project for three weeks while another sits idle. Fleet managers only see that both are "actively assigned." Pool Finder shows them what's actually happening — and what it's costing.

---

## What It Does

Pool Finder connects to the MyGeotab API, pulls live fleet metadata, and analyzes **90 days of hourly utilization** across all vehicles. It surfaces pool recommendations ranked by 3-year savings value — showing exactly which vehicles to keep, which to eliminate, and why the pool is operationally safe. Each recommendation includes a demand chart showing daily peak usage across the full 90-day window.

**Savings per vehicle eliminated:** $8,000–$12,000/yr in operating costs + $15,000–$30,000 in capital value depending on vehicle type.

---

## A Note on the Demo vs. Production

Geotab's demo simulator generates trips randomly and uniformly across all 24 hours — no real shift patterns, no project cycles, just noise. This makes it impossible to find meaningful pools from the raw trip data alone.

To demonstrate the concept, Pool Finder currently overlays **simulated shift patterns** on top of the real vehicle metadata pulled from the API. Vans get realistic day, evening, night, and early morning shifts. Pickups get morning and afternoon crew patterns. Backhoes get project-cycle sporadic patterns — active roughly one week per month. The vehicle names, depot assignments, and group structure are all real and live from Geotab. Only the trip activity is simulated.

**In a production deployment against a real fleet, none of this simulation is needed.** The core algorithm works directly on actual GPS trip history pulled from the Geotab API. Every fleet operates differently — different vehicle types, shift structures, and depot configurations — so the group assignments and vehicle type mappings would need to be configured to match each operation. But once that lightweight customization is done, the algorithm runs identically and the recommendations reflect real usage. The core logic and API integration are the same regardless of fleet size or complexity.

---

## How the Algorithm Works

**1 — 2,160-Slot Calendar Vectors**
Each vehicle's trip history is mapped onto a 90-day × 24-hour binary grid. Each slot is `1` if the vehicle was in use that hour on that specific calendar day, `0` otherwise. This preserves real calendar position — a backhoe active in week 1 and one active in week 3 have zero overlapping slots, something a normalized weekly chart cannot detect.

**2 — Cosine Similarity**
Every eligible pair of vehicles (same type, same depot) is scored on their 2,160-slot vectors. Score near 0 = complementary schedules. Score near 1 = they work the same hours and can't share.

**3 — Sum-Peak Gating**
A pair only passes if their combined hourly demand never exceeds 1.0 — they are never both needed at the same time.

**4 — Bron–Kerbosch Clique Detection**
Passing pairs are assembled into a graph. Bron–Kerbosch finds all maximal cliques — groups where every member is complementary to every other. These become pool candidates.

**5 — Merge & Deduplicate**
Cliques sharing members are merged into consolidated groups. Each vehicle is assigned to exactly one group so no vehicle appears in conflicting recommendations.

**6 — Buffer-Safe Scoring**
Peak simultaneous demand determines the minimum fleet needed, plus a **+1 safety buffer**. Groups smaller than 3 vehicles are excluded. Everything above the buffered threshold is safely eliminable.

---

## Vehicle Types

| Type | Shift Pattern | Capital Savings/Vehicle |
|---|---|---|
| **Service Van** | Day / Evening / Night / Early Morning / Weekend | $15,000 |
| **Pickup Truck** | Morning crew (06–12) vs Afternoon crew (12–18) | $20,000 |
| **Backhoe** | Project-cycle — active ~1 week/month, AM or PM shift | $30,000 |

---

## The Vibe Coding Journey

This was built in collaboration with Claude (Anthropic) over the course of the hackathon. My background is Python for data analysis — I've worked with APIs before, but a single-file HTML add-in deployed via GitHub Pages and integrated with the MyGeotab SDK was completely foreign territory. The math behind the algorithm was new to me too. Claude explained every step clearly enough that I could follow the logic, validate the approach, and make real decisions — I wasn't just accepting output, I was understanding it.

The major turning points:

- **Algorithm design** — worked through cosine similarity, vector design, and why Bron–Kerbosch was the right tool for finding groups rather than just pairs
- **The 2am data problem** — uploaded a real 3,972-trip Geotab export and discovered the demo simulator generates completely random trips. Led directly to the 90-day calendar vector as the solution
- **Geotab integration** — debugging the MyGeotab add-in namespace pattern and getting the `initialize/focus/blur` lifecycle right
- **Shadow DOM** — MyGeotab's CSS was overriding all add-in styles; Shadow DOM solved it cleanly
- **The bipartite graph bug** — pickup trucks weren't generating recommendations because morning/afternoon vehicles form a bipartite graph with no cliques larger than 2; fixed by tuning the merge threshold

**The full conversation including all prompts:** 🔗 *(https://claude.ai/share/b6fe48b9-d141-4390-a629-f1ae0b5d3a28)*

---
## To Do

- Expand utilization window from 90 days to 365 days (8,760-slot vectors) for better seasonal and project-cycle accuracy
- Make the analysis window user-configurable (30 / 90 / 180 / 365 days) with a confidence indicator when the window is too short
- Replace flat cost estimates with true TCO using Geotab engine hours, odometer data, and actual maintenance records
- Add GPS proximity pooling — allow cross-depot recommendations when vehicles from different depots operate in the same geographic zone
- Real-time pool availability layer showing dispatchers which pooled vehicles are currently in use vs. available
- Forward-looking recommendations using project calendars and seasonal demand curves, not just historical trips
- Automated monthly right-sizing reports tracking whether predicted savings are materializing
- Scale to large fleets with server-side processing and pre-filtering to keep pair comparisons manageable
- Make vehicle type mappings and shift pattern definitions configurable per fleet without code changes

---
## Stack

Vanilla JS · Shadow DOM · Geotab MyGeotab Add-In SDK · Bron–Kerbosch clique detection · Cosine similarity on 2,160-slot calendar vectors · No external dependencies · Single-file deployment

---

## Deploying to MyGeotab

1. Host `index.html` at a public HTTPS URL (GitHub Pages works)
2. Update `configuration.json` with the hosted URL
3. MyGeotab → Administration → Add-Ins → Add new → paste `configuration.json`
4. Pool Finder appears as a new page in the MyGeotab navigation
  
⚠️ Note: Pool Finder is currently configured to work with my specific Geotab demo database, which I manually set up with vehicle type and depot group assignments. Deploying it against a different fleet will require configuring the group IDs and shift patterns to match that fleet's operations. If you're interested in deploying Pool Finder on your fleet, feel free to reach out and I'm happy to help.

---

## File Structure

```
PoolFinder/
├── index.html          # Complete add-in — all logic, UI, and API integration
├── configuration.json  # MyGeotab add-in manifest
└── README.md
```

---

*Built for the Geotab Hackathon · Pool Finder v2.0 · 90-day calendar analysis · real vehicle data · real savings math*
