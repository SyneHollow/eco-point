-- =============================================================================
-- EcoPoints rule checks. Safe on a live project: everything runs inside one
-- transaction against two throw-away test schools and is ROLLED BACK at the end.
--
-- Run: Supabase dashboard → SQL Editor → paste this whole file → Run.
-- Pass  = the last result reads "ALL ECOPOINTS CHECKS PASSED".
-- Fail  = the run stops with an error starting "CHECK FAILED: ...".
-- =============================================================================
begin;

-- ---------------------------------------------------------------- setup ----
insert into public.schools (id, slug, name) values
  ('5c000000-0000-4000-8000-00000000000a', 'zz-test-a', 'Test School A'),
  ('5c000000-0000-4000-8000-00000000000b', 'zz-test-b', 'Test School B');

insert into public.classes (school_id, grade, section, strength)
select '5c000000-0000-4000-8000-00000000000a', g.g, x.s, 30
  from (values (7), (8)) g(g) cross join (values ('A'), ('B')) x(s);
insert into public.classes (school_id, grade, section, strength)
values ('5c000000-0000-4000-8000-00000000000b', 7, 'A', 25);

insert into public.actions (school_id, code, label, input_type, entered_by, max_points, sdgs, sort_order)
select s, a.code, a.label, a.t, a.by, a.pts, '{12}', a.o
  from (values ('5c000000-0000-4000-8000-00000000000a'::uuid), ('5c000000-0000-4000-8000-00000000000b'::uuid)) sc(s)
  cross join (values ('plastic_free_lunch', 'Plastic-free lunch', 'count', 'self', 10, 1),
                     ('reusable_bottle', 'Reusable bottle', 'count', 'self', 5, 2),
                     ('lights_off', 'Lights off', 'check', 'peer', 5, 3),
                     ('clean_classroom', 'Classroom clean', 'check', 'peer', 5, 4)) a(code, label, t, by, pts, o);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'zz-teacher-a@test.invalid'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'zz-m7a@test.invalid'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'zz-m7b@test.invalid'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'zz-m8a@test.invalid'),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'zz-teacher-b@test.invalid'),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'zz-mb7a@test.invalid');

insert into public.profiles (id, school_id, role, class_id, display_name) values
  ('a0000000-0000-4000-8000-000000000001', '5c000000-0000-4000-8000-00000000000a', 'teacher', null, 'Teacher A'),
  ('b0000000-0000-4000-8000-000000000001', '5c000000-0000-4000-8000-00000000000b', 'teacher', null, 'Teacher B');
insert into public.profiles (id, school_id, role, class_id, display_name)
select u.id, c.school_id, 'monitor', c.id, c.name || ' monitors'
  from (values ('a0000000-0000-4000-8000-000000000002'::uuid, '5c000000-0000-4000-8000-00000000000a'::uuid, '7A'),
               ('a0000000-0000-4000-8000-000000000003'::uuid, '5c000000-0000-4000-8000-00000000000a'::uuid, '7B'),
               ('a0000000-0000-4000-8000-000000000004'::uuid, '5c000000-0000-4000-8000-00000000000a'::uuid, '8A'),
               ('b0000000-0000-4000-8000-000000000002'::uuid, '5c000000-0000-4000-8000-00000000000b'::uuid, '7A')) u(id, s, cname)
  join public.classes c on c.school_id = u.s and c.name = u.cname;

-- ------------------------------------------- 1. anonymous visitor (public) ----
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  if (select count(*) from public.get_leaderboard('zz-test-a', current_date - 30, current_date + 1)) <> 4 then
    raise exception 'CHECK FAILED: public leaderboard should list 4 classes';
  end if;
  if public.public_school('zz-test-a') ->> 'name' <> 'Test School A' then
    raise exception 'CHECK FAILED: public_school did not return the school';
  end if;
  begin perform 1 from public.daily_entries limit 1;
  exception when insufficient_privilege then return; end;
  raise exception 'CHECK FAILED: anonymous visitor could read daily_entries';
end $$;
do $$ begin
  begin perform public.whoami();
  exception when insufficient_privilege then return; end;
  raise exception 'CHECK FAILED: anonymous visitor could call whoami';
end $$;
reset role;

-- ------------------------------------------------- 2. monitor 8A submits ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

