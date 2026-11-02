-- =============================================================================
-- EcoPoints v1 — class-wise sustainability scoring
--
-- Security model (read this before changing anything):
--   * Every table carries school_id (tenant). RLS is ON for every table.
--   * Browser clients get SELECT only, filtered by RLS. They never INSERT/UPDATE/
--     DELETE tables directly; every write goes through a SECURITY DEFINER RPC
--     below that checks the caller's role (teacher / monitor) first.
--   * points_ledger is append-only. Corrections are new 'reversal' /
--     'adjustment' rows with a reason. Closed months are frozen.
--   * No student personal data is stored. Monitor accounts are per CLASS.
--   * Anonymous visitors (leaderboard, corridor screen) only reach aggregate
--     RPCs: public_school, public_classes, get_leaderboard, get_impact,
--     get_champions.
-- =============================================================================

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------- tables ----

create table public.schools (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name              text not null check (length(trim(name)) between 2 and 120),
  timezone          text not null default 'Asia/Dubai',
  points_start_date date,  -- days before this are BASELINE: counts recorded, no points
  created_at        timestamptz not null default now()
);

create table public.classes (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id),
  grade      smallint not null check (grade between 1 and 12),
  section    text not null check (section ~ '^[A-Z]{1,2}$'),
  name       text generated always as (grade::text || section) stored,
  strength   smallint not null check (strength between 1 and 80),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, grade, section)
);
create index classes_school_idx on public.classes(school_id);

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  school_id    uuid not null references public.schools(id),
  role         text not null check (role in ('teacher', 'monitor')),
  class_id     uuid references public.classes(id),
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  created_at   timestamptz not null default now(),
  check ((role = 'monitor') = (class_id is not null))
);
create unique index profiles_one_monitor_per_class on public.profiles(class_id) where role = 'monitor';
create index profiles_school_idx on public.profiles(school_id);

create table public.actions (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id),
  code        text not null check (code ~ '^[a-z0-9_]{2,40}$'),
  label       text not null check (length(trim(label)) between 2 and 80),
  help        text,
  input_type  text not null check (input_type in ('count', 'check')),
  entered_by  text not null check (entered_by in ('self', 'peer')),
  max_points  numeric(5,2) not null check (max_points > 0 and max_points <= 100),
  sdgs        smallint[] not null default '{}',
  sort_order  smallint not null default 0,
  active      boolean not null default true,
  unique (school_id, code),
  -- peer auditors only answer yes/no; counting students is the class's own job
  check (not (input_type = 'count' and entered_by = 'peer'))
);

create table public.daily_entries (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id),
  class_id     uuid not null references public.classes(id),
  entry_date   date not null,
  present      smallint not null check (present between 1 and 80),
  is_baseline  boolean not null,
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz not null default now(),
  voided_at    timestamptz,
  voided_by    uuid references public.profiles(id),
  void_reason  text,
  check ((voided_at is null) = (voided_by is null))
);
create unique index daily_entries_one_live_per_day on public.daily_entries(class_id, entry_date) where voided_at is null;
create index daily_entries_school_date_idx on public.daily_entries(school_id, entry_date);

create table public.entry_values (
  entry_id  uuid not null references public.daily_entries(id),
  action_id uuid not null references public.actions(id),
  value     smallint not null check (value >= 0),
  primary key (entry_id, action_id)
);

create table public.peer_audits (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id),
  target_class_id  uuid not null references public.classes(id),
  auditor_class_id uuid not null references public.classes(id),
  audit_date       date not null,
  is_baseline      boolean not null,
  submitted_by     uuid not null references public.profiles(id),
  submitted_at     timestamptz not null default now(),
  voided_at        timestamptz,
  voided_by        uuid references public.profiles(id),
  void_reason      text,
  check (target_class_id <> auditor_class_id),
  check ((voided_at is null) = (voided_by is null))
);
create unique index peer_audits_one_live_per_target_day on public.peer_audits(target_class_id, audit_date) where voided_at is null;
create index peer_audits_school_date_idx on public.peer_audits(school_id, audit_date);

create table public.audit_values (
  audit_id  uuid not null references public.peer_audits(id),
  action_id uuid not null references public.actions(id),
  value     smallint not null check (value in (0, 1)),
  primary key (audit_id, action_id)
);

create table public.points_ledger (
  id          bigint generated always as identity primary key,
  school_id   uuid not null references public.schools(id),
  class_id    uuid not null references public.classes(id),
  points_date date not null,
  source      text not null check (source in ('daily', 'audit', 'bonus', 'adjustment', 'reversal')),
  action_id   uuid references public.actions(id),
  entry_id    uuid references public.daily_entries(id),
  audit_id    uuid references public.peer_audits(id),
  reverses_id bigint references public.points_ledger(id),
  points      numeric(7,2) not null,
  reason      text,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  check (source in ('daily', 'audit') or length(trim(coalesce(reason, ''))) >= 3)
);
create index points_ledger_school_date_idx on public.points_ledger(school_id, points_date);
create index points_ledger_class_date_idx on public.points_ledger(class_id, points_date);
create index points_ledger_entry_idx on public.points_ledger(entry_id) where entry_id is not null;
create index points_ledger_audit_idx on public.points_ledger(audit_id) where audit_id is not null;

create table public.month_closures (
  school_id         uuid not null references public.schools(id),
  month             date not null check (extract(day from month) = 1),
  champion_class_id uuid references public.classes(id),
  champion_points   numeric(8,2),
  was_tie           boolean not null default false,
  closed_by         uuid not null references public.profiles(id),
  closed_at         timestamptz not null default now(),
  primary key (school_id, month)
);

