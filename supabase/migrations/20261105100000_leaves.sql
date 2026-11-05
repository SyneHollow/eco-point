-- =============================================================================
-- EcoPoints leaves (5 Nov 2026): a separate currency for the class garden.
--
--   Points  How WELL a class did. Leaderboard and badges only. Never spent.
--   Leaves  Taking PART. Earned for doing things, whatever the answers were.
--           The only thing the garden shop takes. Spending leaves never
--           touches points, the leaderboard or badges.
--
--   Leaves counted live from the records (so voiding a record takes its leaves away):
--     class check submitted       5   daily_entries, the measuring week too
--     peer check done             3   to the class that DID the check
--     AI bin photo                3
--     AI room photo               2   to the class that took it
--     eco challenge approved      the challenge's own leaves (quick QR 3, projects 10-15)
--   Leaves stored as grants (leaf_grants, append-only):
--     badge reached in a month    10 / 15 / 20 / 25 / 30 / 40, once per badge per month, kept for good
--     teacher                     -500..500 with a reason (minus = take back a mistake)
--
--   Rates per school live in leaf_rates. Changing a rate re-counts every past
--   record, so change them only before the pilot starts (there's no screen for it).
--
--   Shop prices move to leaves (seedling 15 ... ghaf 250). Plants already bought
--   are re-priced in leaves, so "spent" stays meaningful.
--
-- Run after 20261105000000_rewards.sql. Then run supabase/tests/rewards_checks.sql.
-- =============================================================================
begin;

-- ---------------------------------------------------------------- tables ----

create table public.leaf_rates (
  school_id   uuid primary key references public.schools(id),
  class_check smallint not null default 5 check (class_check between 0 and 100),
  peer_check  smallint not null default 3 check (peer_check between 0 and 100),
  bin_photo   smallint not null default 3 check (bin_photo between 0 and 100),
  room_photo  smallint not null default 2 check (room_photo between 0 and 100)
);

create table public.leaf_grants (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id),
  class_id   uuid not null references public.classes(id),
  kind       text not null check (kind in ('badge', 'teacher')),
  month      date check (extract(day from month) = 1),       -- badge: the month it was reached
  badge_code text,
  leaves     int not null check (leaves between -500 and 500 and leaves <> 0),
  reason     text check (length(reason) <= 200),
  created_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  foreign key (school_id, badge_code) references public.badge_tiers(school_id, code),
  check ((kind = 'badge') = (month is not null and badge_code is not null)),
  check (kind = 'badge' or (created_by is not null and length(trim(coalesce(reason, ''))) >= 3)),
  check (kind = 'teacher' or leaves > 0)
);
create unique index leaf_grants_one_per_badge_month on public.leaf_grants(class_id, month, badge_code) where kind = 'badge';
create index leaf_grants_class_idx on public.leaf_grants(class_id);
create index leaf_grants_school_idx on public.leaf_grants(school_id, granted_at desc);
create trigger leaf_grants_append_only before update or delete on public.leaf_grants
  for each row execute function app.forbid_change();

alter table public.badge_tiers    add column leaves smallint not null default 0 check (leaves between 0 and 500);
alter table public.eco_challenges add column leaves smallint not null default 0 check (leaves between 0 and 100);
alter table public.challenge_claims add column leaves smallint check (leaves >= 0);   -- copied from the challenge when claimed

-- Garden history also shows leaves won and given.
alter table public.garden_events drop constraint garden_events_kind_check;
alter table public.garden_events add constraint garden_events_kind_check check (kind in ('bought', 'reward', 'grew', 'leaves'));

-- Counting leaves reads these by the class that did the work.
create index peer_audits_auditor_idx on public.peer_audits(auditor_class_id) where voided_at is null;
create index ai_checks_checked_by_idx on public.ai_checks(checked_by_class_id) where voided_at is null;
create index challenge_claims_class_idx on public.challenge_claims(class_id) where status = 'approved';

alter table public.leaf_rates  enable row level security;
alter table public.leaf_grants enable row level security;
revoke all on public.leaf_rates, public.leaf_grants from public, anon, authenticated;

-- A claim keeps the leaves its challenge gave at the time, like its points.
create function app.challenge_claim_leaves() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.leaves is null then
    select c.leaves into new.leaves from public.eco_challenges c where c.id = new.challenge_id;
  end if;
  return new;
