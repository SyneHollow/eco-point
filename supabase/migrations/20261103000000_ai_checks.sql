-- =============================================================================
-- EcoPoints v2 — AI photo checks ("AI referee"), pattern flags, weekly challenges
--
-- * The AI result is written ONLY by the server (service_role) via
--   svc_record_ai_check, after the server has verified the monitor's session and
--   called the AI provider itself. Browsers can't submit AI results.
-- * Photos are never stored. Only counts, labels and the AI's summary are kept.
-- * Bin check  → scores "low plastic waste" for the monitor's own class and
--                 cross-checks the class's own plastic-free count.
-- * Room check → evidence for that day's peer check; flags disagreements.
--                 It never changes points by itself: a teacher decides.
-- =============================================================================

-- ------------------------------------------------------------- settings ----
alter table public.schools
  add column ai_enabled boolean not null default true,
  add column ai_bin_max_points numeric(5,2) not null default 10 check (ai_bin_max_points > 0 and ai_bin_max_points <= 100),
  add column ai_bin_zero_at numeric(4,2) not null default 0.5 check (ai_bin_zero_at > 0 and ai_bin_zero_at <= 5);
comment on column public.schools.ai_bin_zero_at is
  'Plastic items per student present at which the bin check scores zero. 0.5 = one item for every two students.';

-- ------------------------------------------------------------ ai_checks ----
create table public.ai_checks (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id),
  class_id            uuid not null references public.classes(id),   -- class whose bin / room was photographed
  check_type          text not null check (check_type in ('bin', 'room')),
  check_date          date not null,
  checked_by_class_id uuid not null references public.classes(id),   -- own class (bin) or visiting class (room)
  submitted_by        uuid not null references public.profiles(id),
  audit_id            uuid references public.peer_audits(id),         -- room checks: the peer check it backs up
  provider            text not null,
  model               text not null,
  plastic_items       smallint check (plastic_items between 0 and 500),
  wrong_bin_items     smallint check (wrong_bin_items between 0 and 500),
  lights_on           boolean,
  litter_level        smallint check (litter_level between 0 and 3),
  bin_overflowing     boolean,
  confidence          numeric(3,2) not null check (confidence between 0 and 1),
  items               jsonb not null default '[]'::jsonb,              -- [{label, kind}] — no image, no boxes
  summary             text check (length(summary) <= 500),
  present_used        smallint,
  points              numeric(6,2) not null default 0,
  is_baseline         boolean not null,
  flagged             boolean not null default false,
  flag_reason         text,
  reviewed_at         timestamptz,
  reviewed_by         uuid references public.profiles(id),
  review_note         text,
  voided_at           timestamptz,
  voided_by           uuid references public.profiles(id),
  void_reason         text,
  created_at          timestamptz not null default now(),
  check ((check_type = 'bin') = (plastic_items is not null and wrong_bin_items is not null)),
  check ((check_type = 'room') = (lights_on is not null and litter_level is not null)),
  check ((check_type = 'room') = (audit_id is not null)),
  check ((voided_at is null) = (voided_by is null)),
  check ((reviewed_at is null) = (reviewed_by is null))
);
create unique index ai_checks_one_live_per_day on public.ai_checks(class_id, check_type, check_date) where voided_at is null;
create index ai_checks_school_date_idx on public.ai_checks(school_id, check_date);

-- Only reviewing (once) and voiding (once) may change a stored check.
create function app.ai_check_update_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'AI checks can''t be deleted: void them instead' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['reviewed_at','reviewed_by','review_note','voided_at','voided_by','void_reason'])
       is distinct from (to_jsonb(old) - array['reviewed_at','reviewed_by','review_note','voided_at','voided_by','void_reason'])
     or (old.reviewed_at is not null and (new.reviewed_at, new.reviewed_by, new.review_note) is distinct from (old.reviewed_at, old.reviewed_by, old.review_note))
     or old.voided_at is not null then
    raise exception 'AI check results can''t be edited' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger ai_checks_guard before update or delete on public.ai_checks
  for each row execute function app.ai_check_update_guard();

-- ------------------------------------------------- ledger: new 'ai' source ----
alter table public.points_ledger add column ai_check_id uuid references public.ai_checks(id);
alter table public.points_ledger drop constraint points_ledger_source_check;
alter table public.points_ledger add constraint points_ledger_source_check
  check (source in ('daily', 'audit', 'ai', 'bonus', 'adjustment', 'reversal'));