create table public.activity_log (
  id        bigint generated always as identity primary key,
  school_id uuid references public.schools(id),
  actor_id  uuid,
  action    text not null,
  entity    text not null,
  entity_id text,
  details   jsonb not null default '{}'::jsonb,
  at        timestamptz not null default now()
);
create index activity_log_school_at_idx on public.activity_log(school_id, at desc);

-- --------------------------------------------------------------- helpers ----

create function app.my_school_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select school_id from public.profiles where id = auth.uid()
$$;

create function app.my_class_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select class_id from public.profiles where id = auth.uid()
$$;

create function app.is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')
$$;

create function app.school_today(p_school uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone s.timezone)::date from public.schools s where s.id = p_school
$$;

create function app.require_teacher() returns public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null or p.role <> 'teacher' then
    raise exception 'Only teachers can do this' using errcode = '42501';
  end if;
  return p;
end $$;

create function app.require_monitor() returns public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null or p.role <> 'monitor' then
    raise exception 'Only Eco Monitors can do this' using errcode = '42501';
  end if;
  return p;
end $$;

create function app.require_reason(p_reason text) returns text
language plpgsql immutable set search_path = '' as $$
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Please give a reason (at least 3 characters)';
  end if;
  return trim(p_reason);
end $$;

create function app.log(p_school uuid, p_actor uuid, p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.activity_log (school_id, actor_id, action, entity, entity_id, details)
  values (p_school, p_actor, p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

-- Peer-audit rotation. Active classes sorted by grade+section get index i (0..n-1).
-- On day d, class i checks class (i + k) mod n, where k = 1 + (d mod (n-1)).
-- k is never 0, so nobody checks themselves, and each day every class is checked
-- by exactly one other class. k changes daily, so pairings rotate.
create function app.audit_target(p_auditor uuid, p_date date) returns uuid
language sql stable security definer set search_path = '' as $$
  with c as (
    select id,
           (row_number() over (order by grade, section) - 1)::int as i,
           (count(*) over ())::int as n
      from public.classes
     where school_id = (select school_id from public.classes where id = p_auditor) and active
  ), me as (select i, n from c where id = p_auditor)
  select c.id from c, me
   where me.n >= 2
     and c.i = (me.i + 1 + ((p_date - date '2024-01-01') % (me.n - 1))) % me.n
$$;

create function app.audited_by(p_target uuid, p_date date) returns uuid
language sql stable security definer set search_path = '' as $$
  with c as (
    select id,
           (row_number() over (order by grade, section) - 1)::int as i,
           (count(*) over ())::int as n
      from public.classes
     where school_id = (select school_id from public.classes where id = p_target) and active
  ), me as (select i, n from c where id = p_target)
  select c.id from c, me
   where me.n >= 2
     and c.i = (((me.i - 1 - ((p_date - date '2024-01-01') % (me.n - 1))) % me.n) + me.n) % me.n
$$;

-- ----------------------------------------------------- integrity triggers ----

create function app.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only: add a correcting row instead', tg_table_name using errcode = '42501';
end $$;

create trigger points_ledger_append_only before update or delete on public.points_ledger
  for each row execute function app.forbid_change();
create trigger points_ledger_no_truncate before truncate on public.points_ledger
  for each statement execute function app.forbid_change();
create trigger month_closures_append_only before update or delete on public.month_closures
  for each row execute function app.forbid_change();
create trigger activity_log_append_only before update or delete on public.activity_log
  for each row execute function app.forbid_change();
create trigger entry_values_append_only before update or delete on public.entry_values
  for each row execute function app.forbid_change();
create trigger audit_values_append_only before update or delete on public.audit_values
  for each row execute function app.forbid_change();

create function app.ledger_month_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.month_closures m
              where m.school_id = new.school_id
                and m.month = date_trunc('month', new.points_date)::date) then
    raise exception 'That month is closed, so its points can''t change';
  end if;
  return new;
end $$;
create trigger points_ledger_closed_month before insert on public.points_ledger
  for each row execute function app.ledger_month_guard();

-- Entries / audits: the only allowed update is voiding (once).
create function app.void_only_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception '% rows can''t be deleted: void them instead', tg_table_name using errcode = '42501';
  end if;
  if old.voided_at is not null
     or (to_jsonb(new) - array['voided_at','voided_by','void_reason'])
        is distinct from (to_jsonb(old) - array['voided_at','voided_by','void_reason']) then
    raise exception 'Submitted records can''t be edited: void and resubmit instead' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger daily_entries_void_only before update or delete on public.daily_entries
  for each row execute function app.void_only_guard();
create trigger peer_audits_void_only before update or delete on public.peer_audits
  for each row execute function app.void_only_guard();

-- -------------------------------------------------------------------- RLS ----

alter table public.schools        enable row level security;
alter table public.classes        enable row level security;
alter table public.profiles       enable row level security;
alter table public.actions        enable row level security;
alter table public.daily_entries  enable row level security;
alter table public.entry_values   enable row level security;
alter table public.peer_audits    enable row level security;
alter table public.audit_values   enable row level security;
alter table public.points_ledger  enable row level security;
alter table public.month_closures enable row level security;
alter table public.activity_log   enable row level security;

create policy schools_read on public.schools for select to authenticated
  using (id = (select app.my_school_id()));
create policy classes_read on public.classes for select to authenticated
  using (school_id = (select app.my_school_id()));
create policy actions_read on public.actions for select to authenticated
  using (school_id = (select app.my_school_id()));
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid())
         or ((select app.is_teacher()) and school_id = (select app.my_school_id())));
create policy daily_entries_read on public.daily_entries for select to authenticated
  using (school_id = (select app.my_school_id())
         and ((select app.is_teacher()) or class_id = (select app.my_class_id())));
create policy entry_values_read on public.entry_values for select to authenticated
  using (exists (select 1 from public.daily_entries e where e.id = entry_id));