end $$;
create trigger challenge_claims_leaves before insert on public.challenge_claims
  for each row execute function app.challenge_claim_leaves();

-- ---------------------------------------------------------- default content ----
-- Switches one school to leaves. Runs once per school (the leaf_rates row is the marker).
create function app.seed_leaves(p_school uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_new int;
begin
  perform app.seed_rewards(p_school);                       -- shop, badges and challenges must exist first
  insert into public.leaf_rates (school_id) values (p_school) on conflict do nothing;
  get diagnostics v_new = row_count;
  if v_new = 0 then return; end if;                         -- already on leaves

  -- Shop prices: default point prices get the leaf price; any custom price is divided by 4.
  update public.garden_items i
     set cost = coalesce(
           (select v.leaves
              from (values ('seedling', 50, 15), ('marigold', 100, 25), ('butterfly', 120, 30), ('sunflower', 150, 40),
                           ('bench', 150, 40), ('bulbul', 200, 50), ('bush', 250, 60), ('neem', 500, 120),
                           ('date_palm', 750, 180), ('ghaf', 1000, 250)) v(code, points, leaves)
             where v.code = i.code and v.points = i.cost),
           greatest(1, round(i.cost / 4.0)::int))
   where i.school_id = p_school and i.cost is not null;

  update public.badge_tiers t set leaves = v.leaves
    from (values ('tiny_sprout', 10), ('green_keeper', 15), ('aqua_guardian', 20), ('earth_protector', 25),
                 ('eco_legend', 30), ('planet_pioneer', 40)) v(code, leaves)
   where t.school_id = p_school and t.code = v.code and t.leaves = 0;
  update public.badge_tiers t set leaves = least(500, 10 + 5 * t.sort)                        -- any other tier
   where t.school_id = p_school and t.leaves = 0;

  update public.eco_challenges
     set leaves = case when kind = 'instant' then 3 else least(100, greatest(1, round(points)))::smallint end
   where school_id = p_school and leaves = 0;
end $$;

select app.seed_leaves(id) from public.schools;

-- Claims made before today keep what their challenge gives now.
alter table public.challenge_claims disable trigger challenge_claims_guard;
update public.challenge_claims x set leaves = c.leaves from public.eco_challenges c where c.id = x.challenge_id and x.leaves is null;
alter table public.challenge_claims enable trigger challenge_claims_guard;
alter table public.challenge_claims alter column leaves set not null;

-- Plants already bought with points are re-priced in leaves.
alter table public.garden_plants disable trigger garden_plants_guard;
update public.garden_plants p set cost = i.cost
  from public.garden_items i
 where p.source = 'bought' and i.school_id = p.school_id and i.code = p.item_code and i.cost is not null;
alter table public.garden_plants enable trigger garden_plants_guard;

-- --------------------------------------------------------------- helpers ----

-- Where a class's leaves came from.
create function app.leaf_sources(p_class uuid,
  out class_checks int, out peer_checks int, out photos int, out challenges int, out badges int, out teacher int, out total int)
language sql stable security definer set search_path = '' as $$
  select s.cc, s.pc, s.ph, s.ch, s.bd, s.tc, s.cc + s.pc + s.ph + s.ch + s.bd + s.tc
    from (select
      (coalesce(r.class_check, 5) * (select count(*) from public.daily_entries e
                                      where e.class_id = p_class and e.voided_at is null))::int as cc,
      (coalesce(r.peer_check, 3) * (select count(*) from public.peer_audits a
                                     where a.auditor_class_id = p_class and a.voided_at is null))::int as pc,
      (coalesce(r.bin_photo, 3) * (select count(*) from public.ai_checks a
                                    where a.checked_by_class_id = p_class and a.check_type = 'bin' and a.voided_at is null)
       + coalesce(r.room_photo, 2) * (select count(*) from public.ai_checks a
                                       where a.checked_by_class_id = p_class and a.check_type = 'room' and a.voided_at is null))::int as ph,
      (select coalesce(sum(cl.leaves), 0) from public.challenge_claims cl
        where cl.class_id = p_class and cl.status = 'approved')::int as ch,
      (select coalesce(sum(g.leaves), 0) from public.leaf_grants g where g.class_id = p_class and g.kind = 'badge')::int as bd,
      (select coalesce(sum(g.leaves), 0) from public.leaf_grants g where g.class_id = p_class and g.kind = 'teacher')::int as tc
    from public.classes c left join public.leaf_rates r on r.school_id = c.school_id
   where c.id = p_class) s
$$;

-- The garden wallet, now in leaves: every leaf earned minus every leaf spent.
create or replace function app.garden_balance(p_class uuid, out earned numeric, out spent numeric, out available numeric)
language sql stable security definer set search_path = '' as $$
  select a.total::numeric, b.s, a.total - b.s
    from app.leaf_sources(p_class) a,
         (select coalesce(sum(cost), 0)::numeric as s from public.garden_plants where class_id = p_class) b
$$;

-- Badge leaves for every month a class reached a badge (once per badge per month, kept for good).
create function app.grant_badge_leaves(p_class uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_school uuid; v_today date; v_out jsonb;
begin
  select school_id into v_school from public.classes where id = p_class;
  v_today := app.school_today(v_school);
  with won as (
    insert into public.leaf_grants (school_id, class_id, kind, month, badge_code, leaves)
    select v_school, p_class, 'badge', m.month, t.code, t.leaves
      from (select date_trunc('month', l.points_date)::date as month, sum(l.points) as pts
              from public.points_ledger l where l.class_id = p_class group by 1) m
      join public.badge_tiers t on t.school_id = v_school and t.threshold <= m.pts and t.leaves > 0
    on conflict (class_id, month, badge_code) where kind = 'badge' do nothing
    returning month, badge_code, leaves
  ), named as (
    select w.month, w.leaves, t.name, t.sort
      from won w join public.badge_tiers t on t.school_id = v_school and t.code = w.badge_code
  ), ev as (
    insert into public.garden_events (school_id, class_id, kind, detail, event_date)
    select v_school, p_class, 'leaves', format('Won %s leaves with the %s badge (%s)', n.leaves, n.name, to_char(n.month, 'FMMonth')), v_today
      from named n
  )
  select coalesce(jsonb_agg(jsonb_build_object('badge', n.name, 'leaves', n.leaves, 'month', n.month) order by n.month, n.sort), '[]'::jsonb)
    into v_out from named n;
  return v_out;
end $$;

create function app.leaf_rates_json(p_school uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('class_check', coalesce(r.class_check, 5), 'peer_check', coalesce(r.peer_check, 3),
                            'bin_photo', coalesce(r.bin_photo, 3), 'room_photo', coalesce(r.room_photo, 2),
                            'ai_enabled', s.ai_enabled)
    from public.schools s left join public.leaf_rates r on r.school_id = s.id
   where s.id = p_school
$$;

-- This month's badge progress (now with each badge's leaves) and the best badge of every earlier month.
create or replace function app.class_badges(p_class uuid, p_today date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_school uuid; v_month date := date_trunc('month', p_today)::date; v_pts numeric;
begin
  select school_id into v_school from public.classes where id = p_class;
  v_pts := app.month_points(p_class, v_month);
  return jsonb_build_object(
    'month', v_month,
    'points', round(v_pts, 2),
    'tiers', (select coalesce(jsonb_agg(jsonb_build_object(
                'code', t.code, 'name', t.name, 'tagline', t.tagline, 'threshold', t.threshold, 'leaves', t.leaves,
                'reward_item', t.reward_item, 'reward_name', gi.name, 'reached', v_pts >= t.threshold) order by t.sort), '[]'::jsonb)
                from public.badge_tiers t
                left join public.garden_items gi on gi.school_id = t.school_id and gi.code = t.reward_item
               where t.school_id = v_school),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('month', m.month, 'code', m.code, 'name', m.name, 'points', round(m.pts, 2))
                                          order by m.month desc), '[]'::jsonb)
                  from (select mm.month, mm.pts, best.code, best.name
                          from (select date_trunc('month', l.points_date)::date as month, sum(l.points) as pts
                                  from public.points_ledger l
                                 where l.class_id = p_class and l.points_date < v_month
                                 group by 1) mm
                          join lateral (select t.code, t.name from public.badge_tiers t
                                         where t.school_id = v_school and t.threshold <= mm.pts
                                         order by t.threshold desc limit 1) best on true) m)
  );
