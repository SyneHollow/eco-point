-- =============================================================================
-- EcoPoints rewards (5 Nov 2026): monthly class badges, class virtual gardens,
-- QR eco-challenges.
--
--   Badges     A class earns a badge in a calendar month when its points for
--              that month reach the badge's threshold. Six tiers per school,
--              thresholds editable by teachers. Some badges win a rare plant.
--   Garden     Each CLASS grows one garden (EcoPoints has no student accounts,
--              by design). Garden points = every point the class has earned
--              minus what it has spent. Spending never lowers the leaderboard
--              or badges. Plants grow one stage per day they are watered:
--              seed > sprout > young plant > fully grown. Plants are never removed.
--   Challenges Printable QR codes open a challenge. "instant" challenges give
--              points as soon as the class confirms; "review" challenges need a
--              short write-up that a teacher approves. Each can be done once per
--              day / week / month, or once ever.
--
-- Run after 20261103000000_ai_checks.sql. Then run supabase/tests/rewards_checks.sql.
-- =============================================================================

-- ---------------------------------------------------------------- tables ----

create table public.badge_tiers (
  school_id   uuid not null references public.schools(id),
  code        text not null check (code ~ '^[a-z_]{2,30}$'),
  name        text not null check (length(trim(name)) between 2 and 40),
  tagline     text not null check (length(tagline) <= 120),
  threshold   int  not null check (threshold between 1 and 100000),
  sort        smallint not null,
  reward_item text,                       -- garden item won the first time a class earns this badge
  primary key (school_id, code)
);

create table public.garden_items (
  school_id uuid not null references public.schools(id),
  code      text not null check (code ~ '^[a-z_]{2,30}$'),
  name      text not null check (length(trim(name)) between 2 and 40),
  kind      text not null check (kind in ('plant', 'flower', 'tree', 'decor', 'rare')),
  cost      int check (cost between 1 and 100000),   -- null = can't be bought, only won with a badge
  grows     boolean not null,                         -- plants grow; decorations don't
  info      text not null check (length(info) <= 300),
  sort      smallint not null,
  active    boolean not null default true,
  primary key (school_id, code)
);

create table public.garden_plants (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id),
  class_id     uuid not null references public.classes(id),
  item_code    text not null,
  plot         smallint check (plot between 0 and 17),   -- null = waiting in the shed (garden full)
  stage        smallint not null default 0 check (stage between 0 and 3),
  waterings    smallint not null default 0 check (waterings >= 0),
  last_watered date,
  source       text not null check (source in ('bought', 'reward')),
  cost         int not null default 0 check (cost >= 0),
  badge_code   text,
  planted_on   date not null,
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  foreign key (school_id, item_code) references public.garden_items(school_id, code),
  check ((source = 'reward') = (badge_code is not null)),
  check (source = 'bought' or cost = 0)
);
create unique index garden_plants_one_per_plot on public.garden_plants(class_id, plot) where plot is not null;
create unique index garden_plants_one_reward_per_badge on public.garden_plants(class_id, badge_code) where badge_code is not null;
create index garden_plants_class_idx on public.garden_plants(class_id);

create table public.garden_events (
  id         bigint generated always as identity primary key,
  school_id  uuid not null references public.schools(id),
  class_id   uuid not null references public.classes(id),
  plant_id   uuid references public.garden_plants(id),
  kind       text not null check (kind in ('bought', 'reward', 'grew')),
  detail     text not null check (length(detail) <= 200),
  event_date date not null,
  actor_id   uuid,
  at         timestamptz not null default now()
);
create index garden_events_class_idx on public.garden_events(class_id, at desc);

create table public.eco_challenges (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id),
  code         text not null check (code ~ '^[a-z0-9_]{2,40}$'),
  title        text not null check (length(trim(title)) between 3 and 60),
  summary      text not null check (length(trim(summary)) between 3 and 200),
  steps        text not null check (length(trim(steps)) between 3 and 600),
  place        text check (length(place) <= 80),          -- where the QR code goes
  points       numeric(5,2) not null check (points > 0 and points <= 50),
  kind         text not null check (kind in ('instant', 'review')),
  repeat_every text not null check (repeat_every in ('day', 'week', 'month', 'once')),
  token        text not null unique default substr(md5(gen_random_uuid()::text), 1, 10) check (token ~ '^[a-z0-9]{10}$'),
  sort         smallint not null default 100,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (school_id, code)
);