do $$ begin  -- more than present
  begin perform public.submit_daily_entry(20, '{"plastic_free_lunch":21,"reusable_bottle":1}');
  exception when others then return; end;
  raise exception 'CHECK FAILED: count above students present was accepted';
end $$;
do $$ begin  -- present above class strength (30)
  begin perform public.submit_daily_entry(31, '{"plastic_free_lunch":1,"reusable_bottle":1}');
  exception when others then return; end;
  raise exception 'CHECK FAILED: present above class strength was accepted';
end $$;
do $$ begin  -- unknown item
  begin perform public.submit_daily_entry(20, '{"plastic_free_lunch":1,"reusable_bottle":1,"made_up":1}');
  exception when others then return; end;
  raise exception 'CHECK FAILED: unknown item was accepted';
end $$;
do $$ begin  -- missing item
  begin perform public.submit_daily_entry(20, '{"plastic_free_lunch":1}');
  exception when others then return; end;
  raise exception 'CHECK FAILED: missing item was accepted';
end $$;
do $$ begin  -- fraction
  begin perform public.submit_daily_entry(20, '{"plastic_free_lunch":2.5,"reusable_bottle":1}');
  exception when others then return; end;
  raise exception 'CHECK FAILED: fractional count was accepted';
end $$;

do $$ declare r jsonb; begin
  r := public.submit_daily_entry(28, '{"plastic_free_lunch":25,"reusable_bottle":20}');
  -- 10 × 25/28 = 8.93 ; 5 × 20/28 = 3.57 ; total 12.50
  if (r ->> 'points')::numeric <> 12.50 then
    raise exception 'CHECK FAILED: expected 12.50 points, got %', r ->> 'points';
  end if;
end $$;

do $$ begin  -- second submission same day
  begin perform public.submit_daily_entry(28, '{"plastic_free_lunch":25,"reusable_bottle":20}');
  exception when others then return; end;
  raise exception 'CHECK FAILED: second entry on the same day was accepted';
end $$;

-- RLS: monitor sees only its own class
do $$ begin
  if (select count(*) from public.daily_entries) <> 1 then
    raise exception 'CHECK FAILED: monitor should see exactly its own 1 entry, sees %', (select count(*) from public.daily_entries);
  end if;
  if exists (select 1 from public.points_ledger l join public.classes c on c.id = l.class_id where c.name <> '8A') then
    raise exception 'CHECK FAILED: monitor can see another class''s points rows';
  end if;
end $$;
do $$ begin  -- direct table write
  begin insert into public.points_ledger (school_id, class_id, points_date, source, points, created_by)
        select school_id, class_id, current_date, 'daily', 999, id from public.profiles where id = auth.uid();
  exception when insufficient_privilege then return; end;
  raise exception 'CHECK FAILED: monitor wrote to points_ledger directly';
end $$;
do $$ begin  -- teacher-only RPC
  begin perform public.award_points((select class_id from public.profiles where id = auth.uid()), 'bonus', 50, 'self award');
  exception when others then return; end;
  raise exception 'CHECK FAILED: monitor awarded itself bonus points';
end $$;
do $$ begin  -- service-only RPC
  begin perform public.svc_link_profile(auth.uid(), '5c000000-0000-4000-8000-00000000000a', 'teacher', null, 'x', auth.uid());
  exception when insufficient_privilege then return; end;
  raise exception 'CHECK FAILED: monitor could call a service-only function';
end $$;

-- ------------------------------------------------------ 3. peer check ----
do $$ begin  -- invalid answer
  begin perform public.submit_peer_audit('{"lights_off":2,"clean_classroom":0}');
  exception when others then return; end;
  raise exception 'CHECK FAILED: peer answer 2 was accepted';
end $$;
do $$ declare t jsonb; r jsonb; begin
  t := public.my_today() -> 'audit_target';
  if t is null or t ->> 'name' = '8A' then raise exception 'CHECK FAILED: bad peer target %', t; end if;
  r := public.submit_peer_audit('{"lights_off":1,"clean_classroom":0}');
  if (r ->> 'points')::numeric <> 5 or r ->> 'target' <> t ->> 'name' then
    raise exception 'CHECK FAILED: peer check result wrong: %', r;
  end if;
