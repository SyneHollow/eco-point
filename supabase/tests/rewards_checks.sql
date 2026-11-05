-- =============================================================================
-- EcoPoints rewards checks (badges, gardens, leaves, QR eco-challenges). Safe on
-- a live project: runs inside one transaction against two throw-away test
-- schools and is ROLLED BACK at the end.
--
-- Needs migrations 20261105000000_rewards.sql AND 20261105100000_leaves.sql.
--
-- Run: Supabase dashboard → SQL Editor → paste this whole file → Run.
-- Pass  = the last result reads "ALL REWARDS CHECKS PASSED".
-- Fail  = the run stops with an error starting "CHECK FAILED: ...".
-- =============================================================================
begin;

do $$ begin
  if to_regclass('public.leaf_grants') is null then
    raise exception 'CHECK FAILED: run supabase/migrations/20261105100000_leaves.sql first';
  end if;
end $$;

-- ---------------------------------------------------------------- setup ----
insert into public.schools (id, slug, name) values
  ('5d000000-0000-4000-8000-00000000000a', 'zz-test-r', 'Rewards School R'),
  ('5d000000-0000-4000-8000-00000000000b', 'zz-test-s', 'Rewards School S');
insert into public.classes (school_id, grade, section, strength) values
  ('5d000000-0000-4000-8000-00000000000a', 7, 'A', 30),
  ('5d000000-0000-4000-8000-00000000000a', 7, 'B', 30),
  ('5d000000-0000-4000-8000-00000000000b', 7, 'A', 30);
select app.seed_leaves(id) from public.schools where slug in ('zz-test-r', 'zz-test-s');

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'zz-r-teacher@test.invalid'),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'zz-r-7a@test.invalid'),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'zz-r-7b@test.invalid'),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'zz-s-teacher@test.invalid'),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'zz-s-7a@test.invalid');
insert into public.profiles (id, school_id, role, class_id, display_name)
select u.id, u.s, u.role, c.id, u.dn
  from (values ('c0000000-0000-4000-8000-000000000001'::uuid, '5d000000-0000-4000-8000-00000000000a'::uuid, 'teacher', null, 'Teacher R'),
               ('c0000000-0000-4000-8000-000000000002'::uuid, '5d000000-0000-4000-8000-00000000000a'::uuid, 'monitor', '7A', 'R 7A'),
               ('c0000000-0000-4000-8000-000000000003'::uuid, '5d000000-0000-4000-8000-00000000000a'::uuid, 'monitor', '7B', 'R 7B'),
               ('c0000000-0000-4000-8000-000000000004'::uuid, '5d000000-0000-4000-8000-00000000000b'::uuid, 'teacher', null, 'Teacher S'),
               ('c0000000-0000-4000-8000-000000000005'::uuid, '5d000000-0000-4000-8000-00000000000b'::uuid, 'monitor', '7A', 'S 7A')) u(id, s, role, cname, dn)
  left join public.classes c on c.school_id = u.s and c.name = u.cname;

-- 7A has 300 points this month, 7B has 5,000.
insert into public.points_ledger (school_id, class_id, points_date, source, points, reason, created_by)
select c.school_id, c.id, app.school_today(c.school_id), 'bonus', x.pts, 'Test points', 'c0000000-0000-4000-8000-000000000001'
  from (values ('7A', 300), ('7B', 5000)) x(cname, pts)
  join public.classes c on c.school_id = '5d000000-0000-4000-8000-00000000000a' and c.name = x.cname;

-- Both start with 100 leaves from the teacher (badges add more on first garden visit).
insert into public.leaf_grants (school_id, class_id, kind, leaves, reason, created_by)
select c.school_id, c.id, 'teacher', 100, 'Test leaves', 'c0000000-0000-4000-8000-000000000001'
  from public.classes c where c.school_id = '5d000000-0000-4000-8000-00000000000a';

select set_config('ecotest.token_recycle', (select token from public.eco_challenges
  where school_id = '5d000000-0000-4000-8000-00000000000a' and code = 'recycle_right'), true);
select set_config('ecotest.token_audit', (select token from public.eco_challenges
  where school_id = '5d000000-0000-4000-8000-00000000000a' and code = 'mystery_waste_audit'), true);

-- Test helper (dropped by the rollback): a plant's plot, read through the monitor's own garden view.
create function pg_temp.app_test_plot(p uuid) returns int language sql as $$
  select (x ->> 'plot')::int from jsonb_array_elements(public.my_garden() -> 'plants') x where (x ->> 'id')::uuid = p $$;