end $$;

-- ---------------------------------------------------------- monitor: leaves ----

-- Badge leaves reached but not handed out yet (they're handed out, with a message, on the next garden visit).
create function app.pending_badge_leaves(p_class uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(t.leaves), 0)::int
    from (select date_trunc('month', l.points_date)::date as month, sum(l.points) as pts
            from public.points_ledger l where l.class_id = p_class group by 1) m
    join public.classes c on c.id = p_class
    join public.badge_tiers t on t.school_id = c.school_id and t.threshold <= m.pts and t.leaves > 0
   where not exists (select 1 from public.leaf_grants g
                      where g.class_id = p_class and g.kind = 'badge' and g.month = m.month and g.badge_code = t.code)
$$;

-- The class's leaves, for the header on every monitor screen. Read-only, so it never
-- races the garden page for the "you won leaves" message.
create function public.my_leaves() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles; b record; v_pending int;
begin
  me := app.require_monitor();
  select * into b from app.garden_balance(me.class_id);
  v_pending := app.pending_badge_leaves(me.class_id);
  return jsonb_build_object('earned', b.earned::int + v_pending, 'spent', b.spent::int, 'available', b.available::int + v_pending);
end $$;

create or replace function public.my_garden() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_class public.classes; v_today date; v_new jsonb; v_leaves jsonb; b record; s record;
begin
  me := app.require_monitor();
  select * into v_class from public.classes where id = me.class_id for update;   -- one reward grant at a time
  v_today := app.school_today(me.school_id);
  v_new := app.grant_badge_rewards(me.class_id, me.id);
  v_leaves := app.grant_badge_leaves(me.class_id);
  select * into b from app.garden_balance(me.class_id);
  select * into s from app.leaf_sources(me.class_id);
  return jsonb_build_object(
    'today', v_today,
    'class', jsonb_build_object('id', v_class.id, 'name', v_class.name),
    'plots', 18,
    'earned', b.earned::int,
    'spent', b.spent::int,
    'available', b.available::int,
    'new_rewards', v_new,
    'new_leaves', v_leaves,
    'sources', jsonb_build_object('class_checks', s.class_checks, 'peer_checks', s.peer_checks, 'photos', s.photos,
                                  'challenges', s.challenges, 'badges', s.badges, 'teacher', s.teacher),
    'rates', app.leaf_rates_json(me.school_id),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'code', i.code, 'name', i.name, 'kind', i.kind, 'cost', i.cost, 'grows', i.grows, 'info', i.info,
                'badge', (select bt.name from public.badge_tiers bt where bt.school_id = i.school_id and bt.reward_item = i.code limit 1))
                order by i.sort), '[]'::jsonb)
                from public.garden_items i where i.school_id = me.school_id and (i.active or i.cost is null)),
    'plants', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', p.id, 'item', p.item_code, 'plot', p.plot, 'stage', p.stage, 'waterings', p.waterings,
                 'watered_today', coalesce(p.last_watered = v_today, false), 'source', p.source, 'cost', p.cost,
                 'badge', bt.name, 'planted_on', p.planted_on) order by p.created_at), '[]'::jsonb)
                 from public.garden_plants p
                 left join public.badge_tiers bt on bt.school_id = p.school_id and bt.code = p.badge_code
                where p.class_id = me.class_id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('kind', e.kind, 'detail', e.detail, 'date', e.event_date) order by e.at desc, e.id desc), '[]'::jsonb)
                 from (select * from public.garden_events where class_id = me.class_id order by at desc, id desc limit 40) e),
    'badges', app.class_badges(me.class_id, v_today)
  );