end $$;
do $$ begin
  begin perform public.submit_peer_audit('{"lights_off":1,"clean_classroom":1}');
  exception when others then return; end;
  raise exception 'CHECK FAILED: second peer check on the same class/day was accepted';
end $$;
reset role;

-- ---------------------------------------------------- 4. teacher A ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  perform public.award_points((select id from public.classes where name = '7A'), 'bonus', 10, 'Eco drive');
  if (select count(*) from public.teacher_today()) <> 4 then raise exception 'CHECK FAILED: teacher_today should list 4 classes'; end if;
  if (select count(*) from public.teacher_entries(current_date - 2, current_date + 2)) <> 1 then
    raise exception 'CHECK FAILED: teacher should see 1 entry';
  end if;
  if (select count(*) from public.get_series(current_date - 2, current_date + 2)) < 3 then
    raise exception 'CHECK FAILED: trend series is empty';
  end if;
end $$;
do $$ begin
  begin perform public.award_points((select id from public.classes where name = '7A'), 'bonus', 10, '');
  exception when others then return; end;
  raise exception 'CHECK FAILED: bonus without a reason was accepted';
end $$;
do $$ begin
  begin perform public.award_points((select id from public.classes where name = '7A'), 'bonus', -5, 'negative bonus');
  exception when others then return; end;
  raise exception 'CHECK FAILED: negative bonus was accepted';
end $$;
reset role;

-- ------------------------------------- 5. other school's teacher (isolation) ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.daily_entries) <> 0 then raise exception 'CHECK FAILED: school B teacher sees school A entries'; end if;
  if (select count(*) from public.points_ledger) <> 0 then raise exception 'CHECK FAILED: school B teacher sees school A points'; end if;
  if (select count(*) from public.teacher_entries(current_date - 2, current_date + 2)) <> 0 then
    raise exception 'CHECK FAILED: school B teacher_entries leaks school A';
  end if;
end $$;
do $$ begin
  begin perform public.award_points(
    (select id from public.classes where school_id = '5c000000-0000-4000-8000-00000000000a' limit 1), 'bonus', 10, 'cross-school');
  exception when others then return; end;
  raise exception 'CHECK FAILED: school B teacher awarded points to school A';
end $$;
reset role;

-- ------------------------------------- 6. leaderboard = sum of points rows ----
do $$ begin
  if exists (
    select 1 from public.get_leaderboard('zz-test-a', current_date - 2, current_date + 2) lb
     where lb.points <> (select coalesce(sum(points), 0) from public.points_ledger l
                          where l.class_id = lb.class_id and l.points_date between current_date - 2 and current_date + 2)) then
    raise exception 'CHECK FAILED: leaderboard totals do not match the points rows';
  end if;
end $$;

-- -------------------------------------------- 7. history can't be edited ----
do $$ begin
  begin update public.points_ledger set points = 999 where school_id = '5c000000-0000-4000-8000-00000000000a';
  exception when others then return; end;
  raise exception 'CHECK FAILED: points_ledger row was edited';
end $$;
do $$ begin
  begin delete from public.points_ledger where school_id = '5c000000-0000-4000-8000-00000000000a';
  exception when others then return; end;
  raise exception 'CHECK FAILED: points_ledger row was deleted';
end $$;
do $$ begin
  begin update public.daily_entries set present = 1 where school_id = '5c000000-0000-4000-8000-00000000000a';
  exception when others then return; end;
  raise exception 'CHECK FAILED: a submitted entry was edited';
end $$;

-- ------------------------------------------- 8. void, then resubmit ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  perform public.void_entry((select id from public.daily_entries e where e.class_id = (select id from public.classes where name = '8A')), 'Typo in count');
end $$;
reset role;
do $$ begin
  if (select sum(points) from public.points_ledger where entry_id is not null
        and class_id = (select id from public.classes where school_id = '5c000000-0000-4000-8000-00000000000a' and name = '8A')) <> 0 then
    raise exception 'CHECK FAILED: void did not cancel the entry''s points';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ declare r jsonb; begin
  r := public.submit_daily_entry(28, '{"plastic_free_lunch":20,"reusable_bottle":20}');
  if (r ->> 'points')::numeric <> 10.71 then  -- 7.14 + 3.57
    raise exception 'CHECK FAILED: resubmission after void gave % points', r ->> 'points';
  end if;
end $$;
reset role;