create table public.challenge_claims (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id),
  challenge_id uuid not null references public.eco_challenges(id),
  class_id     uuid not null references public.classes(id),
  claim_date   date not null,
  period_start date not null,
  status       text not null check (status in ('approved', 'pending', 'rejected', 'voided')),
  answer       text check (length(answer) <= 1000),
  points       numeric(5,2) not null check (points > 0),
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz not null default now(),
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz,
  review_note  text check (length(review_note) <= 300),
  check ((reviewed_at is null) = (reviewed_by is null))
);
create unique index challenge_claims_one_per_period on public.challenge_claims(challenge_id, class_id, period_start)
  where status in ('approved', 'pending');
create index challenge_claims_school_date_idx on public.challenge_claims(school_id, claim_date);

-- ------------------------------------------------- ledger: 'challenge' source ----
alter table public.points_ledger add column challenge_claim_id uuid references public.challenge_claims(id);
alter table public.points_ledger drop constraint points_ledger_source_check;
alter table public.points_ledger add constraint points_ledger_source_check
  check (source in ('daily', 'audit', 'ai', 'challenge', 'bonus', 'adjustment', 'reversal'));
create index points_ledger_challenge_idx on public.points_ledger(challenge_claim_id) where challenge_claim_id is not null;

-- ---------------------------------------------------------------- guards ----
-- Plants are never removed, and what was paid for them can't change: only position and growth move.
create function app.garden_plant_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Garden plants can''t be removed' using errcode = '42501';
  end if;
  if (new.id, new.school_id, new.class_id, new.item_code, new.source, new.cost, new.badge_code, new.planted_on, new.created_by)
     is distinct from
     (old.id, old.school_id, old.class_id, old.item_code, old.source, old.cost, old.badge_code, old.planted_on, old.created_by) then
    raise exception 'Only a plant''s position and growth can change' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger garden_plants_guard before update or delete on public.garden_plants
  for each row execute function app.garden_plant_guard();
create trigger garden_events_append_only before update or delete on public.garden_events
  for each row execute function app.forbid_change();

-- A claim's facts never change; only its status and review do.
create function app.challenge_claim_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Challenge claims can''t be deleted' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['status','reviewed_by','reviewed_at','review_note'])
     is distinct from (to_jsonb(old) - array['status','reviewed_by','reviewed_at','review_note']) then
    raise exception 'Challenge claims can''t be edited' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger challenge_claims_guard before update or delete on public.challenge_claims
  for each row execute function app.challenge_claim_guard();

-- -------------------------------------------------------------------- RLS ----
-- Clients never read these tables directly: everything goes through the functions below.
alter table public.badge_tiers      enable row level security;
alter table public.garden_items     enable row level security;
alter table public.garden_plants    enable row level security;
alter table public.garden_events    enable row level security;
alter table public.eco_challenges   enable row level security;
alter table public.challenge_claims enable row level security;
revoke all on public.badge_tiers, public.garden_items, public.garden_plants, public.garden_events,
              public.eco_challenges, public.challenge_claims from public, anon, authenticated;

