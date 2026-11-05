-- =============================================================================
-- EcoPoints: DEMO DATA (fake). About one month of history so every screen has
-- something to show: leaderboard, podium, corridor screen, trend chart, impact
-- report with before/after, AI checks & flags, bonuses.
--
-- Run in: Supabase SQL editor, project Eco-Point. Run AFTER the two migrations
-- and seed.sql, and after at least one teacher exists (scripts/create-teacher.mjs).
--
-- What it creates (school days only, Mon to Fri):
--   * From the 1st of LAST month up to YESTERDAY. Today is left empty so you can
--     submit a class check live during a demo.
--   * The first school week is a measuring week (no points), so the impact report
--     shows "Before and after". This sets the school's points start date.
--   * A daily class check for every active class, a peer check on the app's real
--     rotation, an AI bin check (if the AI migration is installed), 4 teacher
--     bonuses, and 2 unreviewed AI flags in the last few days.
--   * Classes improve over time, each at its own pace, so the table isn't a tie.
--   * If the rewards migration is installed: eco challenges done through the
--     month (2 write-ups waiting for review) and a garden for every class
--     (bought with leaves if the leaves migration is installed).
--
-- Safe to run twice: any class/day that already has a record is skipped.
-- Closed months are skipped (their points are locked).
-- Remove it all before the real pilot with supabase/seed-demo-month-undo.sql.
-- =============================================================================
do $$
declare
  v_school   public.schools;
  v_teacher  uuid;
  v_start    date;
  v_pstart   date;
  v_end      date;
  v_has_ai   boolean := to_regclass('public.ai_checks') is not null;
  v_pf       uuid;
  d date; c record; a record;
  v_base boolean; v_day int; v_skill numeric; v_pace numeric;
  v_by uuid; v_entry uuid; v_audit uuid; v_target uuid; v_ai uuid;
  v_present int; v_val int; v_rate numeric; v_pts numeric; v_pf_val int;
  v_items int; v_wrong int; v_flag boolean; v_reason text; v_json jsonb;
  v_entries int := 0; v_audits int := 0; v_ai_n int := 0; v_bonus_n int := 0;
  v_flag_days date[];