-- -------------------------------------- 9. baseline week gives no points ----
update public.schools set points_start_date = current_date + 30 where id = '5c000000-0000-4000-8000-00000000000a';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$ declare r jsonb; begin
  r := public.submit_daily_entry(30, '{"plastic_free_lunch":15,"reusable_bottle":10}');
  if (r ->> 'baseline')::boolean is not true or (r ->> 'points')::numeric <> 0 then
    raise exception 'CHECK FAILED: baseline entry should give 0 points, got %', r;
  end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.points_ledger l join public.daily_entries e on e.id = l.entry_id where e.is_baseline) then
    raise exception 'CHECK FAILED: baseline entry created points rows';
  end if;
end $$;
update public.schools set points_start_date = null where id = '5c000000-0000-4000-8000-00000000000a';

-- --------------------------------------------- 10. closing a month ----
insert into public.points_ledger (school_id, class_id, points_date, source, points, reason, created_by)
select '5c000000-0000-4000-8000-00000000000a', c.id, (date_trunc('month', current_date) - interval '1 month')::date + 3,
       'bonus', v.p, 'test history', 'a0000000-0000-4000-8000-000000000001'
  from (values ('7A', 50), ('7B', 30)) v(n, p)
  join public.classes c on c.school_id = '5c000000-0000-4000-8000-00000000000a' and c.name = v.n;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin  -- current month can't be closed
  begin perform public.close_month(current_date);
  exception when others then return; end;
  raise exception 'CHECK FAILED: the current month was closed';
end $$;
do $$ declare r jsonb; begin
  r := public.close_month((date_trunc('month', current_date) - interval '1 month')::date);
  if r ->> 'champion' <> '7A' or (r ->> 'points')::numeric <> 50 then
    raise exception 'CHECK FAILED: wrong champion %', r;
  end if;
end $$;
do $$ begin
  begin perform public.close_month((date_trunc('month', current_date) - interval '1 month')::date);
  exception when others then return; end;
  raise exception 'CHECK FAILED: a month was closed twice';
end $$;
reset role;
do $$ begin
  begin
    insert into public.points_ledger (school_id, class_id, points_date, source, points, reason, created_by)
    select school_id, id, (date_trunc('month', current_date) - interval '1 month')::date + 5, 'bonus', 1, 'late', 'a0000000-0000-4000-8000-000000000001'
      from public.classes where school_id = '5c000000-0000-4000-8000-00000000000a' limit 1;
  exception when others then return; end;
  raise exception 'CHECK FAILED: points were added to a closed month';
end $$;

-- ------------------------------------------ 11. peer-check rotation ----
do $$ declare d date; n int; begin
  for i in 0..60 loop
    d := current_date + i;
    select count(distinct app.audit_target(c.id, d)) into n
      from public.classes c where c.school_id = '5c000000-0000-4000-8000-00000000000a' and c.active;
    if n <> 4 then raise exception 'CHECK FAILED: on % only % classes get checked', d, n; end if;
    if exists (select 1 from public.classes c where c.school_id = '5c000000-0000-4000-8000-00000000000a'
                and (app.audit_target(c.id, d) = c.id or app.audited_by(app.audit_target(c.id, d), d) <> c.id)) then
      raise exception 'CHECK FAILED: rotation broken on %', d;
    end if;
  end loop;
end $$;

-- --------------------------------------------------- 12. public totals ----
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ declare r jsonb; begin
  r := public.get_impact('zz-test-a', current_date - 2, current_date + 2);
  -- live entries: 8A resubmission + 7B baseline = 2
  if (r ->> 'entries')::int <> 2 then raise exception 'CHECK FAILED: impact entries = %', r ->> 'entries'; end if;
  if (select (i ->> 'total')::numeric from jsonb_array_elements(r -> 'items') i where i ->> 'code' = 'plastic_free_lunch') <> 35 then
    raise exception 'CHECK FAILED: plastic-free total should be 35 (20 + 15)';
  end if;
end $$;
reset role;

-- ---------------------------------------------- 13. AI photo checks (v2) ----
-- 13a. A signed-in monitor can't write an AI result directly
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin
  begin perform public.svc_record_ai_check(auth.uid(), 'bin', '{"plastic_items":0,"wrong_bin_items":0,"confidence":1}', 'x', 'y');
  exception when insufficient_privilege then return; end;
  raise exception 'CHECK FAILED: a monitor could record an AI result directly';