end $$;

create or replace function public.garden_buy(p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_item public.garden_items; v_today date; b record; v_id uuid; v_plot smallint;
begin
  me := app.require_monitor();
  perform 1 from public.classes where id = me.class_id for update;               -- no double-spending
  select * into v_item from public.garden_items where school_id = me.school_id and code = p_item;
  if v_item.code is null or not v_item.active then raise exception 'That isn''t in the garden shop'; end if;
  if v_item.cost is null then raise exception '% can''t be bought: it''s won with a badge', v_item.name; end if;
  perform app.grant_badge_leaves(me.class_id);
  select * into b from app.garden_balance(me.class_id);
  if b.available < v_item.cost then
    raise exception 'Not enough leaves: you need % more for a %', ceil(v_item.cost - b.available)::int, v_item.name;
  end if;
  v_today := app.school_today(me.school_id);
  v_plot := app.free_plot(me.class_id);
  insert into public.garden_plants (school_id, class_id, item_code, plot, stage, source, cost, planted_on, created_by)
  values (me.school_id, me.class_id, v_item.code, v_plot, case when v_item.grows then 0 else 3 end, 'bought', v_item.cost, v_today, me.id)
  returning id into v_id;
  insert into public.garden_events (school_id, class_id, plant_id, kind, detail, event_date, actor_id)
  values (me.school_id, me.class_id, v_id, 'bought',
          format('%s %s for %s leaves', case when v_item.grows then 'Planted a' else 'Added a' end, v_item.name, v_item.cost), v_today, me.id);
  perform app.log(me.school_id, me.id, 'garden.buy', 'garden_plant', v_id::text,
    jsonb_build_object('item', v_item.code, 'leaves', v_item.cost));
  return jsonb_build_object('id', v_id, 'name', v_item.name, 'plot', v_plot, 'available', (b.available - v_item.cost)::int);
end $$;

-- ----------------------------------------------------- monitor: challenges ----

create or replace function public.my_challenges() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles; v_school public.schools; v_today date;
begin
  me := app.require_monitor();
  select * into v_school from public.schools where id = me.school_id;
  v_today := app.school_today(me.school_id);
  return jsonb_build_object(
    'today', v_today,
    'open', v_school.points_start_date is null or v_today >= v_school.points_start_date,
    'points_start_date', v_school.points_start_date,
    'challenges', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'token', c.token, 'title', c.title, 'summary', c.summary, 'steps', c.steps, 'place', c.place,
        'points', c.points, 'leaves', c.leaves, 'kind', c.kind, 'repeat_every', c.repeat_every,
        'status', cl.status, 'answer', cl.answer, 'review_note', cl.review_note,
        'last_rejected', (select r.review_note from public.challenge_claims r
                           where r.challenge_id = c.id and r.class_id = me.class_id and r.status = 'rejected'
                             and r.period_start = app.period_start(c.repeat_every, v_today)
                           order by r.submitted_at desc limit 1),
        'done_count', (select count(*) from public.challenge_claims d
                        where d.challenge_id = c.id and d.class_id = me.class_id and d.status = 'approved'))
        order by c.sort, c.title), '[]'::jsonb)
      from public.eco_challenges c
      left join public.challenge_claims cl
        on cl.challenge_id = c.id and cl.class_id = me.class_id and cl.status in ('approved', 'pending')
       and cl.period_start = app.period_start(c.repeat_every, v_today)
     where c.school_id = me.school_id and c.active)
  );