create policy peer_audits_read on public.peer_audits for select to authenticated
  using (school_id = (select app.my_school_id())
         and ((select app.is_teacher())
              or target_class_id = (select app.my_class_id())
              or auditor_class_id = (select app.my_class_id())));
create policy audit_values_read on public.audit_values for select to authenticated
  using (exists (select 1 from public.peer_audits a where a.id = audit_id));
create policy points_ledger_read on public.points_ledger for select to authenticated
  using (school_id = (select app.my_school_id())
         and ((select app.is_teacher()) or class_id = (select app.my_class_id())));
create policy month_closures_read on public.month_closures for select to authenticated
  using (school_id = (select app.my_school_id()));
create policy activity_log_read on public.activity_log for select to authenticated
  using ((select app.is_teacher()) and school_id = (select app.my_school_id()));

-- ------------------------------------------------------- public (anon) RPCs ----

create function public.public_school(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name, 'slug', s.slug, 'timezone', s.timezone,
    'today', (now() at time zone s.timezone)::date,
    'points_start_date', s.points_start_date,
    'baseline', s.points_start_date is not null and (now() at time zone s.timezone)::date < s.points_start_date)
  from public.schools s where s.slug = p_slug
$$;

create function public.public_classes(p_slug text)
returns table (id uuid, name text, grade smallint, section text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.grade, c.section
    from public.classes c join public.schools s on s.id = c.school_id
   where s.slug = p_slug and c.active
   order by c.grade, c.section
$$;

create function public.get_leaderboard(p_slug text, p_from date, p_to date)
returns table (class_id uuid, class_name text, grade smallint, points numeric, days_submitted int, rank int)
language plpgsql stable security definer set search_path = '' as $$
declare v_school uuid;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Invalid date range';
  end if;
  select id into v_school from public.schools where slug = p_slug;
  return query
    with pts as (
      select l.class_id, sum(l.points) as p from public.points_ledger l
       where l.school_id = v_school and l.points_date between p_from and p_to group by l.class_id
    ), days as (
      select e.class_id, count(*) as d from public.daily_entries e
       where e.school_id = v_school and e.voided_at is null and e.entry_date between p_from and p_to
       group by e.class_id
    )
    select c.id, c.name, c.grade, coalesce(pts.p, 0)::numeric, coalesce(days.d, 0)::int,
           (rank() over (order by coalesce(pts.p, 0) desc))::int
      from public.classes c
      left join pts on pts.class_id = c.id
      left join days on days.class_id = c.id
     where c.school_id = v_school and c.active
     order by coalesce(pts.p, 0) desc, c.grade, c.section;
end $$;

-- Totals for a period. pct: count items = sum(value)/sum(present)*100;
-- yes/no items = share of 'yes' answers.
create function public.get_impact(p_slug text, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_school uuid; v jsonb;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Invalid date range';
  end if;
  select id into v_school from public.schools where slug = p_slug;
  if v_school is null then return null; end if;
  with e as (
    select * from public.daily_entries
     where school_id = v_school and voided_at is null and entry_date between p_from and p_to
  ), a as (
    select * from public.peer_audits
     where school_id = v_school and voided_at is null and audit_date between p_from and p_to
  ), vals as (
    select ev.action_id, sum(ev.value)::numeric as total, sum(e.present)::numeric as denom, count(*) as n
      from public.entry_values ev join e on e.id = ev.entry_id group by ev.action_id
    union all
    select av.action_id, sum(av.value)::numeric, count(*)::numeric, count(*)
      from public.audit_values av join a on a.id = av.audit_id group by av.action_id
  ), items as (
    select act.code, act.label, act.input_type, act.entered_by, act.sdgs, act.sort_order,
           coalesce(sum(vals.total), 0) as total,
           case when coalesce(sum(vals.denom), 0) > 0
                then round(100 * sum(vals.total) / sum(vals.denom), 1) end as pct,
           coalesce(sum(vals.n), 0) as answers
      from public.actions act left join vals on vals.action_id = act.id
     where act.school_id = v_school and (act.active or vals.action_id is not null)
     group by act.id
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'entries', (select count(*) from e),
    'audits', (select count(*) from a),
    'student_days', (select coalesce(sum(present), 0) from e),
    'points', (select coalesce(sum(points), 0) from public.points_ledger
                where school_id = v_school and points_date between p_from and p_to),
    'eco_actions', (select coalesce(sum(total), 0) from items),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                'code', code, 'label', label, 'input_type', input_type, 'entered_by', entered_by,
                'sdgs', sdgs, 'total', total, 'pct', pct, 'answers', answers) order by sort_order, code)
              from items), '[]'::jsonb)
  ) into v;
  return v;
end $$;

create function public.get_champions(p_slug text)
returns table (month date, class_name text, points numeric, was_tie boolean)
language sql stable security definer set search_path = '' as $$
  select m.month, c.name, m.champion_points, m.was_tie
    from public.month_closures m
    join public.schools s on s.id = m.school_id
    left join public.classes c on c.id = m.champion_class_id
   where s.slug = p_slug
   order by m.month desc
   limit 24
$$;

-- ------------------------------------------------------- signed-in RPCs ----

create function public.whoami() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', p.id, 'role', p.role, 'display_name', p.display_name,
    'school_id', s.id, 'school_name', s.name, 'school_slug', s.slug, 'timezone', s.timezone,
    'today', (now() at time zone s.timezone)::date,
    'points_start_date', s.points_start_date,
    'baseline', s.points_start_date is not null and (now() at time zone s.timezone)::date < s.points_start_date,
    'class_id', c.id, 'class_name', c.name)
  from public.profiles p
  join public.schools s on s.id = p.school_id
  left join public.classes c on c.id = p.class_id
  where p.id = auth.uid()
$$;

