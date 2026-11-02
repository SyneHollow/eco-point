# EcoPoints: status

_Last updated: 2 Nov 2026_

## Done
- Database: schema, RLS, scoring RPCs, peer-check rotation, measuring week, month close, append-only ledger, activity log.
- Rule tests: `supabase/tests/ecopoints_checks.sql`, 46 checks, all passing on Postgres 16, on both an empty and a populated database (Supabase uses 17; not yet run there).
- App: public home, leaderboard, corridor screen; monitor login + daily check + peer check; teacher dashboard, classes & PINs, daily records with void, bonus/adjustment points, checklist editor, month close, certificate (print/PDF), impact report with before/after (print/PDF), CSV export, settings, add teacher.
- End-to-end browser test (14 checks) passed against a local stand-in for Supabase Auth/API on real Postgres.

## Not done / next
- [ ] Create the Supabase project, run migration + seed + checks there (never run against real Supabase yet).
- [ ] First teacher via `scripts/create-teacher.mjs`; set class PINs; correct class sizes.
- [ ] Deploy to Vercel; corridor screen URL `/display` on the school's display.
- [ ] Pilot with 2 classes, then set `points_start_date` (Settings) for a measuring week before going school-wide.
- [ ] Competition: confirm the name, rules, deadline and whether student-built code is required.
- [ ] Later, if wanted: streaks/badges, Arabic, installable app, login attempt throttling (see GOTCHAS 9).