begin
  select * into v_school from public.schools where slug = 'school';
  if v_school.id is null then
    raise exception 'School "school" not found. Run supabase/seed.sql first.';
  end if;
  select id into v_teacher from public.profiles
   where school_id = v_school.id and role = 'teacher' order by created_at limit 1;
  if v_teacher is null then
    raise exception 'No teacher yet. Create one with: node scripts/create-teacher.mjs';
  end if;

  v_end    := (now() at time zone v_school.timezone)::date - 1;                       -- yesterday
  v_start  := (date_trunc('month', v_end - interval '1 month'))::date;                -- 1st of last month
  v_pstart := v_start + 7 + ((8 - extract(isodow from v_start + 7)::int) % 7);       -- the Monday after week 1
  update public.schools set points_start_date = v_pstart where id = v_school.id;
  select id into v_pf from public.actions where school_id = v_school.id and code = 'plastic_free_lunch';

  perform setseed(0.42);

  -- the last 3 school days get the two AI flags
  select array_agg(g::date order by g desc) into v_flag_days
    from generate_series(v_end - 6, v_end, interval '1 day') g
   where extract(isodow from g) < 6;

  for d in select g::date from generate_series(v_start, v_end, interval '1 day') g loop
    continue when extract(isodow from d) in (6, 7);
    continue when exists (select 1 from public.month_closures m
                           where m.school_id = v_school.id and m.month = date_trunc('month', d)::date);
    v_base := d < v_pstart;
    v_day  := greatest(0, d - v_pstart);

    -- 1. Daily class checks
    for c in select * from public.classes where school_id = v_school.id and active order by grade, section loop
      continue when exists (select 1 from public.daily_entries
                             where class_id = c.id and entry_date = d and voided_at is null);
      select id into v_by from public.profiles where class_id = c.id and role = 'monitor' limit 1;
      v_by    := coalesce(v_by, v_teacher);
      v_skill := (abs(hashtext(c.name)) % 100) / 100.0 * 0.20;          -- each class's own level
      v_pace  := 0.008 + (abs(hashtext(c.name || 'p')) % 100) / 100.0 * 0.012;  -- and its own pace
      v_present := greatest(1, c.strength - (random() * 4)::int);
      v_pf_val := null;

      insert into public.daily_entries (school_id, class_id, entry_date, present, is_baseline, submitted_by, submitted_at)
      values (v_school.id, c.id, d, v_present, v_base, v_by,
              (d + time '08:30' + (random() * interval '50 minutes')) at time zone v_school.timezone)
      returning id into v_entry;
      v_entries := v_entries + 1;

      for a in select * from public.actions
                where school_id = v_school.id and active and entered_by = 'self' order by sort_order, code loop
        v_rate := case when v_base then 0.30 + random() * 0.15
                       else 0.52 + v_day * v_pace + random() * 0.10 end + v_skill;
        if a.input_type = 'count' then
          v_val := least(v_present, greatest(0, round(v_present * least(0.98, v_rate))))::int;
          v_pts := round(a.max_points * v_val / v_present, 2);
        else
          v_val := (random() < least(0.95, v_rate))::int;
          v_pts := a.max_points * v_val;
        end if;
        if a.id = v_pf then v_pf_val := v_val; end if;
        insert into public.entry_values (entry_id, action_id, value) values (v_entry, a.id, v_val);
        if not v_base and v_pts <> 0 then
          insert into public.points_ledger (school_id, class_id, points_date, source, action_id, entry_id, points, created_by)
          values (v_school.id, c.id, d, 'daily', a.id, v_entry, v_pts, v_by);
        end if;
      end loop;

      -- 2. AI bin check (after lunch), only if the AI migration is installed and AI is on
      if v_has_ai and coalesce((to_jsonb(v_school) ->> 'ai_enabled')::boolean, false) then
        v_items := greatest(0, round((v_present - coalesce(v_pf_val, v_present / 2)) * (0.8 + random() * 0.7)))::int;
        v_wrong := (random() * 3)::int;
        v_flag := false; v_reason := null;
        if v_pf_val is not null and c.grade = (select min(grade) from public.classes where school_id = v_school.id and active)
           and d = any(v_flag_days[1:2]) and c.section = (case when d = v_flag_days[1] then 'A' else 'D' end) then
          -- two deliberate mismatches for the demo: class claimed plastic-free, bin says otherwise
          v_items := 3 * (v_present - v_pf_val) + 3 + 4 + (random() * 3)::int;
        end if;
        if v_pf_val is not null and v_items > 3 * (v_present - v_pf_val) + 3 then
          v_flag := true;
          v_reason := format('Class said %s of %s lunches were plastic-free, but the AI counted %s plastic items in the bin.',
                             v_pf_val, v_present, v_items);
        end if;
        v_pts := case when v_base then 0
                      else round(coalesce((to_jsonb(v_school) ->> 'ai_bin_max_points')::numeric, 10)
                                 * greatest(0, 1 - v_items::numeric
                                    / (v_present * coalesce((to_jsonb(v_school) ->> 'ai_bin_zero_at')::numeric, 0.5))), 2) end;
        select coalesce(jsonb_agg(jsonb_build_object('label', lbl, 'kind', knd)), '[]'::jsonb) into v_json from (
          select (array['wrapper','crisp packet','plastic bottle','straw','yoghurt pot','cling film','plastic cutlery'])[1 + (random() * 6)::int] lbl, 'plastic' knd
            from generate_series(1, least(v_items, 60))
          union all
          select (array['banana peel','paper cup','apple core'])[1 + (random() * 2)::int], 'wrong_bin' from generate_series(1, v_wrong)
        ) x;
        if not exists (select 1 from public.ai_checks
                        where class_id = c.id and check_type = 'bin' and check_date = d and voided_at is null) then
          insert into public.ai_checks (school_id, class_id, check_type, check_date, checked_by_class_id, submitted_by, provider, model,
                                        plastic_items, wrong_bin_items, confidence, items, summary, present_used, points,
                                        is_baseline, flagged, flag_reason, created_at)
          values (v_school.id, c.id, 'bin', d, c.id, v_by, 'gemini', 'gemini-3.5-flash-lite',
                  v_items, v_wrong, round((0.78 + random() * 0.17)::numeric, 2), v_json,
                  case when v_items <= 2 then 'The bin is almost free of plastic.'
                       when v_items <= 8 then format('%s plastic items, mostly snack wrappers.', v_items)
                       else format('%s plastic items: lots of wrappers and a few bottles.', v_items) end,
                  v_present, v_pts, v_base, v_flag, v_reason,
                  (d + time '13:15' + (random() * interval '30 minutes')) at time zone v_school.timezone)
          returning id into v_ai;
          v_ai_n := v_ai_n + 1;
          if v_pts > 0 then
            insert into public.points_ledger (school_id, class_id, points_date, source, ai_check_id, points, created_by)
            values (v_school.id, c.id, d, 'ai', v_ai, v_pts, v_by);
          end if;
        end if;
      end if;
    end loop;

    -- 3. Peer checks, on the app's real rotation
    for c in select * from public.classes where school_id = v_school.id and active order by grade, section loop
      v_target := app.audit_target(c.id, d);
      continue when v_target is null;
      continue when exists (select 1 from public.peer_audits
                             where target_class_id = v_target and audit_date = d and voided_at is null);
      select id into v_by from public.profiles where class_id = c.id and role = 'monitor' limit 1;
      v_by := coalesce(v_by, v_teacher);
      insert into public.peer_audits (school_id, target_class_id, auditor_class_id, audit_date, is_baseline, submitted_by, submitted_at)
      values (v_school.id, v_target, c.id, d, v_base, v_by,
              (d + time '12:00' + (random() * interval '40 minutes')) at time zone v_school.timezone)
      returning id into v_audit;
      v_audits := v_audits + 1;
      for a in select * from public.actions
                where school_id = v_school.id and active and entered_by = 'peer' order by sort_order, code loop
        v_val := (random() < case when v_base then 0.50 else least(0.95, 0.72 + v_day * 0.008) end)::int;
        insert into public.audit_values (audit_id, action_id, value) values (v_audit, a.id, v_val);
        if not v_base and v_val = 1 then
          insert into public.points_ledger (school_id, class_id, points_date, source, action_id, audit_id, points, created_by)
          values (v_school.id, v_target, d, 'audit', a.id, v_audit, a.max_points, v_by);
        end if;
      end loop;
    end loop;
  end loop;

  -- 4. Four teacher bonuses on scored days
  for a in
    select x.n, x.reason, x.pts,
           (select id from public.classes where school_id = v_school.id and active order by grade, section offset x.n limit 1) as class_id,
           (select g::date from generate_series(v_pstart, v_end, interval '1 day') g
             where extract(isodow from g) < 6 order by g offset x.day_n limit 1) as on_day
      from (values (0, 1, 'Eco drive: collected 120 plastic bottles for recycling', 10),
                   (3, 4, 'Paper-free week in class', 5),
                   (5, 8, 'Campus clean-up after sports day', 8),
                   (6, 12, 'Best eco poster at assembly', 5)) x(n, day_n, reason, pts)
  loop
    continue when a.class_id is null or a.on_day is null;
    continue when exists (select 1 from public.month_closures m
                           where m.school_id = v_school.id and m.month = date_trunc('month', a.on_day)::date);
    continue when exists (select 1 from public.points_ledger
                           where class_id = a.class_id and source = 'bonus' and reason = a.reason);
    insert into public.points_ledger (school_id, class_id, points_date, source, points, reason, created_by)
    values (v_school.id, a.class_id, a.on_day, 'bonus', a.pts, a.reason, v_teacher);
    v_bonus_n := v_bonus_n + 1;
  end loop;

  raise notice 'Demo data added for % to %: % class checks, % peer checks, % AI bin checks, % bonuses. Points start %.',
    v_start, v_end, v_entries, v_audits, v_ai_n, v_bonus_n, v_pstart;