grant execute on function pg_temp.app_test_plot(uuid) to authenticated;

-- ------------------------------------------------------ 1. anonymous visitor ----
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ declare b record; begin
  if (select count(*) from public.get_badge_tiers('zz-test-r')) <> 6 then raise exception 'CHECK FAILED: 6 badge tiers expected'; end if;
  select * into b from public.get_badges('zz-test-r', current_date) where class_name = '7A';
  if b.tier_code <> 'green_keeper' or b.next_code <> 'aqua_guardian' or b.next_threshold <> 350 then
    raise exception 'CHECK FAILED: 7A with 300 points should be Green Keeper, next Aqua Guardian at 350 (got %, %)', b.tier_code, b.next_code;
  end if;
  begin perform public.my_leaves(); raise exception 'CHECK FAILED: anonymous visitor could read leaves';
  exception when insufficient_privilege then null; end;
  begin perform public.my_garden();
  exception when insufficient_privilege then
    begin perform 1 from public.garden_plants limit 1;
    exception when insufficient_privilege then return; end;
    raise exception 'CHECK FAILED: anonymous visitor could read garden_plants';
  end;
  raise exception 'CHECK FAILED: anonymous visitor could open a garden';
end $$;
reset role;

-- ------------------------------------------------------------ 2. 7A garden ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ declare g jsonb; r jsonb; v_bush uuid; v_seed uuid; v_fly uuid; v_plot int; begin
  -- the header counts badge leaves before they're handed out, without handing them out
  if (public.my_leaves() ->> 'available')::int <> 125 then raise exception 'CHECK FAILED: header should already count badge leaves (125)'; end if;
  g := public.my_garden();
  -- 100 from the teacher + Tiny Sprout 10 + Green Keeper 15. The 300 points are NOT spendable.
  if (g ->> 'available')::int <> 125 then raise exception 'CHECK FAILED: 7A should have 125 leaves, got %', g ->> 'available'; end if;
  if jsonb_array_length(g -> 'new_leaves') <> 2 or (g -> 'sources' ->> 'badges')::int <> 25 then
    raise exception 'CHECK FAILED: Tiny Sprout + Green Keeper should give 10 + 15 leaves: %', g -> 'new_leaves';
  end if;
  if jsonb_array_length(g -> 'new_rewards') <> 2 or jsonb_array_length(g -> 'plants') <> 2 then
    raise exception 'CHECK FAILED: Tiny Sprout + Green Keeper should give 2 reward plants: %', g -> 'new_rewards';
  end if;
  g := public.my_garden();
  if jsonb_array_length(g -> 'new_rewards') <> 0 or jsonb_array_length(g -> 'new_leaves') <> 0 or (g ->> 'available')::int <> 125 then
    raise exception 'CHECK FAILED: badge rewards or leaves were given twice';
  end if;
  if (g -> 'rates' ->> 'class_check')::int <> 5 or (g -> 'items' -> 0 ->> 'cost')::int <> 15 then
    raise exception 'CHECK FAILED: default leaf rates and prices expected: %', g -> 'rates';
  end if;

  begin perform public.garden_buy('ghaf');
  exception when others then
    if sqlerrm not like 'Not enough leaves: you need 125 more for a Ghaf tree%' then raise exception 'CHECK FAILED: wrong overspend message: %', sqlerrm; end if;
  end;
  if exists (select 1 from jsonb_array_elements(public.my_garden() -> 'plants') x where x ->> 'item' = 'ghaf') then
    raise exception 'CHECK FAILED: bought a Ghaf without enough leaves';
  end if;
  begin perform public.garden_buy('lotus_pond'); raise exception 'CHECK FAILED: bought a badge-only item';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;

  r := public.garden_buy('bush');      v_bush := (r ->> 'id')::uuid;
  if (r ->> 'available')::int <> 65 then raise exception 'CHECK FAILED: 125 - 60 should leave 65 leaves'; end if;
  r := public.garden_buy('seedling');  v_seed := (r ->> 'id')::uuid;
  begin perform public.garden_buy('neem'); raise exception 'CHECK FAILED: spent more leaves than the class has';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  if (public.my_leaves() ->> 'available')::int <> 50 then raise exception 'CHECK FAILED: header should show 50 leaves'; end if;

  -- spending never lowers points, the leaderboard or badges
  if (select points from public.get_leaderboard('zz-test-r', current_date - 40, current_date + 1) where class_name = '7A') <> 300 then
    raise exception 'CHECK FAILED: buying plants changed the leaderboard';
  end if;
  if (select tier_code from public.get_badges('zz-test-r', current_date) where class_name = '7A') <> 'green_keeper' then
    raise exception 'CHECK FAILED: buying plants changed the badge';
  end if;

  -- growth: one stage per day of watering
  r := public.garden_water(v_bush);
  if (r ->> 'stage')::int <> 1 or not (r ->> 'grew')::boolean then raise exception 'CHECK FAILED: watering should grow seed → sprout'; end if;
  begin perform public.garden_water(v_bush); raise exception 'CHECK FAILED: watered twice in a day';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  select (x ->> 'id')::uuid into v_fly from jsonb_array_elements(g -> 'plants') x where x ->> 'item' = 'butterfly';
  begin perform public.garden_water(v_fly); raise exception 'CHECK FAILED: watered a decoration';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;

  -- rearranging: move, then swap
  perform public.garden_move(v_bush, 17);
  v_plot := pg_temp.app_test_plot(v_seed);
  perform public.garden_move(v_seed, 17);
  if pg_temp.app_test_plot(v_seed) <> 17 or pg_temp.app_test_plot(v_bush) <> v_plot then
    raise exception 'CHECK FAILED: moving onto a planted spot should swap the two';
  end if;
  begin perform public.garden_move(v_bush, 18); raise exception 'CHECK FAILED: moved outside the garden';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  begin update public.garden_plants set stage = 3 where id = v_seed; raise exception 'CHECK FAILED: monitor edited a plant directly';
  exception when insufficient_privilege then null; end;
  if jsonb_array_length(public.my_garden() -> 'events') < 4 then raise exception 'CHECK FAILED: garden history missing'; end if;