alter table public.points_ledger drop constraint points_ledger_check;
alter table public.points_ledger add constraint points_ledger_check
  check (source in ('daily', 'audit', 'ai') or length(trim(coalesce(reason, ''))) >= 3);
create index points_ledger_ai_idx on public.points_ledger(ai_check_id) where ai_check_id is not null;

-- --------------------------------------------------------- challenges ----
create table public.class_challenges (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id),
  class_id   uuid not null references public.classes(id),
  week_start date not null check (extract(isodow from week_start) = 1),
  text       text not null check (length(trim(text)) between 3 and 200),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (class_id, week_start)
);

-- -------------------------------------------------------------------- RLS ----
alter table public.ai_checks enable row level security;
alter table public.class_challenges enable row level security;
create policy ai_checks_read on public.ai_checks for select to authenticated
  using (school_id = (select app.my_school_id())
         and ((select app.is_teacher())
              or class_id = (select app.my_class_id())
              or checked_by_class_id = (select app.my_class_id())));
create policy class_challenges_read on public.class_challenges for select to authenticated
  using (school_id = (select app.my_school_id()));

-- ------------------------------------------------- server-only: record ----
-- p_result (already validated by the server, re-validated here):
--   bin:  {plastic_items, wrong_bin_items, confidence, items:[{label,kind}], summary}
--   room: {lights_on, litter_level, bin_overflowing, confidence, items, summary}
create function public.svc_record_ai_check(p_actor uuid, p_check_type text, p_result jsonb, p_provider text, p_model text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles; v_school public.schools; v_today date; v_class uuid; v_baseline boolean;
  v_entry public.daily_entries; v_audit public.peer_audits; v_id uuid;
  v_items int; v_wrong int; v_conf numeric; v_present int; v_pf int; v_pts numeric := 0;
  v_flag boolean := false; v_reason text; v_lights boolean; v_litter int; v_overflow boolean;
  v_lights_off_said int; v_clean_said int; v_items_json jsonb; v_summary text;
begin
  select * into me from public.profiles where id = p_actor;
  if me.id is null or me.role <> 'monitor' then raise exception 'Only Eco Monitors can run photo checks'; end if;
  select * into v_school from public.schools where id = me.school_id;
  if not v_school.ai_enabled then raise exception 'AI photo checks are switched off for this school'; end if;
  if p_check_type not in ('bin', 'room') then raise exception 'Unknown check type'; end if;
  if p_result is null or jsonb_typeof(p_result) <> 'object' then raise exception 'Invalid AI result'; end if;
  if coalesce(length(p_provider), 0) = 0 or coalesce(length(p_model), 0) = 0 then raise exception 'Missing provider/model'; end if;

  v_today := (now() at time zone v_school.timezone)::date;
  v_baseline := v_school.points_start_date is not null and v_today < v_school.points_start_date;
  v_conf := least(1, greatest(0, coalesce((p_result ->> 'confidence')::numeric, 0)));
  v_items_json := coalesce(p_result -> 'items', '[]'::jsonb);
  if jsonb_typeof(v_items_json) <> 'array' or jsonb_array_length(v_items_json) > 200 then raise exception 'Invalid AI items'; end if;
  v_summary := left(coalesce(p_result ->> 'summary', ''), 500);

  if p_check_type = 'bin' then
    v_class := me.class_id;
    select * into v_entry from public.daily_entries
     where class_id = v_class and entry_date = v_today and voided_at is null;
    if v_entry.id is null then raise exception 'Submit today''s class check first, then do the bin check'; end if;
    v_items := (p_result ->> 'plastic_items')::int;
    v_wrong := coalesce((p_result ->> 'wrong_bin_items')::int, 0);
    if v_items is null or v_items < 0 or v_items > 500 or v_wrong < 0 or v_wrong > 500 then raise exception 'Invalid AI counts'; end if;
    v_present := v_entry.present;
    if not v_baseline then
      v_pts := round(v_school.ai_bin_max_points * greatest(0, 1 - v_items::numeric / (v_present * v_school.ai_bin_zero_at)), 2);
    end if;
    -- AI referee: more plastic in the bin than the class's own count could explain
    select ev.value into v_pf from public.entry_values ev join public.actions a on a.id = ev.action_id
     where ev.entry_id = v_entry.id and a.code = 'plastic_free_lunch';
    if v_pf is not null and v_items > 3 * (v_present - v_pf) + 3 then
      v_flag := true;
      v_reason := format('Class said %s of %s lunches were plastic-free, but the AI counted %s plastic items in the bin.', v_pf, v_present, v_items);
    end if;
    begin
      insert into public.ai_checks (school_id, class_id, check_type, check_date, checked_by_class_id, submitted_by, provider, model,
                                    plastic_items, wrong_bin_items, confidence, items, summary, present_used, points, is_baseline, flagged, flag_reason)
      values (me.school_id, v_class, 'bin', v_today, me.class_id, me.id, p_provider, p_model,
              v_items, v_wrong, v_conf, v_items_json, v_summary, v_present, v_pts, v_baseline, v_flag, v_reason)
      returning id into v_id;
    exception when unique_violation then
      raise exception 'Today''s bin check is already done';
    end;
    if v_pts > 0 then
      insert into public.points_ledger (school_id, class_id, points_date, source, ai_check_id, points, created_by)
      values (me.school_id, v_class, v_today, 'ai', v_id, v_pts, me.id);
    end if;
  else
    v_class := app.audit_target(me.class_id, v_today);
    if v_class is null then raise exception 'No peer check today'; end if;
    select * into v_audit from public.peer_audits
     where target_class_id = v_class and audit_date = v_today and voided_at is null and auditor_class_id = me.class_id;
    if v_audit.id is null then raise exception 'Submit the peer check first, then add the room photo'; end if;
    v_lights := (p_result ->> 'lights_on')::boolean;
    v_litter := (p_result ->> 'litter_level')::int;
    v_overflow := coalesce((p_result ->> 'bin_overflowing')::boolean, false);
    if v_lights is null or v_litter is null or v_litter not between 0 and 3 then raise exception 'Invalid AI room result'; end if;
    select av.value into v_lights_off_said from public.audit_values av join public.actions a on a.id = av.action_id
     where av.audit_id = v_audit.id and a.code = 'lights_off';
    select av.value into v_clean_said from public.audit_values av join public.actions a on a.id = av.action_id
     where av.audit_id = v_audit.id and a.code = 'clean_classroom';
    if v_lights and v_lights_off_said = 1 then
      v_flag := true; v_reason := 'The peer check said the lights were off, but the photo shows them on.';
    end if;
    if v_litter >= 2 and v_clean_said = 1 then
      v_flag := true;
      v_reason := concat_ws(' ', v_reason, 'The peer check said the room was clean, but the photo shows litter.');
    end if;
    begin
      insert into public.ai_checks (school_id, class_id, check_type, check_date, checked_by_class_id, submitted_by, audit_id, provider, model,
                                    lights_on, litter_level, bin_overflowing, confidence, items, summary, points, is_baseline, flagged, flag_reason)
      values (me.school_id, v_class, 'room', v_today, me.class_id, me.id, v_audit.id, p_provider, p_model,
              v_lights, v_litter, v_overflow, v_conf, v_items_json, v_summary, 0, v_baseline, v_flag, v_reason)
      returning id into v_id;
    exception when unique_violation then
      raise exception 'Today''s room photo for this class is already done';
    end;
  end if;

  perform app.log(me.school_id, me.id, 'ai.' || p_check_type, 'ai_check', v_id::text,
    jsonb_build_object('class', (select name from public.classes where id = v_class), 'points', v_pts,
                       'flagged', v_flag, 'plastic_items', v_items, 'lights_on', v_lights, 'litter_level', v_litter));
  return jsonb_build_object('id', v_id, 'points', v_pts, 'flagged', v_flag, 'flag_reason', v_reason,
                            'baseline', v_baseline, 'present', v_present,
                            'class', (select name from public.classes where id = v_class));
end $$;

-- How many AI attempts this monitor's class made today (cost guard; attempts are logged by the server).
create function public.svc_ai_attempts_today(p_actor uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.activity_log l
    join public.profiles p on p.id = p_actor
    join public.schools s on s.id = p.school_id
   where l.actor_id = p_actor and l.action = 'ai.attempt'
     and (l.at at time zone s.timezone)::date = (now() at time zone s.timezone)::date
$$;

-- ------------------------------------------------------ monitor read ----
create function public.my_ai_today() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles; v_school public.schools; v_today date; v_target uuid; v jsonb;
begin
  me := app.require_monitor();
  select * into v_school from public.schools where id = me.school_id;
  v_today := (now() at time zone v_school.timezone)::date;
  v_target := app.audit_target(me.class_id, v_today);
  select jsonb_build_object(
    'enabled', v_school.ai_enabled,
    'zero_at', v_school.ai_bin_zero_at,
    'max_points', v_school.ai_bin_max_points,
    'entry_submitted', exists (select 1 from public.daily_entries where class_id = me.class_id and entry_date = v_today and voided_at is null),
    'audit_submitted', exists (select 1 from public.peer_audits where auditor_class_id = me.class_id and audit_date = v_today and voided_at is null),
    'audit_target', (select jsonb_build_object('id', c.id, 'name', c.name) from public.classes c where c.id = v_target),
    'bin', (select jsonb_build_object('plastic_items', a.plastic_items, 'wrong_bin_items', a.wrong_bin_items, 'points', a.points,
                                      'flagged', a.flagged, 'flag_reason', a.flag_reason, 'summary', a.summary, 'baseline', a.is_baseline,
                                      'created_at', a.created_at)
              from public.ai_checks a where a.class_id = me.class_id and a.check_type = 'bin' and a.check_date = v_today and a.voided_at is null),
    'room', (select jsonb_build_object('class', c.name, 'lights_on', a.lights_on, 'litter_level', a.litter_level, 'bin_overflowing', a.bin_overflowing,
                                       'flagged', a.flagged, 'flag_reason', a.flag_reason, 'summary', a.summary, 'created_at', a.created_at)
               from public.ai_checks a join public.classes c on c.id = a.class_id
              where a.checked_by_class_id = me.class_id and a.check_type = 'room' and a.check_date = v_today and a.voided_at is null),
    'challenge', (select ch.text from public.class_challenges ch
                   where ch.class_id = me.class_id
                     and ch.week_start = (v_today - (extract(isodow from v_today)::int - 1))))
  into v;
  return v;
end $$;

-- ----------------------------------------------------- teacher actions ----
create function public.review_ai_check(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v public.ai_checks;
begin
  me := app.require_teacher();
  select * into v from public.ai_checks where id = p_id and school_id = me.school_id for update;
  if v.id is null then raise exception 'AI check not found'; end if;
  if v.reviewed_at is not null then raise exception 'Already reviewed'; end if;
  update public.ai_checks set reviewed_at = now(), reviewed_by = me.id, review_note = nullif(trim(coalesce(p_note, '')), '') where id = v.id;
  perform app.log(me.school_id, me.id, 'ai.review', 'ai_check', v.id::text, jsonb_build_object('note', p_note));
end $$;

create function public.void_ai_check(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v public.ai_checks; v_reason text;
begin
  me := app.require_teacher();
  select * into v from public.ai_checks where id = p_id and school_id = me.school_id for update;
  if v.id is null then raise exception 'AI check not found'; end if;
  if v.voided_at is not null then raise exception 'Already voided'; end if;
  v_reason := app.require_reason(p_reason);
  update public.ai_checks set voided_at = now(), voided_by = me.id, void_reason = v_reason where id = v.id;
  insert into public.points_ledger (school_id, class_id, points_date, source, ai_check_id, reverses_id, points, reason, created_by)
  select l.school_id, l.class_id, l.points_date, 'reversal', l.ai_check_id, l.id, -l.points, v_reason, me.id
    from public.points_ledger l where l.ai_check_id = v.id and l.source = 'ai';
  perform app.log(me.school_id, me.id, 'ai.void', 'ai_check', v.id::text, jsonb_build_object('reason', v_reason));
end $$;

create function public.update_ai_settings(p_enabled boolean, p_bin_max_points numeric, p_bin_zero_at numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  update public.schools
     set ai_enabled = coalesce(p_enabled, ai_enabled),
         ai_bin_max_points = coalesce(p_bin_max_points, ai_bin_max_points),
         ai_bin_zero_at = coalesce(p_bin_zero_at, ai_bin_zero_at)
   where id = me.school_id;
  perform app.log(me.school_id, me.id, 'ai.settings', 'school', me.school_id::text,
    jsonb_build_object('enabled', p_enabled, 'bin_max_points', p_bin_max_points, 'bin_zero_at', p_bin_zero_at));
end $$;

create function public.publish_challenges(p_week_start date, p_items jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; r jsonb; n int := 0; v_text text; v_class uuid;
begin
  me := app.require_teacher();
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then raise exception 'Week must start on a Monday'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid challenges'; end if;
  for r in select * from jsonb_array_elements(p_items) loop
    v_class := (r ->> 'class_id')::uuid;
    v_text := trim(coalesce(r ->> 'text', ''));
    if not exists (select 1 from public.classes where id = v_class and school_id = me.school_id) then raise exception 'Class not found'; end if;
    if v_text = '' then
      delete from public.class_challenges where class_id = v_class and week_start = p_week_start;
      continue;
    end if;
    if length(v_text) > 200 then raise exception 'Challenge too long (200 characters max)'; end if;
    insert into public.class_challenges (school_id, class_id, week_start, text, created_by)
    values (me.school_id, v_class, p_week_start, v_text, me.id)
    on conflict (class_id, week_start) do update set text = excluded.text, created_by = excluded.created_by, created_at = now();
    n := n + 1;
  end loop;
  perform app.log(me.school_id, me.id, 'challenges.publish', 'class_challenges', p_week_start::text, jsonb_build_object('count', n));
  return n;
end $$;

-- ------------------------------------------------------ teacher reads ----
create function public.teacher_ai_checks(p_from date, p_to date)
returns table (id uuid, check_type text, check_date date, class_name text, checked_by text, plastic_items smallint, wrong_bin_items smallint,
               present_used smallint, lights_on boolean, litter_level smallint, bin_overflowing boolean, confidence numeric,
               items jsonb, summary text, points numeric, baseline boolean, flagged boolean, flag_reason text,
               reviewed boolean, review_note text, voided boolean, void_reason text, provider text, model text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Invalid date range'; end if;
  return query
    select a.id, a.check_type, a.check_date, c.name, cb.name, a.plastic_items, a.wrong_bin_items, a.present_used,
           a.lights_on, a.litter_level, a.bin_overflowing, a.confidence, a.items, a.summary, a.points, a.is_baseline,
           a.flagged, a.flag_reason, a.reviewed_at is not null, a.review_note, a.voided_at is not null, a.void_reason,
           a.provider, a.model, a.created_at
      from public.ai_checks a
      join public.classes c on c.id = a.class_id
      join public.classes cb on cb.id = a.checked_by_class_id
     where a.school_id = me.school_id and a.check_date between p_from and p_to
     order by (a.flagged and a.reviewed_at is null and a.voided_at is null) desc, a.check_date desc, a.created_at desc;
end $$;

-- Pattern flags: plain statistics, explained in words.
create function public.teacher_flags(p_from date, p_to date)
returns table (kind text, class_name text, detail text, ref_id uuid, flag_date date)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Invalid date range'; end if;
  return query
    -- 1. AI photo disagrees with what the class or the checking class entered
    select 'ai_mismatch'::text, c.name, a.flag_reason, a.id, a.check_date
      from public.ai_checks a join public.classes c on c.id = a.class_id
     where a.school_id = me.school_id and a.check_date between p_from and p_to
       and a.flagged and a.reviewed_at is null and a.voided_at is null
    union all
    -- 2. Every single day reported 100% plastic-free (5+ days)
    select 'perfect_streak'::text, c.name,
           format('%s reported every student plastic-free on all %s days in this period. Worth a spot check.', c.name, x.n),
           null::uuid, null::date
      from (select e.class_id, count(*) as n, bool_and(ev.value = e.present) as all_perfect
              from public.daily_entries e
              join public.entry_values ev on ev.entry_id = e.id
              join public.actions a on a.id = ev.action_id and a.code = 'plastic_free_lunch'
             where e.school_id = me.school_id and e.voided_at is null and not e.is_baseline
               and e.entry_date between p_from and p_to
             group by e.class_id) x
      join public.classes c on c.id = x.class_id
     where x.n >= 5 and x.all_perfect
    union all
    -- 3. A checking class that passes everyone, while the school overall doesn't
    select 'generous_checker'::text, c.name,
           format('%s gave full marks on all %s of its peer checks, while checks across the school pass %s%% of the time.',
                  c.name, g.n, round(s.rate)),
           null::uuid, null::date
      from (select pa.auditor_class_id, count(distinct pa.id) as n, bool_and(av.value = 1) as all_yes
              from public.peer_audits pa join public.audit_values av on av.audit_id = pa.id
             where pa.school_id = me.school_id and pa.voided_at is null and pa.audit_date between p_from and p_to
             group by pa.auditor_class_id) g
      cross join (select 100.0 * avg(av.value) as rate
                    from public.peer_audits pa join public.audit_values av on av.audit_id = pa.id
                   where pa.school_id = me.school_id and pa.voided_at is null and pa.audit_date between p_from and p_to) s
      join public.classes c on c.id = g.auditor_class_id
     where g.n >= 5 and g.all_yes and s.rate < 90;
end $$;

-- ------------------------------------------------------- public reads ----
create function public.get_ai_summary(p_slug text, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_school uuid; v jsonb;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'Invalid date range'; end if;
  select id into v_school from public.schools where slug = p_slug;
  if v_school is null then return null; end if;
  select jsonb_build_object(
    'bin_checks', count(*) filter (where check_type = 'bin'),
    'plastic_items', coalesce(sum(plastic_items) filter (where check_type = 'bin'), 0),
    'wrong_bin_items', coalesce(sum(wrong_bin_items) filter (where check_type = 'bin'), 0),
    'students_covered', coalesce(sum(present_used) filter (where check_type = 'bin'), 0),
    'per_10_students', case when coalesce(sum(present_used) filter (where check_type = 'bin'), 0) > 0
                            then round(10.0 * sum(plastic_items) filter (where check_type = 'bin') / sum(present_used) filter (where check_type = 'bin'), 1) end,
    'room_checks', count(*) filter (where check_type = 'room'),
    'rooms_lights_on', count(*) filter (where check_type = 'room' and lights_on),
    'rooms_littered', count(*) filter (where check_type = 'room' and litter_level >= 2),
    'flagged', count(*) filter (where flagged))
  into v
  from public.ai_checks
  where school_id = v_school and voided_at is null and check_date between p_from and p_to;
  return v;
end $$;

create function public.get_challenges(p_slug text, p_week_start date)
returns table (class_id uuid, class_name text, text text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, ch.text
    from public.class_challenges ch
    join public.classes c on c.id = ch.class_id
    join public.schools s on s.id = ch.school_id
   where s.slug = p_slug and ch.week_start = p_week_start and c.active
   order by c.grade, c.section
$$;

-- public_school now also returns the (non-sensitive) AI settings
create or replace function public.public_school(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name, 'slug', s.slug, 'timezone', s.timezone,
    'today', (now() at time zone s.timezone)::date,
    'points_start_date', s.points_start_date,
    'baseline', s.points_start_date is not null and (now() at time zone s.timezone)::date < s.points_start_date,
    'ai_enabled', s.ai_enabled, 'ai_bin_max_points', s.ai_bin_max_points, 'ai_bin_zero_at', s.ai_bin_zero_at)
  from public.schools s where s.slug = p_slug
$$;

-- ---------------------------------------------------------------- grants ----
revoke all on public.ai_checks, public.class_challenges from anon, authenticated;
grant select on public.ai_checks, public.class_challenges to authenticated;

revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema app from public, anon, authenticated;
grant execute on function app.my_school_id(), app.my_class_id(), app.is_teacher() to authenticated;

-- re-grant everything from v1 (the blanket revoke above covers all functions)
grant execute on function
  public.public_school(text), public.public_classes(text),
  public.get_leaderboard(text, date, date), public.get_impact(text, date, date), public.get_champions(text),
  public.get_ai_summary(text, date, date), public.get_challenges(text, date)
to anon, authenticated;

grant execute on function
  public.whoami(), public.my_today(), public.my_ai_today(),
  public.submit_daily_entry(int, jsonb), public.submit_peer_audit(jsonb),
  public.award_points(uuid, text, numeric, text),
  public.void_entry(uuid, text), public.void_peer_audit(uuid, text),
  public.close_month(date), public.update_school_settings(text, date),
  public.upsert_class(uuid, int, text, int, boolean),
  public.upsert_action(uuid, text, text, text, text, text, numeric, smallint[], int, boolean),
  public.teacher_today(), public.teacher_classes(), public.teacher_actions(),
  public.teacher_entries(date, date), public.teacher_peer_audits(date, date),
  public.teacher_ledger(date, date, text[]), public.get_series(date, date, uuid),
  public.teacher_staff(), public.teacher_activity_log(int),
  public.review_ai_check(uuid, text), public.void_ai_check(uuid, text),
  public.update_ai_settings(boolean, numeric, numeric), public.publish_challenges(date, jsonb),
  public.teacher_ai_checks(date, date), public.teacher_flags(date, date)
to authenticated;

grant execute on function
  public.svc_link_profile(uuid, uuid, text, uuid, text, uuid),
  public.svc_log(uuid, uuid, text, text, text, jsonb),
  public.svc_record_ai_check(uuid, text, jsonb, text, text),
  public.svc_ai_attempts_today(uuid)
to service_role;