end $$;

-- -----------------------------------------------------------------------------
-- Rewards demo (only if migration 20261105000000_rewards.sql is installed):
-- eco challenges done through the month, 2 write-ups waiting for review, and
-- each class's garden with its badge rewards and a few plants at different stages.
-- -----------------------------------------------------------------------------
do $$
declare
  v_school public.schools; v_teacher uuid; v_end date; v_today date; c record; d date; v_by uuid;
  v_ch public.eco_challenges; v_claim uuid; v_n int := 0; v_g int := 0; v_item record; v_avail numeric;
  v_plot smallint; v_days int; v_stage int; v_id uuid; v_answer text;
  v_leaves boolean := to_regclass('public.leaf_grants') is not null;   -- leaves migration installed: shop prices are in leaves
  v_answers jsonb := jsonb_build_object(
    'mystery_waste_audit', 'We sorted one classroom bin: 14 snack wrappers, 6 juice boxes and a lot of paper that could have been recycled. Idea: bring snacks in reusable tubs.',
    'no_new_buy_day', 'Nobody bought anything new today. We borrowed rulers and glue from another class and fixed a wobbly chair instead of replacing it.',
    'digital_declutter', 'We deleted about 300 old photos and 2 GB of duplicate files from the class computer, then emptied the bin.',
    'water_watcher', 'We checked 12 taps. Two in the ground-floor washroom were dripping, so we told the caretaker.',
    'one_item_five_uses', 'A glass jar: pencil holder, mini plant pot, coin bank, a lamp with fairy lights, and a jar for sorting paper clips.',
    'lunch_waste_tracker', 'About a third of the rice and bread was thrown away because portions were too big. Ideas: smaller first portions and a share table.',
    'eco_interview', 'A teacher told us they carry a cloth bag everywhere so they never need plastic bags. They have done it for five years.',
    'packaging_detective', 'We compared two juice packs: one big carton uses one box instead of six small ones with straws, so much less packaging.');
