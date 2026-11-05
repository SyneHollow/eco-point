# EcoPoints: status

_Last updated: 5 Nov 2026 (rewards: badges, gardens, QR challenges)_

## Done
- Database: schema, RLS, scoring RPCs, peer-check rotation, measuring week, month close, append-only ledger, activity log.
- Rule tests: `supabase/tests/ecopoints_checks.sql`, 46 checks, all passing on Postgres 16, on both an empty and a populated database.
- App: public home, leaderboard, corridor screen; monitor login + daily check + peer check; teacher dashboard, classes & PINs, daily records with void, bonus/adjustment points, checklist editor, month close, certificate (print/PDF), impact report with before/after (print/PDF), CSV export, settings, add teacher.
- End-to-end browser test (14 checks) passed against a local stand-in for Supabase Auth/API on real Postgres.
- Supabase project **Eco-Point** created (Shayaan's free org). Migration applied there; the app's database functions respond.
- `scripts/create-teacher.mjs`: checks the school code before asking questions, explains a name typed in place of the code, no Windows exit crash.
- **AI referee (3 Nov):** bin and room photo checks with boxes drawn on the photo, AI-vs-entry cross-check flags, pattern flags, teacher review/void, Ask EcoPoints, AI-drafted weekly challenges, AI figures on leaderboard, corridor screen and impact report, AI settings. Rule checks now 66 (all pass); AI reply clean-up 15 unit tests; AI browser test 30 checks pass against a fake Gemini and a fake Claude server (proves request format, photo shrinking to ≤ 1288 px, key handling, provider switch).

- **UI redesign "match day" (4 Nov):** new design system (`docs/DESIGN.md`): team colours per class, scoreboard type, SVG medals and icons (no emoji), podium hero on home and leaderboard, class-tile login, monitor step timeline with "jobs done" bar, teacher sidebar, TV sized to 1080p with pause, self-hosted fonts. No logic, database or AI changes. Re-tested: build passes; v1 browser test 14/14; AI browser test 30/30; no sideways scrolling at 390 px; all text contrast AA; keyboard focus visible.

- **Demo data (5 Nov):** `supabase/seed-demo-month.sql` fills the 1st of last month to yesterday with fake class checks, peer checks (real rotation), AI bin checks, 4 bonuses and 2 AI flags; first week is a measuring week so the report shows before/after. `supabase/seed-demo-month-undo.sql` clears all activity. Tested: safe to run twice, skips closed months, works with or without the AI migration, totals match the app's leaderboard, guards back on after undo.

- **Rewards (5 Nov):** monthly class badges (6 tiers, rare plant rewards), a virtual garden per class (shop, watering and growth stages, move/swap, shed, history, celebrations), QR eco challenges (3 instant + 8 class projects, printable posters, teacher review/void), Monitor tabs (Today / Garden / Challenges), teacher pages "Eco challenges" and "Badges & gardens", badges on the leaderboard, two new corridor-screen slides. Demo data now includes gardens and challenges. Tested: rewards rule checks pass (overspend, limits, review, void, isolation, guards); 35 rewards browser checks; 66 v1 rule checks; v1 browser 14/14; AI 30/30. The v1 rule test had a date-dependent assumption (failed on 5 Nov only because of the peer rotation); fixed.

## Not done / next
- [ ] Eco-Point: run `supabase/migrations/20261103000000_ai_checks.sql`, then the checks file again.
- [ ] Gemini API key (paid tier for school photos) in `.env.local` and Vercel; first real test with 3–5 staged bin photos. 4 Nov: first real try failed with the old generic message; default switched to `gemini-3.5-flash-lite` with `gemini-3.8-flash` as automatic backup, and the screen now shows the real reason.
- [ ] Pilot accuracy test: ~30 bins counted by hand vs AI; quote the real figure in the pitch.
- [ ] Eco-Point: confirm seed (`1 · 8 · 5` count) and run `supabase/tests/ecopoints_checks.sql` (first run on Postgres 17).
- [ ] School name → "Credence High School"; first teacher via `scripts/create-teacher.mjs`; set class PINs; real class list and sizes.
- [ ] Teachers can't change their own password yet. Add a "change password" screen before handing logins to staff.
- [ ] Deploy to Vercel; corridor screen URL `/display` on the school's display.
- [ ] Pilot with 2 classes, then set `points_start_date` (Settings) for a measuring week before going school-wide.
- [ ] Competition: confirm the name, rules, deadline and whether student-built code is required.
- [ ] Eco-Point: run `supabase/migrations/20261105000000_rewards.sql`, then `supabase/tests/rewards_checks.sql` (and re-run the demo seed if you want gardens and challenges in the demo).
- [ ] Vercel: set `NEXT_PUBLIC_SITE_URL` to the live address, then print the QR posters from Teacher → Eco challenges → Print QR codes.
- [ ] More reward ideas you mentioned (to come): special awards, garden themes, avatars, school forest.
- [ ] **Before the real pilot:** run `supabase/seed-demo-month-undo.sql` on Eco-Point to remove the demo data, then set the real points start date in Settings.
- [ ] Look over the new UI on a real phone, a classroom smartboard and the corridor TV (fonts, colours, the podium animation).
- [ ] Later, if wanted: streaks/badges, Arabic, installable app, login attempt throttling (see GOTCHAS 9).
