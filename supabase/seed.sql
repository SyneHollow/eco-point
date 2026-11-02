-- EcoPoints starting data. Safe to run more than once.
-- Change the school name later in the app (Teacher → Settings).
-- The slug must match NEXT_PUBLIC_SCHOOL_SLUG in the app's environment.

insert into public.schools (slug, name, timezone)
values ('school', 'Your School Name', 'Asia/Dubai')
on conflict (slug) do nothing;

-- Grades 7 and 8, sections A–D, 30 students each (edit in Teacher → Classes).
insert into public.classes (school_id, grade, section, strength)
select s.id, g.grade, x.section, 30
  from public.schools s
  cross join (values (7), (8)) as g(grade)
  cross join (values ('A'), ('B'), ('C'), ('D')) as x(section)
 where s.slug = 'school'
on conflict (school_id, grade, section) do nothing;

-- Daily checklist. Counts are entered by the class's own Eco Monitors;
-- yes/no checks are done by another class's monitors (peer check).
-- Eco drives and other one-off activities are teacher bonuses, not daily items.
insert into public.actions (school_id, code, label, help, input_type, entered_by, max_points, sdgs, sort_order, active)
select s.id, a.code, a.label, a.help, a.input_type, a.entered_by, a.max_points, a.sdgs::smallint[], a.sort_order, a.active
  from public.schools s
  cross join (values
    ('plastic_free_lunch', 'Plastic-free lunch', 'How many students had no single-use plastic in their lunch today?', 'count', 'self', 10, '{12,14}', 10, true),
    ('reusable_bottle',    'Reusable water bottle', 'How many students brought a reusable bottle today?', 'count', 'self', 5, '{6,12}', 20, true),
    ('lights_off',         'Lights and fans off when the room is empty', 'Check at break or after the last period.', 'check', 'peer', 5, '{7,13}', 30, true),
    ('clean_classroom',    'Classroom clean', 'Floor, desks and bins tidy; waste in the right bin.', 'check', 'peer', 5, '{11,12}', 40, true),
    ('paper_saved',        'Paper saved', 'Both sides used and scrap paper reused today?', 'check', 'self', 5, '{12,15}', 50, false)
  ) as a(code, label, help, input_type, entered_by, max_points, sdgs, sort_order, active)
 where s.slug = 'school'
on conflict (school_id, code) do nothing;