-- ---------------------------------------------------------- default content ----
create function app.seed_rewards(p_school uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.garden_items (school_id, code, name, kind, cost, grows, info, sort) values
    (p_school, 'seedling',    'Seedling',     'plant',  50,   true,  'Every garden starts small. A seedling needs water and light to grow.', 10),
    (p_school, 'marigold',    'Marigold',     'flower', 100,  true,  'Bright marigolds bring bees to the garden and help keep some pests away.', 20),
    (p_school, 'butterfly',   'Butterfly',    'decor',  120,  false, 'Butterflies carry pollen from flower to flower, so new seeds can form.', 30),
    (p_school, 'sunflower',   'Sunflower',    'flower', 150,  true,  'Young sunflowers turn to follow the sun across the sky.', 40),
    (p_school, 'bench',       'Garden bench', 'decor',  150,  false, 'Somewhere to sit and enjoy the garden your class has grown.', 50),
    (p_school, 'bulbul',      'Bulbul',       'decor',  200,  false, 'The white-eared bulbul is one of the most common garden birds in the UAE.', 60),
    (p_school, 'bush',        'Bush',         'plant',  250,  true,  'Bushes shelter birds and insects, and their roots hold the soil together.', 70),
    (p_school, 'neem',        'Neem tree',    'tree',   500,  true,  'Neem trees cope with heat and little rain, and give wide shade.', 80),
    (p_school, 'date_palm',   'Date palm',    'tree',   750,  true,  'Date palms have been grown in the UAE for thousands of years. One palm can give dozens of kilos of dates a year.', 90),
    (p_school, 'ghaf',        'Ghaf tree',    'tree',   1000, true,  'The Ghaf is the UAE''s national tree. Its deep roots reach water far underground, so it stays green in the desert.', 100),
    (p_school, 'lotus_pond',  'Lotus pond',   'rare',   null, false, 'Won with the Aqua Guardian badge. A pond gives birds and insects water to drink.', 110),
    (p_school, 'desert_rose', 'Desert rose',  'rare',   null, true,  'Won with the Earth Protector badge. The desert rose stores water in its thick trunk.', 120),
    (p_school, 'sidr',        'Sidr tree',    'rare',   null, true,  'Won with the Eco Legend badge. The Sidr is a native tree that survives heat, drought and salty soil.', 130),
    (p_school, 'golden_ghaf', 'Golden Ghaf',  'rare',   null, true,  'Won with the Planet Pioneer badge, the highest there is. Only top classes grow one.', 140)
  on conflict do nothing;

  insert into public.badge_tiers (school_id, code, name, tagline, threshold, sort, reward_item) values
    (p_school, 'tiny_sprout',     'Tiny Sprout',     'Your sustainability journey begins!',     100, 1, 'seedling'),
    (p_school, 'green_keeper',    'Green Keeper',    'You''ve helped your environment grow.',  200, 2, 'butterfly'),
    (p_school, 'aqua_guardian',   'Aqua Guardian',   'A champion of water conservation.',      350, 3, 'lotus_pond'),
    (p_school, 'earth_protector', 'Earth Protector', 'Your actions are creating change.',      500, 4, 'desert_rose'),
    (p_school, 'eco_legend',      'Eco Legend',      'You''ve reached an incredible milestone!', 650, 5, 'sidr'),
    (p_school, 'planet_pioneer',  'Planet Pioneer',  'An inspiration to your entire school.',  800, 6, 'golden_ghaf')
  on conflict do nothing;

  insert into public.eco_challenges (school_id, code, title, summary, steps, place, points, kind, repeat_every, sort) values
    (p_school, 'recycle_right', 'Recycle right', 'Put recyclable waste in the right bin.',
     'Put one clean piece of recyclable waste (a plastic bottle, a can or paper) in the right recycling bin. Then scan the code and tap Done.',
     'Next to the recycling bins', 2, 'instant', 'day', 10),
    (p_school, 'refill_station', 'Refill, don''t buy', 'Refill a reusable bottle instead of buying a plastic one.',
     'Fill a reusable bottle here instead of buying a drink in plastic. Then scan the code and tap Done.',
     'At the water cooler', 2, 'instant', 'day', 20),
    (p_school, 'switch_off', 'Switch-off hero', 'Switch off lights and fans in an empty room.',
     'Find a room nobody is using with the lights or fans on. Switch them off. Then scan the code and tap Done.',
     'By a light switch', 2, 'instant', 'day', 30),
    (p_school, 'mystery_waste_audit', 'Mystery Waste Audit', 'Investigate how much avoidable waste one classroom produces.',
     'At the end of the day, look through one classroom bin with your teacher''s permission (use gloves). Count what could have been avoided, what could be recycled, and food waste. Write your counts and one idea to cut the avoidable waste.',
     'Classroom bin', 15, 'review', 'month', 40),
    (p_school, 'no_new_buy_day', 'No-New-Buy Day', 'Find ways to reuse or borrow something instead of buying it.',
     'For one school day, your class buys nothing new. Write what you borrowed, reused or fixed instead.',
     'Class noticeboard', 10, 'review', 'month', 50),
    (p_school, 'digital_declutter', 'Digital Declutter', 'Delete unnecessary files and emails to reduce digital clutter.',
     'Clear old files, photos and emails from the class computer or your school accounts. Stored data uses energy in data centres. Write roughly how much you deleted.',
     'Computer lab', 10, 'review', 'month', 60),
    (p_school, 'water_watcher', 'Water Watcher', 'Identify and report leaking taps around school.',
     'Walk around school and check the taps. Write where any leaking or dripping tap is, so it can be fixed. Finding no leaks counts too.',
     'By the washroom sinks', 10, 'review', 'week', 70),
    (p_school, 'one_item_five_uses', 'One Item, Five Uses', 'Find five creative ways to reuse one discarded item.',
     'Pick one item that would be thrown away (a jar, a box, a bottle). Write five creative ways to reuse it.',
     'Class noticeboard', 10, 'review', 'month', 80),
    (p_school, 'lunch_waste_tracker', 'Lunch Waste Tracker', 'Track avoidable food waste and suggest ways to reduce it.',
     'For one lunch break, note how much food your class throws away and why. Suggest two ways to waste less.',
     'Lunch area', 15, 'review', 'month', 90),
    (p_school, 'eco_interview', 'Eco Interview', 'Interview a family member or teacher about one sustainable habit.',
     'Ask a family member or teacher about one eco habit they keep and why. Write what you learned. Don''t write anyone''s name.',
     'Class noticeboard', 10, 'review', 'month', 100),
    (p_school, 'packaging_detective', 'Packaging Detective', 'Compare product packaging and find the option with less unnecessary packaging.',
     'Compare two versions of the same product, such as two snacks or two juices. Which one uses less packaging? Write what you compared and your verdict.',
     'Canteen', 10, 'review', 'month', 110)
  on conflict do nothing;
end $$;

select app.seed_rewards(id) from public.schools;

-- --------------------------------------------------------------- helpers ----

-- Garden points: every point the class has ever been given (incl. reversals), minus what it has spent.
create function app.garden_balance(p_class uuid, out earned numeric, out spent numeric, out available numeric)
language sql stable security definer set search_path = '' as $$
  select a.e, b.s, a.e - b.s
    from (select coalesce(sum(points), 0)::numeric as e from public.points_ledger where class_id = p_class) a,
         (select coalesce(sum(cost), 0)::numeric as s from public.garden_plants where class_id = p_class) b
$$;

create function app.free_plot(p_class uuid) returns smallint
language sql stable security definer set search_path = '' as $$
  select min(g)::smallint from generate_series(0, 17) g
   where not exists (select 1 from public.garden_plants p where p.class_id = p_class and p.plot = g)
$$;

-- Points per calendar month for one class.
create function app.month_points(p_class uuid, p_month date) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(points), 0) from public.points_ledger
   where class_id = p_class and points_date >= p_month and points_date < (p_month + interval '1 month')::date