end $$;
reset role;

-- ------------------------------------- 2b. leaves for taking part (any result) ----
-- Today 7A submits its class check (in the measuring week: no points, still leaves) and a
-- bin photo; 7B does the peer check of 7A.
do $$ declare v_r uuid := '5d000000-0000-4000-8000-00000000000a'; v_7a uuid; v_7b uuid; v_e uuid; begin
  select id into v_7a from public.classes where school_id = v_r and name = '7A';
  select id into v_7b from public.classes where school_id = v_r and name = '7B';
  insert into public.daily_entries (school_id, class_id, entry_date, present, is_baseline, submitted_by)
  values (v_r, v_7a, app.school_today(v_r), 28, true, 'c0000000-0000-4000-8000-000000000002') returning id into v_e;
  perform set_config('ecotest.entry_7a', v_e::text, false);
  insert into public.peer_audits (school_id, target_class_id, auditor_class_id, audit_date, is_baseline, submitted_by)
  values (v_r, v_7a, v_7b, app.school_today(v_r), true, 'c0000000-0000-4000-8000-000000000003');
  insert into public.ai_checks (school_id, class_id, check_type, check_date, checked_by_class_id, submitted_by, provider, model,
                                plastic_items, wrong_bin_items, confidence, is_baseline)
  values (v_r, v_7a, 'bin', app.school_today(v_r), v_7a, 'c0000000-0000-4000-8000-000000000002', 'test', 'test', 9, 2, 0.9, true);
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ declare g jsonb; begin
  g := public.my_garden();
  if (g ->> 'available')::int <> 58 or (g -> 'sources' ->> 'class_checks')::int <> 5 or (g -> 'sources' ->> 'photos')::int <> 3 then
    raise exception 'CHECK FAILED: class check (5) + bin photo (3) should take 50 to 58 leaves: % %', g ->> 'available', g -> 'sources';
  end if;
  if (select points from public.get_leaderboard('zz-test-r', current_date - 40, current_date + 1) where class_name = '7A') <> 300 then
    raise exception 'CHECK FAILED: leaves changed the points';
  end if;
  begin perform public.award_leaves(app.my_class_id(), 50, 'Giving myself leaves'); raise exception 'CHECK FAILED: a monitor gave leaves';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.leaf_grants limit 1; raise exception 'CHECK FAILED: a monitor read leaf_grants directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('ecotest.plant_7a', (select p.id::text from public.garden_plants p join public.classes c on c.id = p.class_id
  where c.school_id = '5d000000-0000-4000-8000-00000000000a' and c.name = '7A' limit 1), true);