-- Everything the monitor screen needs in one call.
create function public.my_today() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles; v_school public.schools; v_class public.classes;
  v_today date; v_target uuid; v_by uuid; v jsonb;
begin
  me := app.require_monitor();
  select * into v_school from public.schools where id = me.school_id;
  select * into v_class from public.classes where id = me.class_id;
  v_today := (now() at time zone v_school.timezone)::date;
  v_target := app.audit_target(me.class_id, v_today);
  v_by := app.audited_by(me.class_id, v_today);
  select jsonb_build_object(
    'today', v_today,
    'class', jsonb_build_object('id', v_class.id, 'name', v_class.name, 'strength', v_class.strength, 'active', v_class.active),
    'school_name', v_school.name,
    'baseline', v_school.points_start_date is not null and v_today < v_school.points_start_date,
    'points_start_date', v_school.points_start_date,
    'self_actions', coalesce((select jsonb_agg(jsonb_build_object('code', a.code, 'label', a.label, 'help', a.help,
                       'input_type', a.input_type, 'max_points', a.max_points, 'sdgs', a.sdgs) order by a.sort_order, a.code)
                     from public.actions a where a.school_id = me.school_id and a.active and a.entered_by = 'self'), '[]'::jsonb),
    'peer_actions', coalesce((select jsonb_agg(jsonb_build_object('code', a.code, 'label', a.label, 'help', a.help,
                       'max_points', a.max_points, 'sdgs', a.sdgs) order by a.sort_order, a.code)
                     from public.actions a where a.school_id = me.school_id and a.active and a.entered_by = 'peer'), '[]'::jsonb),
    'entry', (select jsonb_build_object(
                'id', e.id, 'present', e.present, 'submitted_at', e.submitted_at, 'baseline', e.is_baseline,
                'values', coalesce((select jsonb_object_agg(a.code, ev.value) from public.entry_values ev
                                     join public.actions a on a.id = ev.action_id where ev.entry_id = e.id), '{}'::jsonb),
                'points', coalesce((select sum(points) from public.points_ledger where entry_id = e.id), 0))
              from public.daily_entries e
             where e.class_id = me.class_id and e.entry_date = v_today and e.voided_at is null),
    'audit_target', (select jsonb_build_object('id', c.id, 'name', c.name) from public.classes c where c.id = v_target),
    'audit_done', (select jsonb_build_object(
                'id', pa.id, 'submitted_at', pa.submitted_at,
                'values', coalesce((select jsonb_object_agg(a.code, av.value) from public.audit_values av
                                     join public.actions a on a.id = av.action_id where av.audit_id = pa.id), '{}'::jsonb),
                'points', coalesce((select sum(points) from public.points_ledger where audit_id = pa.id), 0))
              from public.peer_audits pa
             where pa.target_class_id = v_target and pa.audit_date = v_today and pa.voided_at is null),
    'checked_by', (select c.name from public.classes c where c.id = v_by),
    'my_check_result', (select jsonb_build_object(
                'points', coalesce((select sum(points) from public.points_ledger where audit_id = pa.id), 0),
                'values', coalesce((select jsonb_object_agg(a.code, av.value) from public.audit_values av
                                     join public.actions a on a.id = av.action_id where av.audit_id = pa.id), '{}'::jsonb))
              from public.peer_audits pa
             where pa.target_class_id = me.class_id and pa.audit_date = v_today and pa.voided_at is null),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('date', d.points_date, 'points', d.p) order by d.points_date desc)
                 from (select points_date, sum(points) as p from public.points_ledger
                        where class_id = me.class_id and points_date > v_today - 14
                        group by points_date) d), '[]'::jsonb)
  ) into v;
  return v;
end $$;