end $$;
-- 7A submits a "perfect" day: 30 of 30 plastic-free
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin perform public.submit_daily_entry(30, '{"plastic_free_lunch":30,"reusable_bottle":10}'); end $$;
reset role;

-- 13b. The server (service role) records results
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$ declare r jsonb; begin
  -- 8A: 28 present, 20 plastic-free → 8 plastic lunches; 9 items is plausible → not flagged
  -- points = 10 × (1 − 9 / (28 × 0.5)) = 3.57
  r := public.svc_record_ai_check('a0000000-0000-4000-8000-000000000004', 'bin',
         '{"plastic_items":9,"wrong_bin_items":1,"confidence":0.8,"items":[{"label":"wrapper","kind":"plastic"}],"summary":"9 wrappers"}', 'mock', 'mock-1');
  if (r ->> 'points')::numeric <> 3.57 or (r ->> 'flagged')::boolean then
    raise exception 'CHECK FAILED: 8A bin check should score 3.57 unflagged, got %', r;
  end if;
  -- 7A claimed 30/30 plastic-free; 9 plastic items in the bin → AI referee flags it; points = 10 × (1 − 9/15) = 4.00
  r := public.svc_record_ai_check('a0000000-0000-4000-8000-000000000002', 'bin',
         '{"plastic_items":9,"wrong_bin_items":0,"confidence":0.9,"items":[],"summary":"bottles and wrappers"}', 'mock', 'mock-1');
  if (r ->> 'points')::numeric <> 4.00 or not (r ->> 'flagged')::boolean then
    raise exception 'CHECK FAILED: 7A bin check should be flagged at 4.00 pts, got %', r;
  end if;
  -- 8A's peer check said lights were off; the room photo shows them on → flagged, no points
  r := public.svc_record_ai_check('a0000000-0000-4000-8000-000000000004', 'room',
         '{"lights_on":true,"litter_level":1,"bin_overflowing":false,"confidence":0.9,"items":[],"summary":"lights on"}', 'mock', 'mock-1');
  if not (r ->> 'flagged')::boolean or (r ->> 'points')::numeric <> 0 then
    raise exception 'CHECK FAILED: room check should flag the lights, got %', r;
  end if;
end $$;
do $$ begin  -- second bin check same day
  begin perform public.svc_record_ai_check('a0000000-0000-4000-8000-000000000004', 'bin', '{"plastic_items":0,"wrong_bin_items":0,"confidence":1}', 'mock', 'mock-1');
  exception when others then return; end;
  raise exception 'CHECK FAILED: a second bin check on the same day was accepted';