-- ------------------------------------------- 3. 7B: full garden → the shed ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$ declare g jsonb; i int; v_last uuid; v_first uuid; begin
  g := public.my_garden();
  if jsonb_array_length(g -> 'new_rewards') <> 6 then raise exception 'CHECK FAILED: 5,000 points in a month should win all 6 badge rewards'; end if;
  -- 100 from the teacher + all six badges (140) + the peer check of 7A (3)
  if (g ->> 'available')::int <> 243 or (g -> 'sources' ->> 'peer_checks')::int <> 3 then
    raise exception 'CHECK FAILED: 7B should have 243 leaves, got % %', g ->> 'available', g -> 'sources';
  end if;
  for i in 1..12 loop perform public.garden_buy('seedling'); end loop;               -- 6 rewards + 12 = 18 plots
  v_last := (public.garden_buy('seedling') ->> 'id')::uuid;                           -- the 19th waits in the shed
  if pg_temp.app_test_plot(v_last) is not null then raise exception 'CHECK FAILED: 19th plant should wait in the shed'; end if;
  select (x ->> 'id')::uuid into v_first from jsonb_array_elements(public.my_garden() -> 'plants') x where (x ->> 'plot')::int = 0;
  perform public.garden_move(v_last, 0);
  if pg_temp.app_test_plot(v_last) <> 0 or pg_temp.app_test_plot(v_first) is not null then
    raise exception 'CHECK FAILED: moving from the shed should swap the occupant into the shed';
  end if;
  -- 7B can't touch 7A's garden
  begin perform public.garden_water(current_setting('ecotest.plant_7a')::uuid);
    raise exception 'CHECK FAILED: 7B watered 7A''s plant';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
end $$;
reset role;

-- ------------------------------------------------------ 4. 7A challenges ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ declare c jsonb; r jsonb; begin
  c := public.my_challenges();
  if jsonb_array_length(c -> 'challenges') <> 11 or not (c ->> 'open')::boolean then raise exception 'CHECK FAILED: 11 open challenges expected'; end if;
  r := public.claim_challenge(current_setting('ecotest.token_recycle'), null);
  if r ->> 'status' <> 'approved' or (r ->> 'points')::numeric <> 2 or (r ->> 'leaves')::int <> 3 then
    raise exception 'CHECK FAILED: instant challenge should give 2 points and 3 leaves now';
  end if;
  if (public.my_leaves() ->> 'available')::int <> 61 then raise exception 'CHECK FAILED: 58 + 3 should be 61 leaves'; end if;
  begin perform public.claim_challenge(current_setting('ecotest.token_recycle'), null);
    raise exception 'CHECK FAILED: did a daily challenge twice in one day';
  exception when others then
    if sqlerrm not like 'Your class has already done this challenge today%' then raise exception 'CHECK FAILED: wrong repeat message: %', sqlerrm; end if;
  end;
  begin perform public.claim_challenge(current_setting('ecotest.token_audit'), 'too short');
    raise exception 'CHECK FAILED: review challenge accepted without a write-up';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  r := public.claim_challenge(upper(current_setting('ecotest.token_audit')), 'Our bin had 14 wrappers that could have been avoided; we will bring snacks in tubs.');
  if r ->> 'status' <> 'pending' or (r ->> 'leaves')::int <> 15 then raise exception 'CHECK FAILED: review challenge should wait for the teacher'; end if;
  if (public.my_leaves() ->> 'available')::int <> 61 then raise exception 'CHECK FAILED: a write-up waiting for review gave leaves'; end if;
  begin perform public.claim_challenge('zzzzzzzzzz', null); raise exception 'CHECK FAILED: unknown QR code accepted';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
end $$;
reset role;

do $$ begin
  if (select sum(l.points) from public.points_ledger l join public.challenge_claims x on x.id = l.challenge_claim_id
       join public.classes c on c.id = x.class_id where c.school_id = '5d000000-0000-4000-8000-00000000000a') <> 2 then
    raise exception 'CHECK FAILED: only the instant challenge should have points before review';
  end if;
end $$;

-- ------------------------------------------- 5. other school can't use the code ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
do $$ begin
  begin perform public.claim_challenge(current_setting('ecotest.token_recycle'), null);
    raise exception 'CHECK FAILED: another school''s monitor used this school''s QR code';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
end $$;
reset role;

