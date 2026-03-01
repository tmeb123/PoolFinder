# 🚗 Pool Finder
**A fleet vehicle pool optimizer built for the Geotab Hackathon**

> *Identifies underutilized vehicles for consolidation by analyzing 90 days of hourly utilization — finding vehicles that are never needed on the road at the same time.*

---

## 🎥 Demo Video
*Coming soon — link will be added here*

---

## Why I Built This

I work with fleet operations and have seen firsthand how mixed-use fleets — utilities, municipalities, construction companies — carry far more vehicles than they ever actually need simultaneously. The problem isn't that vehicles go unused. It's that their usage is **sequential, not simultaneous**. A van running a 6am maintenance shift sits idle all afternoon while an identical van sits idle all morning waiting for an evening run. A backhoe deployed on a two-week project sits in the yard for the following six weeks. Fleet managers don't see this — they only see that both vehicles are "actively assigned."

When I saw the Geotab Hackathon, I immediately thought: Geotab already has all the GPS trip data needed to solve this. The data is there. Nobody has built the tool to look at it the right way.

So I built Pool Finder — a MyGeotab add-in that pulls live fleet data from the Geotab API, overlays realistic utilization patterns, and runs a graph algorithm to find every group of vehicles that could safely share a single pool vehicle. The savings are real: **$8,000–$12,000 per vehicle per year in operating costs**, plus **$15,000–$30,000 in capital value** depending on vehicle type.

---

## What It Does

Pool Finder connects directly to the MyGeotab API, pulls your fleet's vehicle metadata and depot assignments, analyzes **90 days of hourly utilization** across all vehicles, and surfaces actionable pool recommendations — ranked by 3-year total savings value.

Each recommendation tells you exactly which vehicles to keep, which to eliminate, why the pool is safe, and what it's worth. A demand chart inside every recommendation shows the daily peak usage across the full 90-day window so you can see with your own eyes that the fleet never needs all those vehicles at once.

---

## How the Algorithm Works

### Step 1 — 2,160-Slot Calendar Vectors
Each vehicle's trip history is mapped onto a **90-day × 24-hour binary grid** — 2,160 slots total. Each slot is `1` if the vehicle was in use during that specific hour on that specific calendar day, `0` otherwise.

This is the key innovation over a standard weekly utilization chart. A normalized weekly view can't tell apart a backhoe that worked week 1 from one that worked week 3 — they both look like "Mon–Fri 07–15." The calendar vector preserves real position in time, so those two backhoes have **zero overlapping 1s** and the algorithm correctly identifies them as complementary.

### Step 2 — Cosine Similarity
Every eligible pair of vehicles (same type, same depot) is scored using **cosine similarity** on their 2,160-slot vectors. A score near 0 means their schedules never overlap in calendar time — complementary. A score near 1 means they work the same hours on the same days — not poolable.

### Step 3 — Sum-Peak Gating
A pair only passes if summing their two vectors never produces a value above `1.0` in any single hour. This is the hard physical constraint: both vehicles can never be needed at the same time.

### Step 4 — Clique Detection (Bron–Kerbosch)
Passing pairs are assembled into a graph. The **Bron–Kerbosch algorithm** finds all maximal cliques — groups where every member is complementary to every other member. These become pool candidates.

### Step 5 — Clique Merging & Deduplication
Cliques sharing members are merged into consolidated groups using a share-ratio threshold. Each vehicle is then assigned to exactly one group — its highest-value pool — so no vehicle ever appears in conflicting recommendations.

### Step 6 — Buffer-Safe Elimination Scoring
For each group, the **peak simultaneous demand** across the full 90-day window determines the minimum fleet needed. Pool Finder adds a **+1 safety buffer** — a group with peak demand of 3 recommends keeping 4, not 3. Groups smaller than 3 vehicles are excluded entirely. Everything above the buffered threshold is safely eliminable.

---

## Vehicle Types & Capital Savings

