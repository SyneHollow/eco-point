# EcoPoints: context

## What it is
A school sustainability competition run by class, not by student. Built from the "ECOPOINTS – Class Wise Sustainability App" concept for a CBSE school (Grades 7–8), as a web-app so it works on classroom smartboards, teacher laptops, shared tablets and the corridor screen with nothing to install. Built by Nexayra Technologies and credited openly ("Built with Nexayra Technologies" in the footer). The students own the concept, criteria, data collection and analysis.

## Design decisions (and why)
| Decision | Why |
|---|---|
| Counts, not yes/no boxes, for the class's own items (e.g. 25 of 28 had a plastic-free lunch) | The concept's headline claims are percentages; yes/no boxes can't produce them |
| Points for counts = max points × count ÷ students present | Big and small classes compete fairly |
| Lights/fans and cleanliness are **peer checks** by another class | Classes scoring themselves on conditions invites inflation, and judges will ask about it first |
| Peer-check rotation: class *i* checks class (*i + k*) mod *n*, *k* = 1 + (day mod (n−1)) | Never checks itself; every class checked exactly once a day; pairings change daily; nothing to schedule |
| **Measuring week** (`schools.points_start_date`) | Records habits with no points first, giving an honest "before" for the impact report. No invented numbers |
| Eco drives and one-offs are teacher **bonuses** with a reason | They don't happen daily |
| One login per class (class + 6-digit PIN), no student names or emails | The monitors are minors; storing no personal data keeps it simple for the school (ADEK in Abu Dhabi, KHDA in Dubai) |
| Append-only points ledger; corrections are voids/adjustments with a reason; closed months frozen | Results can be trusted and audited; the report adds up |
| `school_id` on every table + RLS | Pilot is one school; another school could be added without a rewrite |

## AI ("AI referee", added 3 Nov 2026, migration `20261103000000_ai_checks.sql`)
| Feature | What it does | Where |
|---|---|---|
| **Bin check** | After lunch a monitor photographs the inside of the class bin. AI counts single-use plastic items (and items in the wrong bin). Scores "low plastic waste": `max × (1 − items ÷ (present × zero_at))`, default max 10, zero_at 0.5. **Cross-check:** if the class claimed many plastic-free lunches but the bin holds more plastic than that can explain (`items > 3 × (present − plastic_free) + 3`), it's flagged for the teacher. | `src/app/monitor/photo-check.tsx`, `ai-actions.ts`, `svc_record_ai_check` |
| **Room check** | After the peer check, the visiting class photographs the empty room. AI judges lights on/off, litter 0–3, bin overflowing. Never changes points; flags disagreement with the peer check's answers. | same |
| **Pattern flags** | Plain statistics (not AI): 100% plastic-free every day for 5+ days; a class that passes everyone on 5+ peer checks while the school passes < 90%. | `teacher_flags` |
| **Ask EcoPoints** | Teacher asks in plain English; the server sends class-level figures only (leaderboards, habit %, AI bin figures, flags) and the AI answers from that data. | `src/lib/ai/context.ts`, `/teacher/assistant` |
| **Weekly challenges** | AI drafts one challenge per class from its weakest habit; teacher edits and publishes; shown on the monitor page and corridor screen. | `class_challenges`, `publish_challenges` |