begin
  if to_regclass('public.garden_plants') is null then
    raise notice 'Rewards migration not installed: skipped gardens and challenges.';
    return;
  end if;
  select * into v_school from public.schools where slug = 'school';
  select id into v_teacher from public.profiles where school_id = v_school.id and role = 'teacher' order by created_at limit 1;
  v_today := (now() at time zone v_school.timezone)::date;
  v_end := v_today - 1;
  perform setseed(0.17);

  -- Eco challenges (skipped if the school already has any)
  if not exists (select 1 from public.challenge_claims where school_id = v_school.id) then
    for c in select * from public.classes where school_id = v_school.id and active order by grade, section loop
      select id into v_by from public.profiles where class_id = c.id and role = 'monitor' limit 1;
      v_by := coalesce(v_by, v_teacher);
      -- instant QR challenges on about 4 days in 10
      for d in select g::date from generate_series(greatest(v_school.points_start_date, v_end - 40), v_end, interval '1 day') g loop
        continue when extract(isodow from d) in (6, 7) or random() > 0.4;
        continue when exists (select 1 from public.month_closures m where m.school_id = v_school.id and m.month = date_trunc('month', d)::date);
        select * into v_ch from public.eco_challenges where school_id = v_school.id and active and kind = 'instant' order by random() limit 1;
        continue when v_ch.id is null;
        v_claim := null;
        insert into public.challenge_claims (school_id, challenge_id, class_id, claim_date, period_start, status, points, submitted_by, submitted_at)
        values (v_school.id, v_ch.id, c.id, d, app.period_start(v_ch.repeat_every, d), 'approved', v_ch.points, v_by,
                (d + time '10:00' + random() * interval '4 hours') at time zone v_school.timezone)
        on conflict do nothing returning id into v_claim;
        if v_claim is not null then
          insert into public.points_ledger (school_id, class_id, points_date, source, challenge_claim_id, points, reason, created_by)
          values (v_school.id, c.id, d, 'challenge', v_claim, v_ch.points, v_ch.title, v_by);
          v_n := v_n + 1;
        end if;
      end loop;
      -- two approved class projects last month
      for v_ch in select * from public.eco_challenges where school_id = v_school.id and active and kind = 'review'
                   order by abs(hashtext(code || c.name)) limit 2 loop
        d := (date_trunc('month', v_today) - interval '1 month')::date + 14 + (abs(hashtext(c.name || v_ch.code)) % 10);
        continue when d < v_school.points_start_date or d > v_end;
        continue when exists (select 1 from public.month_closures m where m.school_id = v_school.id and m.month = date_trunc('month', d)::date);
        v_claim := null;
        insert into public.challenge_claims (school_id, challenge_id, class_id, claim_date, period_start, status, answer, points,
                                             submitted_by, submitted_at, reviewed_by, reviewed_at, review_note)
        values (v_school.id, v_ch.id, c.id, d, app.period_start(v_ch.repeat_every, d), 'approved', v_answers ->> v_ch.code, v_ch.points,
                v_by, (d + time '14:00') at time zone v_school.timezone, v_teacher, (d + 1 + time '09:00') at time zone v_school.timezone, 'Well done')
        on conflict do nothing returning id into v_claim;
        if v_claim is not null then
          insert into public.points_ledger (school_id, class_id, points_date, source, challenge_claim_id, points, reason, created_by)
          values (v_school.id, c.id, d, 'challenge', v_claim, v_ch.points, v_ch.title, v_teacher);
          v_n := v_n + 1;
        end if;
      end loop;
    end loop;
    -- two write-ups waiting for the teacher this week
    for c in select cl.*, ch.code from public.classes cl
               cross join lateral (select code from (values ('water_watcher'), ('lunch_waste_tracker')) v(code)
                                    order by abs(hashtext(cl.name || v.code)) limit 1) ch
              where cl.school_id = v_school.id and cl.active order by cl.grade, cl.section offset 1 limit 2 loop
      select * into v_ch from public.eco_challenges where school_id = v_school.id and code = c.code;
      select id into v_by from public.profiles where class_id = c.id and role = 'monitor' limit 1;
      insert into public.challenge_claims (school_id, challenge_id, class_id, claim_date, period_start, status, answer, points, submitted_by)
      values (v_school.id, v_ch.id, c.id, v_end, app.period_start(v_ch.repeat_every, v_end), 'pending', v_answers ->> v_ch.code, v_ch.points,
              coalesce(v_by, v_teacher))
      on conflict do nothing;
    end loop;
  end if;

  -- Gardens (skipped for classes that already have one)
  for c in select * from public.classes where school_id = v_school.id and active order by grade, section loop
    continue when exists (select 1 from public.garden_plants where class_id = c.id);
    select id into v_by from public.profiles where class_id = c.id and role = 'monitor' limit 1;
    v_by := coalesce(v_by, v_teacher);
    perform 1 from public.classes where id = c.id for update;
    perform app.grant_badge_rewards(c.id, v_by);
    if v_leaves then perform app.grant_badge_leaves(c.id); end if;
    select available into v_avail from app.garden_balance(c.id);
    if v_leaves then v_avail := floor(v_avail * 0.7); end if;          -- keep about 100 leaves to buy something live in a demo
    for v_item in select gi.*, n from public.garden_items gi
                   cross join generate_series(1, 2) n
                   where gi.school_id = v_school.id and gi.active and gi.cost is not null
                     and gi.code in ('marigold','sunflower','seedling','bush','bench','butterfly','bulbul','neem')
                     and (n = 1 or gi.cost <= case when v_leaves then 40 else 150 end)   -- a second flower now and then
                   order by n, abs(hashtext(gi.code || c.name)) loop
      continue when v_item.cost > v_avail * 0.95;
      v_plot := app.free_plot(c.id);
      exit when v_plot is null;
      v_days := 4 + (abs(hashtext(c.name || v_item.code || v_item.n)) % 12);   -- planted 4–15 days ago
      v_stage := case when v_item.grows then least(3, v_days / 3) else 3 end;
      insert into public.garden_plants (school_id, class_id, item_code, plot, stage, waterings, last_watered, source, cost, planted_on, created_by)
      values (v_school.id, c.id, v_item.code, v_plot, v_stage, case when v_item.grows then v_stage else 0 end,
              case when v_item.grows and v_stage > 0 then v_end - 1 end, 'bought', v_item.cost, v_end - v_days, v_by)
      returning id into v_id;
      insert into public.garden_events (school_id, class_id, plant_id, kind, detail, event_date, actor_id, at)
      values (v_school.id, c.id, v_id, 'bought',
              format('%s %s for %s %s', case when v_item.grows then 'Planted a' else 'Added a' end, v_item.name, v_item.cost,
                     case when v_leaves then 'leaves' else 'points' end),
              v_end - v_days, v_by, (v_end - v_days + time '13:30') at time zone v_school.timezone);
      if v_stage = 3 and v_item.grows then
        insert into public.garden_events (school_id, class_id, plant_id, kind, detail, event_date, actor_id, at)
        values (v_school.id, c.id, v_id, 'grew', format('%s grew into a fully grown plant', v_item.name), v_end - 1, v_by,
                (v_end - 1 + time '13:40') at time zone v_school.timezone);
      end if;
      v_avail := v_avail - v_item.cost;
      v_g := v_g + 1;
    end loop;
  end loop;
  raise notice 'Rewards demo: % eco challenges done, % garden items bought (plus badge rewards).', v_n, v_g;
end $$;

-- What you should see: one row per class with points.
select c.name as class, sum(l.points) as points, count(distinct l.points_date) as days
  from public.points_ledger l join public.classes c on c.id = l.class_id
 group by c.name order by points desc;
