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

## Data model (supabase/migrations)
`schools` · `classes` · `profiles` (teacher | monitor, linked to auth.users) · `actions` (the checklist) · `daily_entries` + `entry_values` · `peer_audits` + `audit_values` · `points_ledger` (append-only) · `month_closures` · `activity_log`.

## Security model
- Browser/server clients get **SELECT only** (RLS-filtered). Every write is a `SECURITY DEFINER` RPC that checks the caller's role first.
- Anonymous visitors reach only: `public_school`, `public_classes`, `get_leaderboard`, `get_impact`, `get_champions` (aggregates).
- The secret key is used only in `src/app/teacher/actions.ts` (create class logins, set PINs, add teachers) and `scripts/create-teacher.mjs`, always **after** `requireTeacher()`.
- `svc_link_profile` / `svc_log` are executable by `service_role` only.

## Code map
- `src/lib/session.ts`: `getMe`, `requireTeacher`, `requireMonitor`
- `src/lib/public-data.ts`: public RPCs · `src/lib/teacher-data.ts`: teacher RPCs
- `src/app/monitor/*`: monitor screen + actions · `src/app/teacher/*`: teacher area + actions
- `src/app/display/*`: corridor screen · `src/app/api/export/route.ts`: CSV
- `supabase/tests/ecopoints_checks.sql`: the rules, as tests