end $$;
do $$ begin  -- room photo before doing the peer check (7A hasn't checked anyone today)
  begin perform public.svc_record_ai_check('a0000000-0000-4000-8000-000000000002', 'room', '{"lights_on":false,"litter_level":0,"confidence":1}', 'mock', 'mock-1');
  exception when others then return; end;
  raise exception 'CHECK FAILED: room photo accepted without a peer check';
end $$;
do $$ begin  -- bin check before the class check (school B's 7A has no entry)
  begin perform public.svc_record_ai_check('b0000000-0000-4000-8000-000000000002', 'bin', '{"plastic_items":0,"wrong_bin_items":0,"confidence":1}', 'mock', 'mock-1');
  exception when others then return; end;
  raise exception 'CHECK FAILED: bin check accepted before the class check';
end $$;
do $$ begin  -- nonsense counts (7B has a class check today, so only the count can fail)
  begin perform public.svc_record_ai_check('a0000000-0000-4000-8000-000000000003', 'bin', '{"plastic_items":-4,"wrong_bin_items":0,"confidence":1}', 'mock', 'mock-1');
  exception when others then return; end;
  raise exception 'CHECK FAILED: negative AI count accepted';
end $$;
reset role;

-- 13c. Stored AI results can't be edited
do $$ begin
  begin update public.ai_checks set plastic_items = 0 where school_id = '5c000000-0000-4000-8000-00000000000a';
  exception when others then return; end;
  raise exception 'CHECK FAILED: an AI result was edited';
end $$;
do $$ begin
  if (select sum(points) from public.points_ledger where source = 'ai' and school_id = '5c000000-0000-4000-8000-00000000000a') <> 7.57 then
    raise exception 'CHECK FAILED: AI points rows should total 7.57';
  end if;
end $$;

-- 13d. Teacher: flags, review, void + retake, challenges
select set_config('ecotest.week',
  (app.school_today('5c000000-0000-4000-8000-00000000000a') - (extract(isodow from app.school_today('5c000000-0000-4000-8000-00000000000a'))::int - 1))::text, true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ declare v_id uuid; begin
  if (select count(*) from public.teacher_flags(current_date - 2, current_date + 2) where kind = 'ai_mismatch') <> 2 then
    raise exception 'CHECK FAILED: expected 2 AI mismatch flags (7A bin, 8A room)';
  end if;
  select id into v_id from public.teacher_ai_checks(current_date - 2, current_date + 2) where class_name = '7A' and check_type = 'bin';
  perform public.review_ai_check(v_id, 'Spoke to 7A monitors');
  if (select count(*) from public.teacher_flags(current_date - 2, current_date + 2) where kind = 'ai_mismatch') <> 1 then
    raise exception 'CHECK FAILED: reviewed flag still listed';
  end if;
  select id into v_id from public.teacher_ai_checks(current_date - 2, current_date + 2) where class_name = '8A' and check_type = 'bin';
  perform public.void_ai_check(v_id, 'Photo was of the wrong bin');
  perform public.publish_challenges(current_setting('ecotest.week')::date,
    jsonb_build_array(jsonb_build_object('class_id', (select id from public.classes where school_id = '5c000000-0000-4000-8000-00000000000a' and name = '7A'),
                                         'text', 'Bottle-Up Tuesday: every bottle reusable!')));
end $$;
do $$ begin
  begin perform public.review_ai_check((select id from public.ai_checks where school_id = '5c000000-0000-4000-8000-00000000000a' and reviewed_at is not null limit 1), 'again');
  exception when others then return; end;
  raise exception 'CHECK FAILED: an AI check was reviewed twice';
end $$;
reset role;
do $$ begin
  if (select sum(l.points) from public.points_ledger l join public.ai_checks a on a.id = l.ai_check_id
       where a.voided_at is not null and a.school_id = '5c000000-0000-4000-8000-00000000000a') <> 0 then
    raise exception 'CHECK FAILED: voiding an AI check did not cancel its points';
  end if;
end $$;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$ declare r jsonb; begin  -- retake after void is allowed
  r := public.svc_record_ai_check('a0000000-0000-4000-8000-000000000004', 'bin', '{"plastic_items":0,"wrong_bin_items":0,"confidence":0.9}', 'mock', 'mock-1');
  if (r ->> 'points')::numeric <> 10 then raise exception 'CHECK FAILED: empty bin should score 10, got %', r; end if;
end $$;
reset role;

-- 13e. Monitor and public views
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ declare t jsonb; begin
  t := public.my_ai_today();
  if (t -> 'bin' ->> 'plastic_items')::int <> 9 or t ->> 'challenge' is null then
    raise exception 'CHECK FAILED: 7A monitor view missing bin result or challenge: %', t;
  end if;
  if (select count(*) from public.ai_checks) <> 1 then  -- RLS: own class's checks only (its bin check)
    raise exception 'CHECK FAILED: monitor sees % AI checks, expected 1', (select count(*) from public.ai_checks);
  end if;
end $$;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ declare s jsonb; begin
  s := public.get_ai_summary('zz-test-a', current_date - 2, current_date + 2);
  -- live bin checks: 7A (9 items, 30 present) + 8A retake (0 items, 28 present) → 9 items / 58 students → 1.6 per 10
  if (s ->> 'bin_checks')::int <> 2 or (s ->> 'per_10_students')::numeric <> 1.6 then
    raise exception 'CHECK FAILED: AI summary wrong: %', s;
  end if;
  if (select count(*) from public.get_challenges('zz-test-a', current_setting('ecotest.week')::date)) <> 1 then
    raise exception 'CHECK FAILED: challenges list wrong';
  end if;
  begin perform 1 from public.ai_checks limit 1;
  exception when insufficient_privilege then return; end;
  raise exception 'CHECK FAILED: anonymous visitor could read ai_checks';
end $$;
reset role;

rollback;
select 'ALL ECOPOINTS CHECKS PASSED (test data rolled back)' as result;