end $$;

create or replace function public.claim_challenge(p_token text, p_answer text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_school public.schools; v_c public.eco_challenges; v_today date; v_answer text;
        v_id uuid; v_status text;
begin
  me := app.require_monitor();
  select * into v_school from public.schools where id = me.school_id;
  select * into v_c from public.eco_challenges where token = lower(trim(p_token)) and school_id = me.school_id;
  if v_c.id is null or not v_c.active then raise exception 'This QR code isn''t an active eco challenge'; end if;
  v_today := app.school_today(me.school_id);
  if v_school.points_start_date is not null and v_today < v_school.points_start_date then
    raise exception 'Eco challenges open when points start on %', to_char(v_school.points_start_date, 'FMDD Mon');
  end if;
  v_answer := nullif(trim(coalesce(p_answer, '')), '');
  if v_c.kind = 'review' and coalesce(length(v_answer), 0) < 15 then
    raise exception 'Write what your class did or found (at least one full sentence) so your teacher can approve it';
  end if;
  if length(v_answer) > 1000 then raise exception 'Keep it under 1,000 characters'; end if;
  v_status := case v_c.kind when 'instant' then 'approved' else 'pending' end;
  begin
    insert into public.challenge_claims (school_id, challenge_id, class_id, claim_date, period_start, status, answer, points, leaves, submitted_by)
    values (me.school_id, v_c.id, me.class_id, v_today, app.period_start(v_c.repeat_every, v_today), v_status, v_answer, v_c.points, v_c.leaves, me.id)
    returning id into v_id;
  exception when unique_violation then
    raise exception '%', case v_c.repeat_every
      when 'day' then 'Your class has already done this challenge today. Come back tomorrow!'
      when 'week' then 'Your class has already done this challenge this week.'
      when 'month' then 'Your class has already done this challenge this month.'
      else 'Your class has already done this challenge.' end;
  end;
  if v_status = 'approved' then
    insert into public.points_ledger (school_id, class_id, points_date, source, challenge_claim_id, points, reason, created_by)
    values (me.school_id, me.class_id, v_today, 'challenge', v_id, v_c.points, v_c.title, me.id);
  end if;
  perform app.log(me.school_id, me.id, 'challenge.claim', 'challenge_claim', v_id::text,
    jsonb_build_object('challenge', v_c.title, 'status', v_status, 'points', v_c.points, 'leaves', v_c.leaves));
  return jsonb_build_object('status', v_status, 'points', v_c.points, 'leaves', v_c.leaves, 'title', v_c.title);
end $$;

-- ----------------------------------------------------- teacher: challenges ----

drop function public.teacher_challenges();
create function public.teacher_challenges() returns table (
  id uuid, code text, title text, summary text, steps text, place text, points numeric, leaves smallint, kind text,
  repeat_every text, token text, sort smallint, active boolean, done_this_month bigint, pending bigint)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles; v_month date;
begin
  me := app.require_teacher();
  v_month := date_trunc('month', app.school_today(me.school_id))::date;
  return query
    select c.id, c.code, c.title, c.summary, c.steps, c.place, c.points, c.leaves, c.kind, c.repeat_every, c.token, c.sort, c.active,
           (select count(*) from public.challenge_claims x where x.challenge_id = c.id and x.status = 'approved' and x.claim_date >= v_month),
           (select count(*) from public.challenge_claims x where x.challenge_id = c.id and x.status = 'pending')
      from public.eco_challenges c
     where c.school_id = me.school_id
     order by c.active desc, c.sort, c.title;
end $$;

drop function public.upsert_eco_challenge(uuid, text, text, text, text, numeric, text, text, boolean);
create function public.upsert_eco_challenge(p_id uuid, p_title text, p_summary text, p_steps text, p_place text,
                                            p_points numeric, p_leaves int, p_kind text, p_repeat text, p_active boolean)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_id uuid;
begin
  me := app.require_teacher();
  if coalesce(length(trim(p_title)), 0) < 3 then raise exception 'Give the challenge a title'; end if;
  if coalesce(length(trim(p_summary)), 0) < 3 then raise exception 'Add a one-line summary'; end if;
  if coalesce(length(trim(p_steps)), 0) < 3 then raise exception 'Say what the class has to do'; end if;
  if p_points is null or p_points <= 0 or p_points > 50 then raise exception 'Points must be more than 0 and at most 50'; end if;
  if p_leaves is null or p_leaves < 0 or p_leaves > 100 then raise exception 'Leaves must be between 0 and 100'; end if;
  if p_kind not in ('instant', 'review') then raise exception 'Pick how it''s checked'; end if;
  if p_repeat not in ('day', 'week', 'month', 'once') then raise exception 'Pick how often it can be done'; end if;
  if p_id is null then
    insert into public.eco_challenges (school_id, code, title, summary, steps, place, points, leaves, kind, repeat_every, active)
    values (me.school_id, 'c_' || substr(md5(gen_random_uuid()::text), 1, 8), trim(p_title), trim(p_summary), trim(p_steps),
            nullif(trim(coalesce(p_place, '')), ''), p_points, p_leaves, p_kind, p_repeat, coalesce(p_active, true))
    returning id into v_id;
  else
    update public.eco_challenges
       set title = trim(p_title), summary = trim(p_summary), steps = trim(p_steps), place = nullif(trim(coalesce(p_place, '')), ''),
           points = p_points, leaves = p_leaves, kind = p_kind, repeat_every = p_repeat, active = coalesce(p_active, active)
     where id = p_id and school_id = me.school_id
    returning id into v_id;
    if v_id is null then raise exception 'Challenge not found'; end if;
  end if;
  perform app.log(me.school_id, me.id, 'challenge.save', 'eco_challenge', v_id::text,
    jsonb_build_object('title', trim(p_title), 'points', p_points, 'leaves', p_leaves));
  return v_id;
end $$;

-- ------------------------------------------------------ teacher: leaves, shop ----

create function public.award_leaves(p_class_id uuid, p_leaves int, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_class public.classes; v_reason text; v_id uuid;
begin
  me := app.require_teacher();
  select * into v_class from public.classes where id = p_class_id and school_id = me.school_id;
  if v_class.id is null then raise exception 'Class not found'; end if;
  if p_leaves is null or p_leaves = 0 or abs(p_leaves) > 500 then
    raise exception 'Leaves must be a whole number between -500 and 500, not 0';
  end if;
  v_reason := app.require_reason(p_reason);
  if length(v_reason) > 200 then raise exception 'Keep the reason under 200 characters'; end if;
  insert into public.leaf_grants (school_id, class_id, kind, leaves, reason, created_by)
  values (me.school_id, v_class.id, 'teacher', p_leaves, v_reason, me.id)
  returning id into v_id;
  insert into public.garden_events (school_id, class_id, kind, detail, event_date, actor_id)
  values (me.school_id, v_class.id, 'leaves',
          left(case when p_leaves > 0 then format('Your teacher gave you %s leaves: %s', p_leaves, v_reason)
                    else format('Your teacher took back %s leaves: %s', -p_leaves, v_reason) end, 200),
          app.school_today(me.school_id), me.id);
  perform app.log(me.school_id, me.id, 'leaves.award', 'leaf_grant', v_id::text,
    jsonb_build_object('class', v_class.name, 'leaves', p_leaves, 'reason', v_reason));
  return v_id;
end $$;

create function public.teacher_leaf_grants(p_limit int default 20) returns table (
  id uuid, granted_at timestamptz, class_name text, leaves int, reason text, by_name text)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  return query
    select g.id, g.granted_at, c.name, g.leaves, g.reason, p.display_name
      from public.leaf_grants g
      join public.classes c on c.id = g.class_id
      left join public.profiles p on p.id = g.created_by
     where g.school_id = me.school_id and g.kind = 'teacher'
     order by g.granted_at desc
     limit least(greatest(coalesce(p_limit, 20), 1), 200);
end $$;

create or replace function public.teacher_rewards_config() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  return jsonb_build_object(
    'tiers', (select coalesce(jsonb_agg(jsonb_build_object('code', t.code, 'name', t.name, 'tagline', t.tagline,
                'threshold', t.threshold, 'leaves', t.leaves, 'reward_name', gi.name) order by t.sort), '[]'::jsonb)
                from public.badge_tiers t left join public.garden_items gi on gi.school_id = t.school_id and gi.code = t.reward_item
               where t.school_id = me.school_id),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('code', i.code, 'name', i.name, 'kind', i.kind, 'cost', i.cost,
                'active', i.active) order by i.sort), '[]'::jsonb)
                from public.garden_items i where i.school_id = me.school_id),
    'rates', app.leaf_rates_json(me.school_id));
