-- =============================================================================
-- EcoPoints: CLEAR ALL ACTIVITY (removes the demo data before the real pilot).
--
-- Run in: Supabase SQL editor, project Eco-Point.
-- DELETES every class check, peer check, AI check, points row (incl. bonuses),
-- weekly challenge, closed month, eco challenge done, and every class garden,
-- and clears the points start date. Badge targets, shop prices and the eco
-- challenges themselves stay.
-- KEEPS the school, classes, PINs/logins, teachers, checklist and the activity log.
--
-- The ledger and records are normally undeletable (that's the point of them), so
-- this switches those guards off and back on inside one transaction. If anything
-- fails, nothing is deleted.
-- =============================================================================
begin;

alter table public.points_ledger   disable trigger user;
alter table public.entry_values    disable trigger user;
alter table public.audit_values    disable trigger user;
alter table public.daily_entries   disable trigger user;
alter table public.peer_audits     disable trigger user;
alter table public.month_closures  disable trigger user;
do $$ begin
  if to_regclass('public.ai_checks') is not null then
    execute 'alter table public.ai_checks disable trigger user';
  end if;
  if to_regclass('public.garden_plants') is not null then
    execute 'alter table public.garden_plants disable trigger user';
    execute 'alter table public.garden_events disable trigger user';
    execute 'alter table public.challenge_claims disable trigger user';
  end if;
end $$;

delete from public.points_ledger;
do $$ begin
  if to_regclass('public.garden_plants') is not null then
    execute 'delete from public.garden_events';
    execute 'delete from public.garden_plants';
    execute 'delete from public.challenge_claims';
  end if;
end $$;
do $$ begin
  if to_regclass('public.ai_checks') is not null then execute 'delete from public.ai_checks'; end if;
  if to_regclass('public.class_challenges') is not null then execute 'delete from public.class_challenges'; end if;
end $$;
delete from public.entry_values;
delete from public.audit_values;
delete from public.daily_entries;
delete from public.peer_audits;
delete from public.month_closures;
update public.schools set points_start_date = null where slug = 'school';

alter table public.points_ledger   enable trigger user;
alter table public.entry_values    enable trigger user;
alter table public.audit_values    enable trigger user;
alter table public.daily_entries   enable trigger user;
alter table public.peer_audits     enable trigger user;
alter table public.month_closures  enable trigger user;
do $$ begin
  if to_regclass('public.ai_checks') is not null then
    execute 'alter table public.ai_checks enable trigger user';
  end if;
  if to_regclass('public.garden_plants') is not null then
    execute 'alter table public.garden_plants enable trigger user';
    execute 'alter table public.garden_events enable trigger user';
    execute 'alter table public.challenge_claims enable trigger user';
  end if;
end $$;

commit;

-- Should be all zeros.
select (select count(*) from public.daily_entries) as class_checks,
       (select count(*) from public.peer_audits)   as peer_checks,
       (select count(*) from public.points_ledger) as points_rows;
