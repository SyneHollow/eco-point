@AGENTS.md

# EcoPoints: rules for Claude Code

- Read `docs/CONTEXT.md`, `docs/GOTCHAS.md` and `docs/STATUS.md` before changing anything. Update all three as part of every change.
- Survey → approve → build → prove. Never commit or push; the developer commits manually.
- Never run `supabase db push`; schema changes are applied manually.
- Every new table: `school_id`, RLS on, SELECT policy, no client write grants. Every write goes through a SECURITY DEFINER RPC that checks the role first and calls `app.log(...)`.
- `points_ledger` is append-only. Corrections are new rows with a reason.
- After any schema change, `supabase/tests/ecopoints_checks.sql` must still end with ALL ECOPOINTS CHECKS PASSED, and `npm run build` must pass.
- No student personal data, ever.
- Rewards: the garden is bought with **leaves**, never points. Spending only through `garden_buy` (it locks the class row) and must never write to `points_ledger`. Leaves come from `app.leaf_sources` (live records + `leaf_grants`); never add a leaves column to `points_ledger` or a points cost to the shop. Rewards tables get no client grants. After changes, `supabase/tests/rewards_checks.sql` must end with ALL REWARDS CHECKS PASSED.
- UI: follow `docs/DESIGN.md`. Icons only via `src/components/icons.tsx`; no emoji, "→", " · " joiners or ALL-CAPS labels; class names shown with `TeamTile`.
- AI: photos are never stored; anything with a person in it is rejected; AI results are written only through `svc_record_ai_check` (service role) after `requireMonitor()`. AI mismatches are flags for a teacher, never automatic penalties.
- No Nexayra branding anywhere in this project (screens, footers, printouts, corridor screen, docs, metadata). It is the school's app, not a Nexayra product.
