@AGENTS.md

# EcoPoints: rules for Claude Code

- Read `docs/CONTEXT.md`, `docs/GOTCHAS.md` and `docs/STATUS.md` before changing anything. Update all three as part of every change.
- Survey → approve → build → prove. Never commit or push; the developer commits manually.
- Never run `supabase db push`; schema changes are applied manually.
- Every new table: `school_id`, RLS on, SELECT policy, no client write grants. Every write goes through a SECURITY DEFINER RPC that checks the role first and calls `app.log(...)`.
- `points_ledger` is append-only. Corrections are new rows with a reason.
- After any schema change, `supabase/tests/ecopoints_checks.sql` must still end with ALL ECOPOINTS CHECKS PASSED, and `npm run build` must pass.
- No student personal data, ever.
- AI: photos are never stored; anything with a person in it is rejected; AI results are written only through `svc_record_ai_check` (service role) after `requireMonitor()`. AI mismatches are flags for a teacher, never automatic penalties.