end $$;

create or replace function public.update_garden_item(p_code text, p_cost int, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_i public.garden_items;
begin
  me := app.require_teacher();
  select * into v_i from public.garden_items where school_id = me.school_id and code = p_code for update;
  if v_i.code is null then raise exception 'Item not found'; end if;
  if v_i.cost is null then raise exception '% is won with a badge, so it has no price', v_i.name; end if;
  if p_cost is null or p_cost < 1 or p_cost > 5000 then raise exception 'Price must be between 1 and 5,000 leaves'; end if;
  update public.garden_items set cost = p_cost, active = coalesce(p_active, active) where school_id = me.school_id and code = p_code;
  perform app.log(me.school_id, me.id, 'garden.price', 'garden_item', p_code, jsonb_build_object('leaves', p_cost, 'active', p_active));
end $$;

-- ---------------------------------------------------------------- grants ----
revoke all on function
  app.challenge_claim_leaves(), app.seed_leaves(uuid), app.leaf_sources(uuid), app.grant_badge_leaves(uuid),
  app.pending_badge_leaves(uuid), app.leaf_rates_json(uuid),
  public.my_leaves(), public.teacher_challenges(),
  public.upsert_eco_challenge(uuid, text, text, text, text, numeric, int, text, text, boolean),
  public.award_leaves(uuid, int, text), public.teacher_leaf_grants(int)
from public, anon, authenticated;

grant execute on function
  public.my_leaves(), public.teacher_challenges(),
  public.upsert_eco_challenge(uuid, text, text, text, text, numeric, int, text, text, boolean),
  public.award_leaves(uuid, int, text), public.teacher_leaf_grants(int)
to authenticated;

commit;