create function public.submit_daily_entry(p_present int, p_values jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles; v_school public.schools; v_class public.classes;
  v_today date; v_baseline boolean; v_entry uuid; v_total numeric := 0;
  a record; v_raw jsonb; v_num numeric; v_val int; v_pts numeric; v_code text;
begin
  me := app.require_monitor();
  select * into v_class from public.classes where id = me.class_id;
  if not v_class.active then raise exception 'Class % is not active', v_class.name; end if;
  select * into v_school from public.schools where id = me.school_id;
  v_today := (now() at time zone v_school.timezone)::date;

  if p_present is null or p_present < 1 then
    raise exception 'Enter how many students are present today';
  end if;
  if p_present > v_class.strength then
    raise exception 'Present (%) is more than the class strength (%). Ask your teacher to update the class size.', p_present, v_class.strength;
  end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' then
    raise exception 'Invalid form data';
  end if;
  for v_code in select jsonb_object_keys(p_values) loop
    if not exists (select 1 from public.actions where school_id = me.school_id and code = v_code
                    and active and entered_by = 'self') then
      raise exception 'Unknown item: %', v_code;
    end if;
  end loop;

  v_baseline := v_school.points_start_date is not null and v_today < v_school.points_start_date;
  begin
    insert into public.daily_entries (school_id, class_id, entry_date, present, is_baseline, submitted_by)
    values (me.school_id, me.class_id, v_today, p_present, v_baseline, me.id)
    returning id into v_entry;
  exception when unique_violation then
    raise exception 'Today''s entry for % has already been submitted', v_class.name;
  end;

  for a in select * from public.actions
            where school_id = me.school_id and active and entered_by = 'self'
            order by sort_order, code loop
    v_raw := p_values -> a.code;
    if v_raw is null or jsonb_typeof(v_raw) <> 'number' then
      raise exception 'Missing answer for "%"', a.label;
    end if;
    v_num := (v_raw #>> '{}')::numeric;
    if v_num <> trunc(v_num) then raise exception '"%" must be a whole number', a.label; end if;
    v_val := v_num::int;
    if a.input_type = 'count' then
      if v_val < 0 or v_val > p_present then
        raise exception '"%" must be between 0 and % (students present)', a.label, p_present;
      end if;
      v_pts := round(a.max_points * v_val / p_present, 2);
    else
      if v_val not in (0, 1) then raise exception '"%" must be yes or no', a.label; end if;
      v_pts := a.max_points * v_val;
    end if;
    insert into public.entry_values (entry_id, action_id, value) values (v_entry, a.id, v_val);
    if not v_baseline and v_pts <> 0 then
      insert into public.points_ledger (school_id, class_id, points_date, source, action_id, entry_id, points, created_by)
      values (me.school_id, me.class_id, v_today, 'daily', a.id, v_entry, v_pts, me.id);
      v_total := v_total + v_pts;
    end if;
  end loop;

  perform app.log(me.school_id, me.id, 'entry.submit', 'daily_entry', v_entry::text,
    jsonb_build_object('class', v_class.name, 'present', p_present, 'values', p_values, 'baseline', v_baseline, 'points', v_total));
  return jsonb_build_object('entry_id', v_entry, 'points', v_total, 'baseline', v_baseline, 'date', v_today);
end $$;

create function public.submit_peer_audit(p_values jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles; v_school public.schools; v_today date; v_target public.classes;
  v_baseline boolean; v_audit uuid; v_total numeric := 0;
  a record; v_raw jsonb; v_val int; v_pts numeric; v_code text;
begin
  me := app.require_monitor();
  select * into v_school from public.schools where id = me.school_id;
  v_today := (now() at time zone v_school.timezone)::date;
  select * into v_target from public.classes where id = app.audit_target(me.class_id, v_today);
  if v_target.id is null then
    raise exception 'No peer check today (needs at least 2 active classes)';
  end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' then
    raise exception 'Invalid form data';
  end if;
  for v_code in select jsonb_object_keys(p_values) loop
    if not exists (select 1 from public.actions where school_id = me.school_id and code = v_code
                    and active and entered_by = 'peer') then
      raise exception 'Unknown item: %', v_code;
    end if;
  end loop;

  v_baseline := v_school.points_start_date is not null and v_today < v_school.points_start_date;
  begin
    insert into public.peer_audits (school_id, target_class_id, auditor_class_id, audit_date, is_baseline, submitted_by)
    values (me.school_id, v_target.id, me.class_id, v_today, v_baseline, me.id)
    returning id into v_audit;
  exception when unique_violation then
    raise exception '% has already been checked today', v_target.name;
  end;

  for a in select * from public.actions
            where school_id = me.school_id and active and entered_by = 'peer'
            order by sort_order, code loop
    v_raw := p_values -> a.code;
    if v_raw is null or jsonb_typeof(v_raw) <> 'number' or (v_raw #>> '{}') not in ('0', '1') then
      raise exception 'Answer yes or no for "%"', a.label;
    end if;
    v_val := (v_raw #>> '{}')::int;
    v_pts := a.max_points * v_val;
    insert into public.audit_values (audit_id, action_id, value) values (v_audit, a.id, v_val);
    if not v_baseline and v_pts <> 0 then
      insert into public.points_ledger (school_id, class_id, points_date, source, action_id, audit_id, points, created_by)
      values (me.school_id, v_target.id, v_today, 'audit', a.id, v_audit, v_pts, me.id);
      v_total := v_total + v_pts;
    end if;
  end loop;

  perform app.log(me.school_id, me.id, 'audit.submit', 'peer_audit', v_audit::text,
    jsonb_build_object('target', v_target.name, 'values', p_values, 'baseline', v_baseline, 'points', v_total));
  return jsonb_build_object('audit_id', v_audit, 'target', v_target.name, 'points', v_total, 'baseline', v_baseline);
end $$;

create function public.award_points(p_class_id uuid, p_kind text, p_points numeric, p_reason text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_class public.classes; v_reason text; v_id bigint;
begin
  me := app.require_teacher();
  select * into v_class from public.classes where id = p_class_id and school_id = me.school_id;
  if v_class.id is null then raise exception 'Class not found'; end if;
  if p_kind not in ('bonus', 'adjustment') then raise exception 'Unknown kind: %', p_kind; end if;
  if p_points is null or p_points <> round(p_points, 2) then raise exception 'Points must have at most 2 decimals'; end if;
  if p_kind = 'bonus' and (p_points <= 0 or p_points > 100) then
    raise exception 'Bonus must be more than 0 and at most 100';
  end if;
  if p_kind = 'adjustment' and (p_points = 0 or abs(p_points) > 100) then
    raise exception 'Adjustment must be between -100 and 100 and not 0';
  end if;
  v_reason := app.require_reason(p_reason);
  insert into public.points_ledger (school_id, class_id, points_date, source, points, reason, created_by)
  values (me.school_id, v_class.id, app.school_today(me.school_id), p_kind, p_points, v_reason, me.id)
  returning id into v_id;
  perform app.log(me.school_id, me.id, 'points.' || p_kind, 'points_ledger', v_id::text,
    jsonb_build_object('class', v_class.name, 'points', p_points, 'reason', v_reason));
  return v_id;
end $$;

create function public.void_entry(p_entry_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_entry public.daily_entries; v_reason text;
begin
  me := app.require_teacher();
  select * into v_entry from public.daily_entries where id = p_entry_id and school_id = me.school_id for update;
  if v_entry.id is null then raise exception 'Entry not found'; end if;
  if v_entry.voided_at is not null then raise exception 'This entry is already voided'; end if;
  v_reason := app.require_reason(p_reason);
  update public.daily_entries set voided_at = now(), voided_by = me.id, void_reason = v_reason where id = v_entry.id;
  insert into public.points_ledger (school_id, class_id, points_date, source, action_id, entry_id, reverses_id, points, reason, created_by)
  select l.school_id, l.class_id, l.points_date, 'reversal', l.action_id, l.entry_id, l.id, -l.points, v_reason, me.id
    from public.points_ledger l where l.entry_id = v_entry.id and l.source = 'daily';
  perform app.log(me.school_id, me.id, 'entry.void', 'daily_entry', v_entry.id::text,
    jsonb_build_object('date', v_entry.entry_date, 'reason', v_reason));
end $$;

create function public.void_peer_audit(p_audit_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_audit public.peer_audits; v_reason text;
begin
  me := app.require_teacher();
  select * into v_audit from public.peer_audits where id = p_audit_id and school_id = me.school_id for update;
  if v_audit.id is null then raise exception 'Peer check not found'; end if;
  if v_audit.voided_at is not null then raise exception 'This peer check is already voided'; end if;
  v_reason := app.require_reason(p_reason);
  update public.peer_audits set voided_at = now(), voided_by = me.id, void_reason = v_reason where id = v_audit.id;
  insert into public.points_ledger (school_id, class_id, points_date, source, action_id, audit_id, reverses_id, points, reason, created_by)
  select l.school_id, l.class_id, l.points_date, 'reversal', l.action_id, l.audit_id, l.id, -l.points, v_reason, me.id
    from public.points_ledger l where l.audit_id = v_audit.id and l.source = 'audit';
  perform app.log(me.school_id, me.id, 'audit.void', 'peer_audit', v_audit.id::text,
    jsonb_build_object('date', v_audit.audit_date, 'reason', v_reason));
end $$;

create function public.close_month(p_month date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles; v_month date; v_end date; v_today date;
  v_top record; v_second numeric; v_tie boolean;
begin
  me := app.require_teacher();
  if p_month is null then raise exception 'Pick a month'; end if;
  v_month := date_trunc('month', p_month)::date;
  v_end := (v_month + interval '1 month' - interval '1 day')::date;
  v_today := app.school_today(me.school_id);
  if v_month >= date_trunc('month', v_today)::date then
    raise exception 'A month can only be closed after it has ended';
  end if;
  if exists (select 1 from public.month_closures where school_id = me.school_id and month = v_month) then
    raise exception 'That month is already closed';
  end if;

  with pts as (
    select l.class_id, sum(l.points) as p from public.points_ledger l
     where l.school_id = me.school_id and l.points_date between v_month and v_end group by l.class_id
  ), ranked as (
    select pts.class_id, pts.p, c.name,
           (select count(*) from public.daily_entries e where e.class_id = pts.class_id
             and e.voided_at is null and e.entry_date between v_month and v_end) as days,
           row_number() over (order by pts.p desc,
             (select count(*) from public.daily_entries e where e.class_id = pts.class_id
               and e.voided_at is null and e.entry_date between v_month and v_end) desc,
             c.grade, c.section) as rn
      from pts join public.classes c on c.id = pts.class_id
  )
  select class_id, p, name, days into v_top from ranked where rn = 1;
  if v_top.class_id is null then raise exception 'No points were recorded in that month'; end if;

  select sum(l.points) into v_second from public.points_ledger l
   where l.school_id = me.school_id and l.points_date between v_month and v_end and l.class_id <> v_top.class_id
   group by l.class_id order by sum(l.points) desc limit 1;
  v_tie := v_second is not null and v_second = v_top.p;

  insert into public.month_closures (school_id, month, champion_class_id, champion_points, was_tie, closed_by)
  values (me.school_id, v_month, v_top.class_id, v_top.p, v_tie, me.id);
  perform app.log(me.school_id, me.id, 'month.close', 'month_closure', v_month::text,
    jsonb_build_object('champion', v_top.name, 'points', v_top.p, 'tie', v_tie));
  return jsonb_build_object('month', v_month, 'champion', v_top.name, 'points', v_top.p, 'tie', v_tie, 'days', v_top.days);
end $$;

create function public.update_school_settings(p_name text, p_points_start_date date) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  if p_name is null or length(trim(p_name)) < 2 then raise exception 'School name is too short'; end if;
  update public.schools set name = trim(p_name), points_start_date = p_points_start_date where id = me.school_id;
  perform app.log(me.school_id, me.id, 'school.update', 'school', me.school_id::text,
    jsonb_build_object('name', trim(p_name), 'points_start_date', p_points_start_date));
end $$;

create function public.upsert_class(p_id uuid, p_grade int, p_section text, p_strength int, p_active boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_id uuid; v_section text := upper(trim(coalesce(p_section, '')));
begin
  me := app.require_teacher();
  if p_grade is null or p_grade not between 1 and 12 then raise exception 'Grade must be 1 to 12'; end if;
  if v_section !~ '^[A-Z]{1,2}$' then raise exception 'Section must be 1-2 letters, e.g. A'; end if;
  if p_strength is null or p_strength not between 1 and 80 then raise exception 'Class size must be 1 to 80'; end if;
  begin
    if p_id is null then
      insert into public.classes (school_id, grade, section, strength, active)
      values (me.school_id, p_grade, v_section, p_strength, coalesce(p_active, true)) returning id into v_id;
    else
      update public.classes set grade = p_grade, section = v_section, strength = p_strength, active = coalesce(p_active, active)
       where id = p_id and school_id = me.school_id returning id into v_id;
      if v_id is null then raise exception 'Class not found'; end if;
    end if;
  exception when unique_violation then
    raise exception 'Class % already exists', p_grade || v_section;
  end;
  perform app.log(me.school_id, me.id, case when p_id is null then 'class.create' else 'class.update' end, 'class', v_id::text,
    jsonb_build_object('grade', p_grade, 'section', v_section, 'strength', p_strength, 'active', p_active));
  return v_id;
end $$;

-- code / input type / who-enters are fixed once created (past answers depend on them).
create function public.upsert_action(
  p_id uuid, p_code text, p_label text, p_help text, p_input_type text, p_entered_by text,
  p_max_points numeric, p_sdgs smallint[], p_sort_order int, p_active boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_id uuid;
begin
  me := app.require_teacher();
  if p_sdgs is not null and exists (select 1 from unnest(p_sdgs) g where g not between 1 and 17) then
    raise exception 'SDG numbers must be between 1 and 17';
  end if;
  if p_max_points is null or p_max_points <= 0 or p_max_points > 100 then
    raise exception 'Points must be more than 0 and at most 100';
  end if;
  if p_label is null or length(trim(p_label)) < 2 then raise exception 'Label is too short'; end if;
  if p_id is null then
    begin
      insert into public.actions (school_id, code, label, help, input_type, entered_by, max_points, sdgs, sort_order, active)
      values (me.school_id, lower(trim(p_code)), trim(p_label), nullif(trim(coalesce(p_help, '')), ''), p_input_type, p_entered_by,
              p_max_points, coalesce(p_sdgs, '{}'), coalesce(p_sort_order, 0), coalesce(p_active, true))
      returning id into v_id;
    exception
      when unique_violation then raise exception 'An item with code "%" already exists', p_code;
      when check_violation then raise exception 'Check the code (a-z, 0-9, _), type and who enters it. Counts must be entered by the class itself.';
    end;
  else
    update public.actions
       set label = trim(p_label), help = nullif(trim(coalesce(p_help, '')), ''), max_points = p_max_points,
           sdgs = coalesce(p_sdgs, '{}'), sort_order = coalesce(p_sort_order, sort_order), active = coalesce(p_active, active)
     where id = p_id and school_id = me.school_id returning id into v_id;
    if v_id is null then raise exception 'Item not found'; end if;
  end if;
  perform app.log(me.school_id, me.id, case when p_id is null then 'criteria.create' else 'criteria.update' end, 'action', v_id::text,
    jsonb_build_object('code', p_code, 'label', p_label, 'max_points', p_max_points, 'active', p_active));
  return v_id;
end $$;

-- --------------------------------------------------------- teacher reads ----

create function public.teacher_today()
returns table (class_id uuid, class_name text, grade smallint, strength smallint, has_monitor boolean,
               entry_submitted boolean, present smallint, entry_points numeric,
               checked boolean, checked_by text, checks_class text)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles; v_today date;
begin
  me := app.require_teacher();
  v_today := app.school_today(me.school_id);
  return query
    select c.id, c.name, c.grade, c.strength,
           exists (select 1 from public.profiles p where p.class_id = c.id and p.role = 'monitor'),
           e.id is not null, e.present,
           (select coalesce(sum(l.points), 0) from public.points_ledger l where l.entry_id = e.id)::numeric,
           exists (select 1 from public.peer_audits pa where pa.target_class_id = c.id and pa.audit_date = v_today and pa.voided_at is null),
           (select x.name from public.classes x where x.id = app.audited_by(c.id, v_today)),
           (select x.name from public.classes x where x.id = app.audit_target(c.id, v_today))
      from public.classes c
      left join public.daily_entries e on e.class_id = c.id and e.entry_date = v_today and e.voided_at is null
     where c.school_id = me.school_id and c.active
     order by c.grade, c.section;
end $$;

create function public.teacher_classes()
returns table (id uuid, name text, grade smallint, section text, strength smallint, active boolean, monitor_user_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  return query
    select c.id, c.name, c.grade, c.section, c.strength, c.active,
           (select p.id from public.profiles p where p.class_id = c.id and p.role = 'monitor')
      from public.classes c where c.school_id = me.school_id
     order by c.active desc, c.grade, c.section;
end $$;

create function public.teacher_actions()
returns table (id uuid, code text, label text, help text, input_type text, entered_by text,
               max_points numeric, sdgs smallint[], sort_order smallint, active boolean)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  return query
    select a.id, a.code, a.label, a.help, a.input_type, a.entered_by, a.max_points, a.sdgs, a.sort_order, a.active
      from public.actions a where a.school_id = me.school_id
     order by a.active desc, a.sort_order, a.code;
end $$;

create function public.teacher_entries(p_from date, p_to date)
returns table (id uuid, entry_date date, class_name text, present smallint, vals jsonb, points numeric,
               baseline boolean, voided boolean, void_reason text, submitted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Invalid date range'; end if;
  return query
    select e.id, e.entry_date, c.name, e.present,
           coalesce((select jsonb_object_agg(a.code, ev.value) from public.entry_values ev
                      join public.actions a on a.id = ev.action_id where ev.entry_id = e.id), '{}'::jsonb),
           (select coalesce(sum(l.points), 0) from public.points_ledger l where l.entry_id = e.id and l.source = 'daily')::numeric,
           e.is_baseline, e.voided_at is not null, e.void_reason, e.submitted_at
      from public.daily_entries e join public.classes c on c.id = e.class_id
     where e.school_id = me.school_id and e.entry_date between p_from and p_to
     order by e.entry_date desc, c.grade, c.section, e.submitted_at desc;
end $$;

create function public.teacher_peer_audits(p_from date, p_to date)
returns table (id uuid, audit_date date, target_name text, auditor_name text, vals jsonb, points numeric,
               baseline boolean, voided boolean, void_reason text, submitted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Invalid date range'; end if;
  return query
    select pa.id, pa.audit_date, t.name, au.name,
           coalesce((select jsonb_object_agg(a.code, av.value) from public.audit_values av
                      join public.actions a on a.id = av.action_id where av.audit_id = pa.id), '{}'::jsonb),
           (select coalesce(sum(l.points), 0) from public.points_ledger l where l.audit_id = pa.id and l.source = 'audit')::numeric,
           pa.is_baseline, pa.voided_at is not null, pa.void_reason, pa.submitted_at
      from public.peer_audits pa
      join public.classes t on t.id = pa.target_class_id
      join public.classes au on au.id = pa.auditor_class_id
     where pa.school_id = me.school_id and pa.audit_date between p_from and p_to
     order by pa.audit_date desc, t.grade, t.section, pa.submitted_at desc;
end $$;

create function public.teacher_ledger(p_from date, p_to date, p_sources text[] default null)
returns table (id bigint, points_date date, class_name text, source text, points numeric, reason text,
               created_by_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Invalid date range'; end if;
  return query
    select l.id, l.points_date, c.name, l.source, l.points, l.reason, p.display_name, l.created_at
      from public.points_ledger l
      join public.classes c on c.id = l.class_id
      left join public.profiles p on p.id = l.created_by
     where l.school_id = me.school_id and l.points_date between p_from and p_to
       and (p_sources is null or l.source = any (p_sources))
     order by l.created_at desc
     limit 500;
end $$;

-- Daily % per item, school-wide or for one class.
create function public.get_series(p_from date, p_to date, p_class_id uuid default null)
returns table (day date, code text, label text, pct numeric)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Invalid date range'; end if;
  return query
    with e as (
      select * from public.daily_entries
       where school_id = me.school_id and voided_at is null and entry_date between p_from and p_to
         and (p_class_id is null or class_id = p_class_id)
    ), pa as (
      select * from public.peer_audits
       where school_id = me.school_id and voided_at is null and audit_date between p_from and p_to
         and (p_class_id is null or target_class_id = p_class_id)
    )
    select e.entry_date, a.code, a.label, round(100.0 * sum(ev.value) / nullif(sum(e.present), 0), 1)
      from e join public.entry_values ev on ev.entry_id = e.id join public.actions a on a.id = ev.action_id
     where a.input_type = 'count'
     group by e.entry_date, a.code, a.label
    union all
    select e.entry_date, a.code, a.label, round(100.0 * avg(ev.value), 1)
      from e join public.entry_values ev on ev.entry_id = e.id join public.actions a on a.id = ev.action_id
     where a.input_type = 'check'
     group by e.entry_date, a.code, a.label
    union all
    select pa.audit_date, a.code, a.label, round(100.0 * avg(av.value), 1)
      from pa join public.audit_values av on av.audit_id = pa.id join public.actions a on a.id = av.action_id
     group by pa.audit_date, a.code, a.label
    order by 1, 2;
end $$;

create function public.teacher_staff()
returns table (id uuid, display_name text, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  return query
    select p.id, p.display_name, u.email::text, p.created_at
      from public.profiles p join auth.users u on u.id = p.id
     where p.school_id = me.school_id and p.role = 'teacher'
     order by p.created_at;
end $$;

create function public.teacher_activity_log(p_limit int default 50)
returns table (at timestamptz, actor_name text, action text, entity text, details jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  return query
    select l.at, p.display_name, l.action, l.entity, l.details
      from public.activity_log l left join public.profiles p on p.id = l.actor_id
     where l.school_id = me.school_id
     order by l.at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 500);
end $$;

-- ------------------------------------------------ service-role-only RPCs ----
-- Called by the server after it has verified the caller is a teacher.

create function public.svc_link_profile(p_user_id uuid, p_school_id uuid, p_role text, p_class_id uuid,
                                        p_display_name text, p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_class_id is not null and not exists (select 1 from public.classes where id = p_class_id and school_id = p_school_id) then
    raise exception 'Class does not belong to this school';
  end if;
  insert into public.profiles (id, school_id, role, class_id, display_name)
  values (p_user_id, p_school_id, p_role, p_class_id, p_display_name)
  on conflict (id) do update set display_name = excluded.display_name
    where public.profiles.school_id = excluded.school_id and public.profiles.role = excluded.role;
  perform app.log(p_school_id, p_actor, 'account.link', 'profile', p_user_id::text,
    jsonb_build_object('role', p_role, 'class_id', p_class_id, 'display_name', p_display_name));
end $$;

create function public.svc_log(p_school_id uuid, p_actor uuid, p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  select app.log(p_school_id, p_actor, p_action, p_entity, p_entity_id, p_details)
$$;

-- ---------------------------------------------------------------- grants ----
-- Supabase's default privileges grant everything in `public` to anon/authenticated.
-- Take it all back, then grant exactly what's needed.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;  -- filtered by RLS above

revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema app from public, anon, authenticated;

grant execute on function app.my_school_id(), app.my_class_id(), app.is_teacher() to authenticated;

grant execute on function
  public.public_school(text), public.public_classes(text),
  public.get_leaderboard(text, date, date), public.get_impact(text, date, date), public.get_champions(text)
to anon, authenticated;

grant execute on function
  public.whoami(), public.my_today(),
  public.submit_daily_entry(int, jsonb), public.submit_peer_audit(jsonb),
  public.award_points(uuid, text, numeric, text),
  public.void_entry(uuid, text), public.void_peer_audit(uuid, text),
  public.close_month(date), public.update_school_settings(text, date),
  public.upsert_class(uuid, int, text, int, boolean),
  public.upsert_action(uuid, text, text, text, text, text, numeric, smallint[], int, boolean),
  public.teacher_today(), public.teacher_classes(), public.teacher_actions(),
  public.teacher_entries(date, date), public.teacher_peer_audits(date, date),
  public.teacher_ledger(date, date, text[]), public.get_series(date, date, uuid),
  public.teacher_staff(), public.teacher_activity_log(int)
to authenticated;

grant execute on function
  public.svc_link_profile(uuid, uuid, text, uuid, text, uuid),
  public.svc_log(uuid, uuid, text, text, text, jsonb)
to service_role;