Pool Finder supports three vehicle types pulled from Geotab group assignments, each with realistic shift patterns and type-specific capital savings:

| Type | Shift Pattern | Capital Savings/Vehicle |
|---|---|---|
| **Service Van** | Day / Evening / Night / Early Morning / Weekend shifts | $15,000 |
| **Pickup Truck** | Morning crew (06–12) vs Afternoon crew (12–18) | $20,000 |
| **Backhoe** | Project-cycle sporadic — active ~1 week per month, AM or PM shift | $30,000 |

Operational savings are consistent across all types at **$8,000–$12,000/vehicle/year**.

---

## Technical Stack

- **Vanilla JavaScript** — no external dependencies
- **Shadow DOM** — full CSS isolation from MyGeotab's stylesheet
- **Geotab MyGeotab Add-In SDK** — live API integration for fleet metadata
- **Bron–Kerbosch algorithm** — maximal clique detection
- **Cosine similarity** — schedule overlap scoring on 2,160-slot calendar vectors
- Single-file deployment (`index.html` + `configuration.json`)

---

## How It Was Built — The Vibe Coding Journey

This project was built as a vibe coding hackathon entry, which in practice meant an intense back-and-forth collaboration with **Claude (Anthropic)** over the course of the hackathon. Here's a rough arc of how the conversation went:

**Starting point:** I came in with the core idea — fleet pooling based on GPS utilization — and a rough sense that cosine similarity on usage vectors was the right approach. The first prompts were about designing the algorithm: what does the vector look like, how do you score complementarity, how do you go from pairs to groups?

**Algorithm design:** We worked through the math together — building the utilization vector, testing cosine similarity, discovering that Bron–Kerbosch was the right tool for finding vehicle groups rather than just pairs. I asked Claude to validate the algorithm against edge cases before writing a single line of production code.

**Geotab integration:** Getting the MyGeotab add-in namespace pattern right took real debugging. The add-in has to register as `geotab.addin.*` and MyGeotab scans loaded scripts for that namespace — it doesn't work from inline HTML attributes. Claude helped trace through the lifecycle and get the `initialize/focus/blur` pattern correct.

**Shadow DOM:** MyGeotab's own CSS was overriding all the add-in styles. The fix was attaching a Shadow DOM root so the add-in's CSS is hard-isolated from the host page. Claude suggested this approach and implemented it cleanly.

**The simulator data problem:** Geotab's demo database generates trips uniformly across all 24 hours — completely random, no real shift patterns. At ~2am I uploaded a 3,972-trip export and asked Claude to analyze it. The entropy analysis confirmed 100% randomness. That led to the decision to overlay synthetic shift patterns on real vehicle metadata, and a discussion about why the 90-day calendar vector was a fundamentally better approach than the weekly normalized vector we started with.

**The bipartite graph bug:** Pickup trucks weren't generating recommendations. The issue turned out to be that morning vs. afternoon vehicles form a perfectly bipartite graph — M only connects to A, never to M. Bron–Kerbosch finds no cliques larger than 2 in a bipartite graph. The fix was lowering the `mergeShareThreshold` so the merge step correctly chains pairs into a full group.

**The full conversation (including all prompts) is linked here:**
> 🔗 *[[Public conversation link]](https://claude.ai/share/b6fe48b9-d141-4390-a629-f1ae0b5d3a28)*

---

## File Structure

```
PoolFinder/
├── index.html          # Complete add-in — all logic, UI, and API integration
├── configuration.json  # MyGeotab add-in manifest
└── README.md           # This file
```

---

## Deploying to MyGeotab

1. Host `index.html` at a public HTTPS URL (GitHub Pages works)
2. Update `configuration.json` with the hosted URL
3. In MyGeotab → Administration → Add-Ins → Add a new add-in
4. Paste the contents of `configuration.json`
5. Pool Finder will appear as a new page in the MyGeotab navigation

---

*Built for the Geotab Hackathon · Pool Finder v2.0 · 90-day calendar analysis · real vehicle data · real savings math*