-- --------------------------------------------------------- 6. teacher R ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ declare v_pending uuid; v_instant uuid; v_7a uuid; begin
  select id into v_7a from public.classes where school_id = '5d000000-0000-4000-8000-00000000000a' and name = '7A';
  select id into v_pending from public.teacher_challenge_claims(current_date - 40, current_date + 1) where status = 'pending';
  select id into v_instant from public.teacher_challenge_claims(current_date - 40, current_date + 1) where status = 'approved';
  if v_pending is null or v_instant is null then raise exception 'CHECK FAILED: teacher should see the pending and approved claims'; end if;
  begin perform public.review_challenge_claim(v_pending, false, ''); raise exception 'CHECK FAILED: rejected without a reason';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  perform public.review_challenge_claim(v_pending, true, 'Great audit');
  begin perform public.review_challenge_claim(v_pending, true, null); raise exception 'CHECK FAILED: reviewed twice';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  perform public.void_challenge_claim(v_instant, 'Scanned without recycling');
  if (select points from public.get_leaderboard('zz-test-r', current_date - 40, current_date + 1) where class_name = '7A') <> 315 then
    raise exception 'CHECK FAILED: 300 + 15 approved + 2 instant - 2 voided should be 315';
  end if;
  if (select available from public.teacher_gardens() where class_name = '7A') <> 73 then
    raise exception 'CHECK FAILED: 61 + 15 approved - 3 voided should be 73 leaves';
  end if;

  -- giving leaves
  perform public.award_leaves(v_7a, 20, 'Eco drive');
  begin perform public.award_leaves(v_7a, 0, 'Nothing'); raise exception 'CHECK FAILED: gave 0 leaves';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  begin perform public.award_leaves(v_7a, 501, 'Too many'); raise exception 'CHECK FAILED: gave more than 500 leaves';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  begin perform public.award_leaves(v_7a, 5, ' '); raise exception 'CHECK FAILED: gave leaves without a reason';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  begin perform public.award_leaves((select id from public.classes where school_id = '5d000000-0000-4000-8000-00000000000b' limit 1), 5, 'Other school');
    raise exception 'CHECK FAILED: gave leaves to another school''s class';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  if not exists (select 1 from public.teacher_leaf_grants(5) where reason = 'Eco drive' and leaves = 20 and class_name = '7A') then
    raise exception 'CHECK FAILED: grant not listed';
  end if;
  -- voiding a class check takes its leaves away too
  perform public.void_entry(current_setting('ecotest.entry_7a')::uuid, 'Test void');
  if (select available from public.teacher_gardens() where class_name = '7A') <> 88 then
    raise exception 'CHECK FAILED: 73 + 20 given - 5 for the voided class check should be 88 leaves';
  end if;

  begin perform public.update_badge_tier('aqua_guardian', 150); raise exception 'CHECK FAILED: badge thresholds allowed out of order';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  perform public.update_badge_tier('aqua_guardian', 300);
  begin perform public.update_garden_item('lotus_pond', 10, true); raise exception 'CHECK FAILED: priced a badge-only item';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  begin perform public.update_garden_item('ghaf', 6000, true); raise exception 'CHECK FAILED: priced above 5,000 leaves';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  perform public.update_garden_item('ghaf', 200, true);
  if (select count(*) from public.teacher_gardens()) <> 2 then raise exception 'CHECK FAILED: teacher should see 2 gardens'; end if;
  if (select spent from public.teacher_gardens() where class_name = '7A') <> 75 then raise exception 'CHECK FAILED: 7A spent 75 leaves'; end if;
  if (select count(*) from public.teacher_challenges()) <> 11 then raise exception 'CHECK FAILED: 11 challenges expected'; end if;
  begin perform public.upsert_eco_challenge(null, 'Plant a seed', 'Plant one seed in the school garden.', 'Plant it, water it, scan.',
                                            'School garden', 3, 101, 'instant', 'week', true);
    raise exception 'CHECK FAILED: a challenge gave more than 100 leaves';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  perform public.upsert_eco_challenge(null, 'Plant a seed', 'Plant one seed in the school garden.', 'Plant it, water it, scan.',
                                      'School garden', 3, 4, 'instant', 'week', true);
  if (select leaves from public.teacher_challenges() where title = 'Plant a seed') is distinct from 4::smallint then
    raise exception 'CHECK FAILED: new challenge not saved with its leaves';
  end if;
end $$;
reset role;