$$;

-- This month's badge progress and the best badge of every earlier month.
create function app.class_badges(p_class uuid, p_today date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_school uuid; v_month date := date_trunc('month', p_today)::date; v_pts numeric;
begin
  select school_id into v_school from public.classes where id = p_class;
  v_pts := app.month_points(p_class, v_month);
  return jsonb_build_object(
    'month', v_month,
    'points', round(v_pts, 2),
    'tiers', (select coalesce(jsonb_agg(jsonb_build_object(
                'code', t.code, 'name', t.name, 'tagline', t.tagline, 'threshold', t.threshold,
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

-- Give a class the reward plant of every badge it has ever reached in any month (once per badge).
-- Caller must hold a lock on the class row.
create function app.grant_badge_rewards(p_class uuid, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_school uuid; v_best numeric; v_today date; v_out jsonb := '[]'::jsonb; t record; v_id uuid;
begin
  select school_id into v_school from public.classes where id = p_class;
  v_today := app.school_today(v_school);
  select max(s) into v_best from (
    select sum(points) as s from public.points_ledger where class_id = p_class group by date_trunc('month', points_date)) m;
  for t in
    select bt.code, bt.name, bt.reward_item, gi.name as item_name, gi.grows
      from public.badge_tiers bt
      join public.garden_items gi on gi.school_id = bt.school_id and gi.code = bt.reward_item
     where bt.school_id = v_school and bt.threshold <= coalesce(v_best, 0)
       and not exists (select 1 from public.garden_plants p where p.class_id = p_class and p.badge_code = bt.code)
     order by bt.sort
  loop
    insert into public.garden_plants (school_id, class_id, item_code, plot, stage, source, cost, badge_code, planted_on, created_by)
    values (v_school, p_class, t.reward_item, app.free_plot(p_class), case when t.grows then 0 else 3 end,
            'reward', 0, t.code, v_today, p_actor)
    returning id into v_id;
    insert into public.garden_events (school_id, class_id, plant_id, kind, detail, event_date, actor_id)
    values (v_school, p_class, v_id, 'reward', format('Won a %s with the %s badge', t.item_name, t.name), v_today, p_actor);
    v_out := v_out || jsonb_build_object('badge', t.name, 'item', t.reward_item, 'name', t.item_name);
  end loop;
  return v_out;
end $$;

create function app.period_start(p_repeat text, p_day date) returns date
language sql immutable set search_path = '' as $$
  select case p_repeat
    when 'day' then p_day
    when 'week' then date_trunc('week', p_day)::date
    when 'month' then date_trunc('month', p_day)::date
    else date '2000-01-01' end
$$;

-- --------------------------------------------------------- monitor: garden ----

create function public.my_garden() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_class public.classes; v_today date; v_new jsonb; b record;
begin
  me := app.require_monitor();
  select * into v_class from public.classes where id = me.class_id for update;   -- one reward grant at a time
  v_today := app.school_today(me.school_id);
  v_new := app.grant_badge_rewards(me.class_id, me.id);
  select * into b from app.garden_balance(me.class_id);
  return jsonb_build_object(
    'today', v_today,
    'class', jsonb_build_object('id', v_class.id, 'name', v_class.name),
    'plots', 18,
    'earned', round(b.earned, 2),
    'spent', b.spent,
    'available', round(b.available, 2),
    'new_rewards', v_new,
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
    'events', (select coalesce(jsonb_agg(jsonb_build_object('kind', e.kind, 'detail', e.detail, 'date', e.event_date) order by e.at desc), '[]'::jsonb)
                 from (select * from public.garden_events where class_id = me.class_id order by at desc limit 40) e),
    'badges', app.class_badges(me.class_id, v_today)
  );
end $$;

create function public.garden_buy(p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_item public.garden_items; v_today date; b record; v_id uuid; v_plot smallint;
begin
  me := app.require_monitor();
  perform 1 from public.classes where id = me.class_id for update;               -- no double-spending
  select * into v_item from public.garden_items where school_id = me.school_id and code = p_item;
  if v_item.code is null or not v_item.active then raise exception 'That isn''t in the garden shop'; end if;
  if v_item.cost is null then raise exception '% can''t be bought: it''s won with a badge', v_item.name; end if;
  select * into b from app.garden_balance(me.class_id);
  if b.available < v_item.cost then
    raise exception 'Not enough garden points: you need % more for a %', ceil(v_item.cost - b.available)::int, v_item.name;
  end if;
  v_today := app.school_today(me.school_id);
  v_plot := app.free_plot(me.class_id);
  insert into public.garden_plants (school_id, class_id, item_code, plot, stage, source, cost, planted_on, created_by)
  values (me.school_id, me.class_id, v_item.code, v_plot, case when v_item.grows then 0 else 3 end, 'bought', v_item.cost, v_today, me.id)
  returning id into v_id;
  insert into public.garden_events (school_id, class_id, plant_id, kind, detail, event_date, actor_id)
  values (me.school_id, me.class_id, v_id, 'bought',
          format('%s %s for %s points', case when v_item.grows then 'Planted a' else 'Added a' end, v_item.name, v_item.cost), v_today, me.id);
  perform app.log(me.school_id, me.id, 'garden.buy', 'garden_plant', v_id::text,
    jsonb_build_object('item', v_item.code, 'cost', v_item.cost));
  return jsonb_build_object('id', v_id, 'name', v_item.name, 'plot', v_plot, 'available', round(b.available - v_item.cost, 2));
end $$;

create function public.garden_water(p_plant uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_p public.garden_plants; v_item public.garden_items; v_today date; v_grew boolean := false;
begin
  me := app.require_monitor();
  select * into v_p from public.garden_plants where id = p_plant and class_id = me.class_id for update;
  if v_p.id is null then raise exception 'That plant isn''t in your garden'; end if;
  select * into v_item from public.garden_items where school_id = v_p.school_id and code = v_p.item_code;
  if not v_item.grows then raise exception '% doesn''t need water', v_item.name; end if;
  v_today := app.school_today(me.school_id);
  if v_p.last_watered = v_today then raise exception 'Already watered today. Come back tomorrow.'; end if;
  v_grew := v_p.stage < 3;
  update public.garden_plants
     set waterings = waterings + 1, last_watered = v_today, stage = least(3, stage + 1)
   where id = v_p.id;
  if v_grew then
    insert into public.garden_events (school_id, class_id, plant_id, kind, detail, event_date, actor_id)
    values (me.school_id, me.class_id, v_p.id, 'grew',
            format('%s grew into %s', v_item.name,
                   (array['a sprout', 'a young plant', 'a fully grown plant'])[v_p.stage + 1]), v_today, me.id);
  end if;
  return jsonb_build_object('stage', least(3, v_p.stage + 1), 'grew', v_grew, 'name', v_item.name);
end $$;

create function public.garden_move(p_plant uuid, p_plot int) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_p public.garden_plants; v_other uuid;
begin
  me := app.require_monitor();
  if p_plot is null or p_plot < 0 or p_plot > 17 then raise exception 'That spot isn''t in the garden'; end if;
  perform 1 from public.classes where id = me.class_id for update;
  select * into v_p from public.garden_plants where id = p_plant and class_id = me.class_id;
  if v_p.id is null then raise exception 'That plant isn''t in your garden'; end if;
  if v_p.plot = p_plot then return; end if;
  select id into v_other from public.garden_plants where class_id = me.class_id and plot = p_plot;
  if v_other is not null then
    update public.garden_plants set plot = null where id = v_other;                   -- swap places
  end if;
  update public.garden_plants set plot = p_plot where id = v_p.id;
  if v_other is not null then
    update public.garden_plants set plot = v_p.plot where id = v_other;
  end if;
end $$;

-- ----------------------------------------------------- monitor: challenges ----

create function public.my_challenges() returns jsonb
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
        'points', c.points, 'kind', c.kind, 'repeat_every', c.repeat_every,
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

create function public.claim_challenge(p_token text, p_answer text) returns jsonb
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
    insert into public.challenge_claims (school_id, challenge_id, class_id, claim_date, period_start, status, answer, points, submitted_by)
    values (me.school_id, v_c.id, me.class_id, v_today, app.period_start(v_c.repeat_every, v_today), v_status, v_answer, v_c.points, me.id)
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
    jsonb_build_object('challenge', v_c.title, 'status', v_status, 'points', v_c.points));
  return jsonb_build_object('status', v_status, 'points', v_c.points, 'title', v_c.title);
end $$;

-- ----------------------------------------------------- teacher: challenges ----

create function public.teacher_challenges() returns table (
  id uuid, code text, title text, summary text, steps text, place text, points numeric, kind text,
  repeat_every text, token text, sort smallint, active boolean, done_this_month bigint, pending bigint)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles; v_month date;
begin
  me := app.require_teacher();
  v_month := date_trunc('month', app.school_today(me.school_id))::date;
  return query
    select c.id, c.code, c.title, c.summary, c.steps, c.place, c.points, c.kind, c.repeat_every, c.token, c.sort, c.active,
           (select count(*) from public.challenge_claims x where x.challenge_id = c.id and x.status = 'approved' and x.claim_date >= v_month),
           (select count(*) from public.challenge_claims x where x.challenge_id = c.id and x.status = 'pending')
      from public.eco_challenges c
     where c.school_id = me.school_id
     order by c.active desc, c.sort, c.title;
end $$;

create function public.upsert_eco_challenge(p_id uuid, p_title text, p_summary text, p_steps text, p_place text,
                                            p_points numeric, p_kind text, p_repeat text, p_active boolean)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_id uuid;
begin
  me := app.require_teacher();
  if coalesce(length(trim(p_title)), 0) < 3 then raise exception 'Give the challenge a title'; end if;
  if coalesce(length(trim(p_summary)), 0) < 3 then raise exception 'Add a one-line summary'; end if;
  if coalesce(length(trim(p_steps)), 0) < 3 then raise exception 'Say what the class has to do'; end if;
  if p_points is null or p_points <= 0 or p_points > 50 then raise exception 'Points must be more than 0 and at most 50'; end if;
  if p_kind not in ('instant', 'review') then raise exception 'Pick how it''s checked'; end if;
  if p_repeat not in ('day', 'week', 'month', 'once') then raise exception 'Pick how often it can be done'; end if;
  if p_id is null then
    insert into public.eco_challenges (school_id, code, title, summary, steps, place, points, kind, repeat_every, active)
    values (me.school_id, 'c_' || substr(md5(gen_random_uuid()::text), 1, 8), trim(p_title), trim(p_summary), trim(p_steps),
            nullif(trim(coalesce(p_place, '')), ''), p_points, p_kind, p_repeat, coalesce(p_active, true))
    returning id into v_id;
  else
    update public.eco_challenges
       set title = trim(p_title), summary = trim(p_summary), steps = trim(p_steps), place = nullif(trim(coalesce(p_place, '')), ''),
           points = p_points, kind = p_kind, repeat_every = p_repeat, active = coalesce(p_active, active)
     where id = p_id and school_id = me.school_id
    returning id into v_id;
    if v_id is null then raise exception 'Challenge not found'; end if;
  end if;
  perform app.log(me.school_id, me.id, 'challenge.save', 'eco_challenge', v_id::text, jsonb_build_object('title', trim(p_title)));
  return v_id;
end $$;

create function public.teacher_challenge_claims(p_from date, p_to date) returns table (
  id uuid, claim_date date, class_name text, challenge_title text, kind text, status text, answer text,
  points numeric, submitted_at timestamptz, reviewed_by_name text, review_note text)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  return query
    select x.id, x.claim_date, c.name, ch.title, ch.kind, x.status, x.answer, x.points, x.submitted_at, p.display_name, x.review_note
      from public.challenge_claims x
      join public.classes c on c.id = x.class_id
      join public.eco_challenges ch on ch.id = x.challenge_id
      left join public.profiles p on p.id = x.reviewed_by
     where x.school_id = me.school_id and (x.status = 'pending' or x.claim_date between p_from and p_to)
     order by (x.status = 'pending') desc, x.submitted_at desc;
end $$;

create function public.review_challenge_claim(p_claim uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_x public.challenge_claims; v_title text; v_note text;
begin
  me := app.require_teacher();
  select * into v_x from public.challenge_claims where id = p_claim and school_id = me.school_id for update;
  if v_x.id is null then raise exception 'Claim not found'; end if;
  if v_x.status <> 'pending' then raise exception 'This claim has already been reviewed'; end if;
  v_note := nullif(left(trim(coalesce(p_note, '')), 300), '');
  if not p_approve and v_note is null then raise exception 'Say why, so the class can try again'; end if;
  select title into v_title from public.eco_challenges where id = v_x.challenge_id;
  update public.challenge_claims
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = me.id, reviewed_at = now(), review_note = v_note
   where id = v_x.id;
  if p_approve then
    insert into public.points_ledger (school_id, class_id, points_date, source, challenge_claim_id, points, reason, created_by)
    values (v_x.school_id, v_x.class_id, v_x.claim_date, 'challenge', v_x.id, v_x.points, v_title, me.id);
  end if;
  perform app.log(me.school_id, me.id, case when p_approve then 'challenge.approve' else 'challenge.reject' end,
    'challenge_claim', v_x.id::text, jsonb_build_object('challenge', v_title, 'note', v_note));
end $$;

create function public.void_challenge_claim(p_claim uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_x public.challenge_claims; v_reason text;
begin
  me := app.require_teacher();
  select * into v_x from public.challenge_claims where id = p_claim and school_id = me.school_id for update;
  if v_x.id is null then raise exception 'Claim not found'; end if;
  if v_x.status <> 'approved' then raise exception 'Only an approved claim can be voided'; end if;
  v_reason := app.require_reason(p_reason);
  update public.challenge_claims set status = 'voided', review_note = v_reason, reviewed_by = me.id, reviewed_at = now()
   where id = v_x.id;
  insert into public.points_ledger (school_id, class_id, points_date, source, challenge_claim_id, reverses_id, points, reason, created_by)
  select l.school_id, l.class_id, l.points_date, 'reversal', l.challenge_claim_id, l.id, -l.points, v_reason, me.id
    from public.points_ledger l where l.challenge_claim_id = v_x.id and l.source = 'challenge';
  perform app.log(me.school_id, me.id, 'challenge.void', 'challenge_claim', v_x.id::text, jsonb_build_object('reason', v_reason));
end $$;

-- -------------------------------------------------- teacher: badges, gardens ----

create function public.teacher_gardens() returns table (
  class_id uuid, class_name text, earned numeric, spent numeric, available numeric, plants bigint, grown bigint)
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  return query
    select c.id, c.name, round(b.earned, 2), b.spent, round(b.available, 2),
           (select count(*) from public.garden_plants p where p.class_id = c.id),
           (select count(*) from public.garden_plants p where p.class_id = c.id and p.stage = 3)
      from public.classes c, lateral app.garden_balance(c.id) b
     where c.school_id = me.school_id
     order by c.grade, c.section;
end $$;

create function public.teacher_rewards_config() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_teacher();
  return jsonb_build_object(
    'tiers', (select coalesce(jsonb_agg(jsonb_build_object('code', t.code, 'name', t.name, 'tagline', t.tagline,
                'threshold', t.threshold, 'reward_name', gi.name) order by t.sort), '[]'::jsonb)
                from public.badge_tiers t left join public.garden_items gi on gi.school_id = t.school_id and gi.code = t.reward_item
               where t.school_id = me.school_id),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('code', i.code, 'name', i.name, 'kind', i.kind, 'cost', i.cost,
                'active', i.active) order by i.sort), '[]'::jsonb)
                from public.garden_items i where i.school_id = me.school_id));
end $$;

create function public.update_badge_tier(p_code text, p_threshold int) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_t public.badge_tiers; v_below int; v_above int;
begin
  me := app.require_teacher();
  select * into v_t from public.badge_tiers where school_id = me.school_id and code = p_code for update;
  if v_t.code is null then raise exception 'Badge not found'; end if;
  if p_threshold is null or p_threshold < 1 or p_threshold > 100000 then raise exception 'Points must be between 1 and 100,000'; end if;
  select max(threshold) into v_below from public.badge_tiers where school_id = me.school_id and sort < v_t.sort;
  select min(threshold) into v_above from public.badge_tiers where school_id = me.school_id and sort > v_t.sort;
  if p_threshold <= coalesce(v_below, 0) or p_threshold >= coalesce(v_above, 100001) then
    raise exception 'Keep the badges in order: % must be more than % and less than %', v_t.name, coalesce(v_below, 0), coalesce(v_above, 100001);
  end if;
  update public.badge_tiers set threshold = p_threshold where school_id = me.school_id and code = p_code;
  perform app.log(me.school_id, me.id, 'badge.update', 'badge_tier', p_code, jsonb_build_object('threshold', p_threshold));
end $$;

create function public.update_garden_item(p_code text, p_cost int, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_i public.garden_items;
begin
  me := app.require_teacher();
  select * into v_i from public.garden_items where school_id = me.school_id and code = p_code for update;
  if v_i.code is null then raise exception 'Item not found'; end if;
  if v_i.cost is null then raise exception '% is won with a badge, so it has no price', v_i.name; end if;
  if p_cost is null or p_cost < 1 or p_cost > 100000 then raise exception 'Price must be between 1 and 100,000 points'; end if;
  update public.garden_items set cost = p_cost, active = coalesce(p_active, active) where school_id = me.school_id and code = p_code;
  perform app.log(me.school_id, me.id, 'garden.price', 'garden_item', p_code, jsonb_build_object('cost', p_cost, 'active', p_active));
end $$;

-- ------------------------------------------------------- public (aggregates) ----

create function public.get_badges(p_slug text, p_month date) returns table (
  class_id uuid, class_name text, grade smallint, points numeric, tier_code text, tier_name text,
  next_code text, next_name text, next_threshold int)
language sql stable security definer set search_path = '' as $$
  with s as (select id from public.schools where slug = p_slug),
  m as (select date_trunc('month', p_month)::date as m0),
  pts as (
    select c.id, c.name, c.grade, c.section,
           coalesce((select sum(l.points) from public.points_ledger l, m
                      where l.class_id = c.id and l.points_date >= m.m0 and l.points_date < (m.m0 + interval '1 month')::date), 0) as p
      from public.classes c, s where c.school_id = s.id and c.active)
  select pts.id, pts.name, pts.grade, round(pts.p, 2),
         got.code, got.name, nxt.code, nxt.name, nxt.threshold
    from pts
    left join lateral (select t.code, t.name from public.badge_tiers t, s
                        where t.school_id = s.id and t.threshold <= pts.p order by t.threshold desc limit 1) got on true
    left join lateral (select t.code, t.name, t.threshold from public.badge_tiers t, s
                        where t.school_id = s.id and t.threshold > pts.p order by t.threshold limit 1) nxt on true
   order by pts.p desc, pts.grade, pts.section
$$;

create function public.get_badge_tiers(p_slug text) returns table (
  code text, name text, tagline text, threshold int, sort smallint, reward_name text)
language sql stable security definer set search_path = '' as $$
  select t.code, t.name, t.tagline, t.threshold, t.sort, gi.name
    from public.badge_tiers t
    join public.schools s on s.id = t.school_id and s.slug = p_slug
    left join public.garden_items gi on gi.school_id = t.school_id and gi.code = t.reward_item
   order by t.sort
$$;

create function public.get_gardens(p_slug text) returns table (class_id uuid, class_name text, item_code text, plot smallint, stage smallint)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, p.item_code, p.plot, p.stage
    from public.garden_plants p
    join public.classes c on c.id = p.class_id
    join public.schools s on s.id = p.school_id and s.slug = p_slug
   where p.plot is not null and c.active
   order by c.grade, c.section, p.plot
$$;

-- ---------------------------------------------------------------- grants ----
revoke all on function
  app.garden_plant_guard(), app.challenge_claim_guard(), app.seed_rewards(uuid), app.garden_balance(uuid),
  app.free_plot(uuid), app.month_points(uuid, date), app.class_badges(uuid, date), app.grant_badge_rewards(uuid, uuid),
  app.period_start(text, date),
  public.my_garden(), public.garden_buy(text), public.garden_water(uuid), public.garden_move(uuid, int),
  public.my_challenges(), public.claim_challenge(text, text),
  public.teacher_challenges(), public.upsert_eco_challenge(uuid, text, text, text, text, numeric, text, text, boolean),
  public.teacher_challenge_claims(date, date), public.review_challenge_claim(uuid, boolean, text),
  public.void_challenge_claim(uuid, text), public.teacher_gardens(), public.teacher_rewards_config(),
  public.update_badge_tier(text, int), public.update_garden_item(text, int, boolean),
  public.get_badges(text, date), public.get_badge_tiers(text), public.get_gardens(text)
from public, anon, authenticated;

grant execute on function public.get_badges(text, date), public.get_badge_tiers(text), public.get_gardens(text)
to anon, authenticated;

grant execute on function
  public.my_garden(), public.garden_buy(text), public.garden_water(uuid), public.garden_move(uuid, int),
  public.my_challenges(), public.claim_challenge(text, text),
  public.teacher_challenges(), public.upsert_eco_challenge(uuid, text, text, text, text, numeric, text, text, boolean),
  public.teacher_challenge_claims(date, date), public.review_challenge_claim(uuid, boolean, text),
  public.void_challenge_claim(uuid, text), public.teacher_gardens(), public.teacher_rewards_config(),
  public.update_badge_tier(text, int), public.update_garden_item(text, int, boolean)
to authenticated;
