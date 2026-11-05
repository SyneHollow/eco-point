# EcoPoints

Class-wise sustainability scoring for a school. Each class's two Eco Monitors record the day's eco habits; another class checks their room (peer check, rotating daily); points add up to a live leaderboard and a **Green Champion of the Month**.

- **Stack:** Next.js 16 (App Router) · Supabase (Postgres + Auth + RLS) · Vercel
- **Read first:** `docs/CONTEXT.md` (what and why), `docs/GOTCHAS.md` (traps), `docs/STATUS.md` (where things stand)

## Screens

| Who | Where | What |
|---|---|---|
| Anyone | `/`, `/leaderboard` | Leaderboard (week / month / last month, by grade), school-wide totals |
| Corridor screen | `/display` | Full-screen, rotates every 12 s, refreshes every 60 s |
| Eco Monitor | `/login` → `/monitor` | Today's class check (counts), **AI bin photo check**, peer check of another class + **AI room photo**, weekly challenge, own results |
| Teacher | `/login?as=teacher` → `/teacher` | Today's status, classes & PINs, daily records (void), **AI checks & flags**, **Ask EcoPoints** + weekly challenges, bonus points, checklist, month close, certificate, impact report, CSV export, settings |

## Set up a new Supabase project

1. Supabase dashboard → New project.
2. SQL Editor → paste and run `supabase/migrations/20261102000000_ecopoints.sql`, then `supabase/migrations/20261103000000_ai_checks.sql`, then `supabase/migrations/20261105000000_rewards.sql`.
3. SQL Editor → paste and run `supabase/seed.sql` (school `school`, classes 7A–8D, the daily checklist).
4. SQL Editor → paste and run `supabase/tests/ecopoints_checks.sql`, then `supabase/tests/rewards_checks.sql`. They must end with **ALL ECOPOINTS CHECKS PASSED** and **ALL REWARDS CHECKS PASSED**. Both roll themselves back.
5. Copy `.env.example` to `.env.local` and fill in the URL, publishable key and secret key (Project Settings → API Keys), and the Gemini API key (Google AI Studio → Get API key; paid tier for real school photos).
6. `npm install`, then `node scripts/create-teacher.mjs` (asks for name, email, password).
7. `npm run dev` → http://localhost:3000 → log in as the teacher → Classes & PINs → set a PIN per class.

Optional, recommended: Authentication → Sign In / Providers → Email → turn **off** "Allow new users to sign up". The app never uses public sign-up. Accounts without an EcoPoints profile can't see or do anything anyway, but there's no reason to leave the door open.

## Deploy (Vercel)

Import the repo in Vercel, add the variables from `.env.example` (Production + Preview), deploy. `SUPABASE_SECRET_KEY` and the AI keys must **not** have a `NEXT_PUBLIC_` prefix.

## Verify

- Database rules: `supabase/tests/ecopoints_checks.sql` (step 4 above).
- App: `npm run build` must finish with no errors.
- By hand: a monitor submits 28 present / 25 plastic-free / 20 bottles → the class gets **12.5 points** (10×25/28 + 5×20/28).
- AI: after that class check, photograph a staged bin with a few wrappers → the AI's count and boxes appear; Teacher → AI checks & flags lists it.