-- --------------------------- 7. the voided claim can be redone; new badge reward ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ declare g jsonb; begin
  if public.claim_challenge(current_setting('ecotest.token_recycle'), null) ->> 'status' <> 'approved' then
    raise exception 'CHECK FAILED: after a void the class should be able to do the challenge again';
  end if;
  g := public.my_garden();      -- 317 points this month ≥ new Aqua Guardian threshold of 300
  if (g -> 'new_rewards' -> 0 ->> 'item') is distinct from 'lotus_pond' then
    raise exception 'CHECK FAILED: lowering Aqua Guardian to 300 should win the Lotus pond: %', g -> 'new_rewards';
  end if;
  -- 88 + 3 for redoing the challenge + 20 for Aqua Guardian
  if (g -> 'new_leaves' -> 0 ->> 'leaves')::int is distinct from 20 or (g ->> 'available')::int <> 111 then
    raise exception 'CHECK FAILED: Aqua Guardian should add 20 leaves (111): % %', g -> 'new_leaves', g ->> 'available';
  end if;
end $$;
reset role;

-- badge leaves are kept even if the month's points later drop below the badge
insert into public.points_ledger (school_id, class_id, points_date, source, points, reason, created_by)
select c.school_id, c.id, app.school_today(c.school_id), 'adjustment', -250, 'Test drop', 'c0000000-0000-4000-8000-000000000001'
  from public.classes c where c.school_id = '5d000000-0000-4000-8000-00000000000a' and c.name = '7A';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  if (public.my_leaves() ->> 'available')::int <> 111 then raise exception 'CHECK FAILED: badge leaves were taken back'; end if;
end $$;
reset role;

-- --------------------------------------------- 8. teacher S: school isolation ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.teacher_challenge_claims(current_date - 40, current_date + 1)) <> 0 then
    raise exception 'CHECK FAILED: teacher S saw school R''s claims';
  end if;
  if (select count(*) from public.teacher_leaf_grants(50)) <> 0 then raise exception 'CHECK FAILED: teacher S saw school R''s leaves'; end if;
  begin perform public.award_leaves((select id from public.classes where school_id = '5d000000-0000-4000-8000-00000000000a' limit 1), 5, 'Not mine');
    raise exception 'CHECK FAILED: teacher S gave leaves to school R';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
  begin perform public.review_challenge_claim((select id from public.challenge_claims limit 1), true, null);
    raise exception 'CHECK FAILED: teacher S reviewed school R''s claim';
  exception when others then if sqlerrm like 'CHECK FAILED%' then raise; end if; end;
end $$;
reset role;

-- --------------------------------------------- 9. measuring week + guards ----
update public.schools set points_start_date = app.school_today(id) + 1 where slug = 'zz-test-r';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$ begin
  begin perform public.claim_challenge(current_setting('ecotest.token_recycle'), null);
    raise exception 'CHECK FAILED: challenge done during the measuring week';
  exception when others then
    if sqlerrm not like 'Eco challenges open when points start%' then raise exception 'CHECK FAILED: wrong measuring-week message: %', sqlerrm; end if;
  end;
end $$;
reset role;

do $$ begin
  begin delete from public.garden_plants where school_id = '5d000000-0000-4000-8000-00000000000a';
    raise exception 'CHECK FAILED: garden plants could be deleted';
  exception when insufficient_privilege then null; end;
  begin update public.garden_plants set cost = 0 where school_id = '5d000000-0000-4000-8000-00000000000a';
    raise exception 'CHECK FAILED: a plant''s price could be changed';
  exception when insufficient_privilege then null; end;
  begin delete from public.challenge_claims where school_id = '5d000000-0000-4000-8000-00000000000a';
    raise exception 'CHECK FAILED: challenge claims could be deleted';
  exception when insufficient_privilege then null; end;
  begin update public.challenge_claims set leaves = 50 where school_id = '5d000000-0000-4000-8000-00000000000a';
    raise exception 'CHECK FAILED: a claim''s leaves could be changed';
  exception when insufficient_privilege then null; end;
  begin update public.leaf_grants set leaves = 500 where school_id = '5d000000-0000-4000-8000-00000000000a';
    raise exception 'CHECK FAILED: leaf grants could be edited';
  exception when insufficient_privilege then null; end;
  begin delete from public.leaf_grants where school_id = '5d000000-0000-4000-8000-00000000000a';
    raise exception 'CHECK FAILED: leaf grants could be deleted';
  exception when insufficient_privilege then null; end;
end $$;

rollback;
select 'ALL REWARDS CHECKS PASSED (test data rolled back)' as result;