**Provider:** Gemini (`gemini-3.5-flash-lite`, with `gemini-3.8-flash` as automatic backup) by default, chosen for its object boxes (drawn on the monitor's photo) and price. Claude works by setting `AI_PROVIDER=anthropic`. Both called with plain `fetch` from `src/lib/ai/index.ts`; replies are cleaned and validated by `src/lib/ai/normalize.ts` before anything is saved.

**Privacy rules (minors):** photos are shrunk on the device (≤ 1288 px), sent once to the AI, and **never stored**. Only counts, item labels and the AI's one-line summary are kept. A photo with any person in it is rejected before anything is saved. Real school photos must go through a **paid-tier** Gemini key (free-tier content may be used by Google). Max 15 photo attempts per class per day (cost guard).

## UI ("match day" redesign, 4 Nov 2026)
Each class is a team with a fixed colour; standings look like a scoreboard; the monitor's day is a numbered 1–4 timeline. Fonts: Big Shoulders Display (scores, titles) + Atkinson Hyperlegible Next (everything else), self-hosted. Icons: Phosphor via `src/components/icons.tsx`. Full rules and tokens: **`docs/DESIGN.md`**. Teacher area: grouped sidebar on desktop, Menu disclosure on phones. Monitor login: tap a class tile (radio inputs), then the PIN.

## Rewards (added 5 Nov 2026, migration `20261105000000_rewards.sql`)
| Feature | What it does | Where |
|---|---|---|
| **Monthly badges** | Six tiers (Tiny Sprout 100 · Green Keeper 200 · Aqua Guardian 350 · Earth Protector 500 · Eco Legend 650 · Planet Pioneer 800 points in one calendar month; teacher-editable, must stay in order). Computed live from the ledger. The first time a class reaches a tier, it wins that tier's garden item (seedling, butterfly, lotus pond, desert rose, Sidr, Golden Ghaf). | `badge_tiers`, `get_badges`, `app.class_badges`, `app.grant_badge_rewards`; `components/badges.tsx`, `badge-shelf.tsx` |
| **Class garden** | One garden per **class** (no student accounts by design). Garden points = all points ever earned − points spent; spending never touches the leaderboard or badges. 18 spots (3 rows); full garden → new items wait in the "shed". Plants grow seed → sprout → young → fully grown, one stage per day they're watered. Plants are never removed. Shop prices teacher-editable. | `garden_items`, `garden_plants`, `garden_events`, `my_garden`, `garden_buy/water/move`; `/monitor/garden`, `components/garden-art.tsx` |
| **QR eco challenges** | Printable A4 posters with a QR code → `/c/<token>` → login if needed → challenge page. **instant** (recycle, refill, switch off: points on confirm, once a day, only reachable by scanning) and **review** (8 class projects: the class writes what it found, a teacher approves). Once per day/week/month/ever per class. Teacher can send back (with a reason) or void (points reversed). No challenges during the measuring week. | `eco_challenges`, `challenge_claims`, `claim_challenge`, `review_challenge_claim`, `void_challenge_claim`; `/monitor/challenges`, `/teacher/challenges`, `/teacher/challenges/print` |

Naming: `class_challenges` = the AI-drafted **weekly** challenge text (AI migration). `eco_challenges` = the **QR** challenges. Different things.

## Data model (supabase/migrations)
`schools` · `classes` · `profiles` (teacher | monitor, linked to auth.users) · `actions` (the checklist) · `daily_entries` + `entry_values` · `peer_audits` + `audit_values` · `points_ledger` (append-only; sources daily, audit, ai, bonus, adjustment, reversal) · `month_closures` · `activity_log` · `ai_checks` (results only, no images) · `class_challenges` · `badge_tiers` · `garden_items` · `garden_plants` · `garden_events` · `eco_challenges` · `challenge_claims` (ledger source `challenge`).

## Security model
- Browser/server clients get **SELECT only** (RLS-filtered). Every write is a `SECURITY DEFINER` RPC that checks the caller's role first.
- Anonymous visitors reach only: `public_school`, `public_classes`, `get_leaderboard`, `get_impact`, `get_champions`, `get_ai_summary`, `get_challenges`, `get_badges`, `get_badge_tiers`, `get_gardens` (aggregates, no personal data).
- Rewards tables have RLS on and **no** client grants at all: everything goes through the functions. Monitors can only touch their own class's garden and claims; spending locks the class row so a class can't double-spend.
- The secret key is used only in `src/app/teacher/actions.ts` (create class logins, set PINs, add teachers) and `scripts/create-teacher.mjs`, always **after** `requireTeacher()`.
- `svc_link_profile` / `svc_log` / `svc_record_ai_check` / `svc_ai_attempts_today` are executable by `service_role` only. AI results can only be written by the server, after it has checked the monitor's session and called the AI itself.

## Code map
- `src/components/ui.tsx` (TeamTile, Medal, Card, buttons, inputs), `icons.tsx` (the only icon source), `leaderboard.tsx` (Podium, LeaderList), `charts.tsx`
- `src/lib/session.ts`: `getMe`, `requireTeacher`, `requireMonitor`
- `src/lib/public-data.ts`: public RPCs · `src/lib/teacher-data.ts`: teacher RPCs
- `src/app/monitor/*`: monitor screen + actions · `src/app/teacher/*`: teacher area + actions
- `src/app/display/*`: corridor screen · `src/app/api/export/route.ts`: CSV
- `src/lib/ai/*`: AI provider switch, prompts, reply validation, data context for Ask EcoPoints
- `src/app/teacher/ai/*` (AI checks & flags) · `src/app/teacher/assistant/*` (Ask EcoPoints + challenges)
- Rewards: `src/lib/rewards.ts` (types) · `src/app/monitor/{layout,tabs}.tsx` (Today / Garden / Challenges) · `src/app/monitor/garden/*` · `src/app/monitor/challenges/*` · `src/app/c/[token]` (QR landing) · `src/lib/next-path.ts` (safe return after login) · `src/app/teacher/{challenges,rewards}/*` · `src/app/teacher/rewards-actions.ts`
- `supabase/tests/ecopoints_checks.sql`: the rules, as tests (v1 + AI) · `supabase/tests/rewards_checks.sql`: badges, gardens, challenges
- `supabase/seed-demo-month.sql` / `seed-demo-month-undo.sql`: fake month of data for demos, and the clean-up (see GOTCHAS 25)
