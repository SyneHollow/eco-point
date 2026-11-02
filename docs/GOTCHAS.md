# EcoPoints: gotchas

1. **Supabase grants everything in `public` to anon/authenticated by default.** The migration revokes it all at the end and re-grants exactly what's needed. Any new table or function needs the same treatment: enable RLS, add a SELECT policy if clients read it, and `revoke … from public, anon, authenticated` on new functions, then grant only what's intended. Re-run `supabase/tests/ecopoints_checks.sql` after any schema change.
2. **Function bodies use `set search_path = ''`.** Fully qualify everything (`public.classes`, `auth.uid()`), or the function fails at runtime, not at creation.
3. **Next.js 16:** `middleware.ts` is now `src/proxy.ts`, and `params`/`searchParams`/`cookies()` are async. The scaffold's `cacheComponents` / `partialPrefetching` are deliberately **off**: every page is live data and they'd force Suspense boundaries everywhere. Bundled docs are in `node_modules/next/dist/docs/`.
4. **PINs are 6 digits**, not 4: Supabase Auth's minimum password length is 6.
5. **Monitor login addresses** are `ecopoints-m-<class uuid>@<MONITOR_EMAIL_DOMAIN>`. No email is ever sent. Changing `MONITOR_EMAIL_DOMAIN` after PINs exist breaks those logins (reset each PIN to recreate).
6. **Checklist edits are forward-only.** An item's code, type (count / yes-no) and who answers are fixed once created, because past answers depend on them. Label, points, SDGs, order and on/off can change; past points don't.
7. **Closing a month is permanent.** Void or adjust first. The database refuses any points row dated in a closed month.
8. **"Today" comes from the database** in the school's time zone (`schools.timezone`, default Asia/Dubai), never from the server clock.
9. **Login rate limiting:** monitor/teacher sign-in goes through a server action, so Supabase's per-IP auth limits see Vercel's IP, not the student's. Low risk for a pilot (a class login only reaches eco points), but if this goes wider, add attempt throttling or move sign-in to the browser client.
10. **Server-action success messages vanish** when the action changes what the page shows (e.g. closing a month replaces the button with the result). That's expected.
