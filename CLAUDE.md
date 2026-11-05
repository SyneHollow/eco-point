@AGENTS.md

# EcoPoints: rules for Claude Code

- Read `docs/CONTEXT.md`, `docs/GOTCHAS.md` and `docs/STATUS.md` before changing anything. Update all three as part of every change.
- Survey → approve → build → prove. Never commit or push; the developer commits manually.
- Never run `supabase db push`; schema changes are applied manually.
- Every new table: `school_id`, RLS on, SELECT policy, no client write grants. Every write goes through a SECURITY DEFINER RPC that checks the role first and calls `app.log(...)`.
- `points_ledger` is append-only. Corrections are new rows with a reason.
- After any schema change, `supabase/tests/ecopoints_checks.sql` must still end with ALL ECOPOINTS CHECKS PASSED, and `npm run build` must pass.
- No student personal data, ever.
- Rewards: garden spending only through `garden_buy` (it locks the class row); spending must never write to `points_ledger`, so the leaderboard and badges are unaffected. Rewards tables get no client grants. After changes, `supabase/tests/rewards_checks.sql` must end with ALL REWARDS CHECKS PASSED.
- UI: follow `docs/DESIGN.md`. Icons only via `src/components/icons.tsx`; no emoji, "→", " · " joiners or ALL-CAPS labels; class names shown with `TeamTile`.
- AI: photos are never stored; anything with a person in it is rejected; AI results are written only through `svc_record_ai_check` (service role) after `requireMonitor()`. AI mismatches are flags for a teacher, never automatic penalties.
