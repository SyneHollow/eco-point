# EcoPoints: status

_Last updated: 2 Nov 2026 (evening)_

## Done
- Database: schema, RLS, scoring RPCs, peer-check rotation, measuring week, month close, append-only ledger, activity log.
- Rule tests: `supabase/tests/ecopoints_checks.sql`, 46 checks, all passing on Postgres 16, on both an empty and a populated database.
- App: public home, leaderboard, corridor screen; monitor login + daily check + peer check; teacher dashboard, classes & PINs, daily records with void, bonus/adjustment points, checklist editor, month close, certificate (print/PDF), impact report with before/after (print/PDF), CSV export, settings, add teacher.
- End-to-end browser test (14 checks) passed against a local stand-in for Supabase Auth/API on real Postgres.
- Supabase project **Eco-Point** created (Shayaan's free org). Migration applied there; the app's database functions respond.
- `scripts/create-teacher.mjs`: checks the school code before asking questions, explains a name typed in place of the code, no Windows exit crash.

## Not done / next
- [ ] Eco-Point: confirm seed (`1 · 8 · 5` count) and run `supabase/tests/ecopoints_checks.sql` (first run on Postgres 17).
- [ ] School name → "Credence High School"; first teacher via `scripts/create-teacher.mjs`; set class PINs; real class list and sizes.
- [ ] Teachers can't change their own password yet. Add a "change password" screen before handing logins to staff.
- [ ] Deploy to Vercel; corridor screen URL `/display` on the school's display.
- [ ] Pilot with 2 classes, then set `points_start_date` (Settings) for a measuring week before going school-wide.
- [ ] Competition: confirm the name, rules, deadline and whether student-built code is required.
- [ ] Later, if wanted: streaks/badges, Arabic, installable app, login attempt throttling (see GOTCHAS 9).
