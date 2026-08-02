-- seed-viva-forum.sql
-- Rich, "lived-in" forum content for the viva demo. Creates 8 demo users
-- (7 students + 1 verified lecturer, Dr. Lim), the Chemistry / Physics / Biology
-- subjects, and ~18 question threads across all 5 exam sections (calculus,
-- linear algebra, chemistry, physics, biology). Answers are accurate; a few
-- comments are deliberately slightly WRONG and then corrected by another
-- student or by the lecturer -- so the forum shows real community correction.
-- Content is grounded in the provided exam PDFs.
--
-- Run in the Supabase SQL editor (runs as postgres: can insert auth.users and
-- bypasses RLS). Idempotent: skips itself if its first question already exists.
-- Requires pgcrypto (crypt/gen_salt) -- enabled by default on Supabase.
-- Remove: delete the 8 users below (content cascades) or the titles seeded here.

-- 1) Demo users (fixed UUIDs so re-running is idempotent). The on_auth_user_created
--    trigger creates a matching public.profiles row from full_name.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, null, now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', u.name),
       now() - interval '120 days', now(), '', '', '', ''
from (values
  ('a1d00000-0000-4000-8000-000000000001'::uuid, 'aisha.demo@peerly.me',  'Aisha Rahman'),
  ('a1d00000-0000-4000-8000-000000000002'::uuid, 'weijie.demo@peerly.me', 'Wei Jie Tan'),
  ('a1d00000-0000-4000-8000-000000000003'::uuid, 'priya.demo@peerly.me',  'Priya Nair'),
  ('a1d00000-0000-4000-8000-000000000004'::uuid, 'daniel.demo@peerly.me', 'Daniel Osei'),
  ('a1d00000-0000-4000-8000-000000000005'::uuid, 'sofia.demo@peerly.me',  'Sofia Alvarez'),
  ('a1d00000-0000-4000-8000-000000000006'::uuid, 'kenji.demo@peerly.me',  'Kenji Watanabe'),
  ('a1d00000-0000-4000-8000-000000000007'::uuid, 'marcus.demo@peerly.me', 'Marcus Chen'),
  ('a1d00000-0000-4000-8000-000000000008'::uuid, 'drlim.demo@peerly.me',  'Dr. Lim Mei Ling')
) as u(id, email, name)
on conflict (id) do nothing;

-- Usernames + make Dr. Lim a verified lecturer.
update public.profiles set username = 'aisha_r'  where id = 'a1d00000-0000-4000-8000-000000000001' and username is null;
update public.profiles set username = 'weijie_t' where id = 'a1d00000-0000-4000-8000-000000000002' and username is null;
update public.profiles set username = 'priya_n'  where id = 'a1d00000-0000-4000-8000-000000000003' and username is null;
update public.profiles set username = 'daniel_o' where id = 'a1d00000-0000-4000-8000-000000000004' and username is null;
update public.profiles set username = 'sofia_a'  where id = 'a1d00000-0000-4000-8000-000000000005' and username is null;
update public.profiles set username = 'kenji_w'  where id = 'a1d00000-0000-4000-8000-000000000006' and username is null;
update public.profiles set username = 'marcus_c' where id = 'a1d00000-0000-4000-8000-000000000007' and username is null;
update public.profiles set username = 'dr_lim', role = 'lecturer', lecturer_status = 'verified'
  where id = 'a1d00000-0000-4000-8000-000000000008';

do $$
declare
  aisha  uuid := 'a1d00000-0000-4000-8000-000000000001';
  weijie uuid := 'a1d00000-0000-4000-8000-000000000002';
  priya  uuid := 'a1d00000-0000-4000-8000-000000000003';
  daniel uuid := 'a1d00000-0000-4000-8000-000000000004';
  sofia  uuid := 'a1d00000-0000-4000-8000-000000000005';
  kenji  uuid := 'a1d00000-0000-4000-8000-000000000006';
  marcus uuid := 'a1d00000-0000-4000-8000-000000000007';
  drlim  uuid := 'a1d00000-0000-4000-8000-000000000008';

  subj_math uuid; subj_chem uuid; subj_phys uuid; subj_bio uuid;
  q uuid; a1 uuid; a2 uuid;
begin
  if exists (select 1 from public.questions
             where title = 'Finding the tangent line to y = x^2 at the point (1,1)') then
    raise notice 'Viva forum seed already present, skipping.';
    return;
  end if;

  insert into public.subjects (name, slug) values
    ('Chemistry','chemistry'), ('Physics','physics'), ('Biology','biology')
    on conflict (slug) do nothing;
  select id into subj_math from public.subjects where slug = 'mathematics';
  select id into subj_chem from public.subjects where slug = 'chemistry';
  select id into subj_phys from public.subjects where slug = 'physics';
  select id into subj_bio  from public.subjects where slug = 'biology';

  -- helper: cast interval ago
  -- (inline below)

  ------------------------------------------------------------------ MATH: CALCULUS
  -- Q: tangent to y=x^2 (the model's best demo). Wrong comment corrected.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (weijie, subj_math,
    'Finding the tangent line to y = x^2 at the point (1,1)',
    E'I need the equation of the tangent to y = x^2 at (1,1). I keep thinking the tangent is just y = x^2 again because it touches the curve there. What am I missing?',
    'resolved', 214, now() - interval '9 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, aisha, E'The tangent is a straight LINE, not the curve. Differentiate: dy/dx = 2x. At x = 1 the slope is 2. Now use point-slope through (1,1): y - 1 = 2(x - 1), which simplifies to y = 2x - 1. That line just grazes the parabola at (1,1).',
     now() - interval '8 days 20 hours') returning id into a1;
  update public.questions set preferred_answer_id = a1 where id = q;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a1, weijie, E'Wait, so the tangent isn''t y = x^2? I thought since it touches at that point they''re the same.', now() - interval '8 days 12 hours'),
    (a1, priya,  E'No -- y = x^2 is the curve; the tangent is the straight line that matches the curve''s slope at that one point. Two different things. The line is y = 2x - 1.', now() - interval '8 days 10 hours'),
    (a1, weijie, E'Ah that makes sense now, thanks!', now() - interval '8 days 9 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, priya, 1), (a1, daniel, 1), (a1, sofia, 1), (a1, drlim, 1) on conflict do nothing;

  -- Q: when is the body at rest, y(t) = t - sin t. Wrong comment corrected by lecturer.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (kenji, subj_math,
    'Kinematics: at what times is a body with y(t) = t - sin(t) at rest?',
    E'Displacement y(t) = t - sin(t) metres for t >= 0. I need the times when the body is at rest. Do I set y(t) = 0 or something else?',
    'answered', 96, now() - interval '6 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, daniel, E'"At rest" means velocity = 0, not displacement = 0. Velocity is v(t) = dy/dt = 1 - cos(t). Set 1 - cos(t) = 0 -> cos(t) = 1 -> t = 0, 2*pi, 4*pi, ... i.e. t = 2*pi*n for non-negative integers n.',
     now() - interval '5 days 20 hours') returning id into a1;
  update public.questions set preferred_answer_id = a1 where id = q;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a1, kenji, E'I first tried solving y(t) = 0 and got stuck. So rest is when velocity is zero?', now() - interval '5 days 16 hours'),
    (a1, drlim, E'Correct -- "at rest" is a statement about velocity, so you set v(t) = 0. Setting displacement to zero would tell you when it passes the origin, which is a different question. Well spotted, Daniel.', now() - interval '5 days 12 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, kenji, 1), (a1, aisha, 1), (a1, drlim, 1) on conflict do nothing;

  -- Q: slope of y = 4x + e^x at (0,1). Single clean answer.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (sofia, subj_math,
    'What is the slope of y = 4x + e^x at the point (0,1)?',
    E'Quick one -- I need the slope of the curve y = 4x + e^x at (0,1). Is the derivative of e^x really just e^x?',
    'answered', 58, now() - interval '4 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, marcus, E'Yes, d/dx(e^x) = e^x. So dy/dx = 4 + e^x. At x = 0: 4 + e^0 = 4 + 1 = 5. The slope is 5.',
     now() - interval '3 days 20 hours') returning id into a1;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, sofia, 1), (a1, weijie, 1) on conflict do nothing;

  -- Q: acceleration of y(t) = 3t^3 + 4t + 1 at t = 4. Wrong comment corrected.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (priya, subj_math,
    'Acceleration of a particle with y(t) = 3t^3 + 4t + 1 at t = 4 s',
    E'A particle has displacement y(t) = 3t^3 + 4t + 1 metres. I need its acceleration at t = 4 s. I differentiated once and plugged in -- is that right?',
    'resolved', 73, now() - interval '7 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, aisha, E'Acceleration is the SECOND derivative. v(t) = dy/dt = 9t^2 + 4. a(t) = dv/dt = 18t. At t = 4: a = 18 * 4 = 72 m/s^2.',
     now() - interval '6 days 18 hours') returning id into a1;
  update public.questions set preferred_answer_id = a1 where id = q;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a1, priya, E'I only differentiated once and got 9(4)^2 + 4 = 148. Where did I go wrong?', now() - interval '6 days 14 hours'),
    (a1, sofia, E'That 148 is the velocity, not the acceleration. Acceleration needs the derivative of velocity, so differentiate again -> a = 18t -> 72.', now() - interval '6 days 12 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, priya, 1), (a1, sofia, 1), (a1, drlim, 1) on conflict do nothing;

  ------------------------------------------------------------------ MATH: LINEAR ALGEBRA
  -- Q: inverse of a 2x2. Wrong (sign) comment corrected by lecturer.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (daniel, subj_math,
    'How do I find the inverse of the 2x2 matrix [[1, -1], [2, 1]]?',
    E'Using the 2x2 inverse rule, I keep getting the determinant wrong and the whole thing falls apart. Can someone show the steps for A = [[1, -1], [2, 1]]?',
    'resolved', 121, now() - interval '11 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, priya, E'For A = [[a, b], [c, d]], A^-1 = (1/det) * [[d, -b], [-c, a]] with det = ad - bc. Here det = (1)(1) - (-1)(2) = 1 + 2 = 3. So A^-1 = (1/3) * [[1, 1], [-2, 1]]. You can check A * A^-1 = I.',
     now() - interval '10 days 20 hours') returning id into a1;
  update public.questions set preferred_answer_id = a1 where id = q;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a1, daniel, E'I had det = (1)(1) - (1)(2) = -1, that''s why my answer was off.', now() - interval '10 days 15 hours'),
    (a1, drlim,  E'Careful with the sign: bc = (-1)(2) = -2, and det = ad - bc = 1 - (-2) = 3. The double negative is the step everyone drops. Priya''s working is correct.', now() - interval '10 days 12 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, daniel, 1), (a1, kenji, 1), (a1, marcus, 1), (a1, drlim, 1) on conflict do nothing;

  -- Q: symmetric + skew-symmetric decomposition. Single clean answer.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (weijie, subj_math,
    'Express a square matrix as a sum of a symmetric and a skew-symmetric matrix',
    E'The problem sheet asks to write any n x n matrix A as the sum of a symmetric and a skew-symmetric matrix. Is there a standard trick or do I solve it element by element?',
    'answered', 67, now() - interval '5 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, marcus, E'There is a clean trick. Write A = (1/2)(A + A^T) + (1/2)(A - A^T). The first part S = (1/2)(A + A^T) is symmetric (S^T = S), and the second part K = (1/2)(A - A^T) is skew-symmetric (K^T = -K). Add them and the transposes cancel back to A.',
     now() - interval '4 days 18 hours') returning id into a1;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, weijie, 1), (a1, priya, 1), (a1, drlim, 1) on conflict do nothing;

  ------------------------------------------------------------------ CHEMISTRY
  -- Q: first law, sign convention. Wrong comment corrected.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (kenji, subj_chem,
    'First law: system loses 250 kJ of heat and does 500 kJ of work -- find delta U',
    E'A system loses 250 kJ of heat while doing 500 kJ of work on its surroundings. What is the change in internal energy? I got +750 kJ but the answer key says -750 kJ and I do not see why.',
    'resolved', 188, now() - interval '10 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, aisha, E'First law: delta U = q - w, where q is heat added TO the system and w is work done BY the system. The system LOSES heat, so q = -250 kJ. It DOES 500 kJ of work, so w = +500 kJ. delta U = (-250) - (+500) = -750 kJ. Both terms remove energy, so internal energy drops by 750 kJ.',
     now() - interval '9 days 18 hours') returning id into a1;
  update public.questions set preferred_answer_id = a1 where id = q;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a1, sofia,  E'I just added 250 + 500 = 750 and made it positive. Why is it negative?', now() - interval '9 days 14 hours'),
    (a1, marcus, E'Because both are energy LEAVING the system: heat lost (-250) and work done by the system (-500 to internal energy). Losses add up to -750, not +750.', now() - interval '9 days 12 hours'),
    (a1, drlim,  E'Exactly. The sign convention is the whole question here: q negative for heat released, w positive for work done by the system, and delta U = q - w.', now() - interval '9 days 10 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, sofia, 1), (a1, marcus, 1), (a1, priya, 1), (a1, drlim, 1) on conflict do nothing;

  -- Q: oil of bitter almonds. Factual, single answer.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (sofia, subj_chem,
    'Which compound is known as "oil of bitter almonds"?',
    E'Came up in a past paper: which aromatic aldehyde is called "oil of bitter almonds"? I was torn between benzaldehyde and cinnamaldehyde.',
    'answered', 44, now() - interval '3 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, priya, E'Benzaldehyde (C6H5CHO). It is the simplest aromatic aldehyde and gives the characteristic bitter-almond smell. Cinnamaldehyde is the cinnamon one.',
     now() - interval '2 days 20 hours') returning id into a1;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, sofia, 1), (a1, kenji, 1) on conflict do nothing;

  -- Q: activation energy graph (Arrhenius). Wrong comment corrected by lecturer.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (marcus, subj_chem,
    'How do you get the activation energy Ea from a graph?',
    E'For a reaction, which plot lets you read off the activation energy, and what is the slope? I always mix up which quantities go on the axes.',
    'resolved', 102, now() - interval '8 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, daniel, E'Use the Arrhenius equation in log form: ln(k) = ln(A) - (Ea/R)(1/T). So plot ln(k) on the y-axis against 1/T (reciprocal of absolute temperature) on the x-axis. The line is straight with slope = -Ea/R, so Ea = -slope * R.',
     now() - interval '7 days 18 hours') returning id into a1;
  update public.questions set preferred_answer_id = a1 where id = q;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a1, kenji, E'Isn''t it just k against T? A rate-vs-temperature curve?', now() - interval '7 days 14 hours'),
    (a1, drlim, E'k vs T is a curve you can''t easily extract Ea from. The Arrhenius relationship is LINEAR only when you plot ln(k) against 1/T -- that straight-line slope gives you -Ea/R. Daniel has it right.', now() - interval '7 days 11 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, kenji, 1), (a1, marcus, 1), (a1, aisha, 1), (a1, drlim, 1) on conflict do nothing;

  -- Q: symmetry group of CO2. Factual.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (aisha, subj_chem,
    'What is the point/symmetry group of the CO2 molecule?',
    E'CO2 is linear (O=C=O). Which symmetry group does it belong to, and why is it not the same as water?',
    'answered', 51, now() - interval '4 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, kenji, E'CO2 is D(infinity)h. It is linear with an infinite-fold rotation axis along the O=C=O bond AND a centre of inversion at the carbon (plus a horizontal mirror plane). Water is bent, has no centre of inversion, so it is C2v instead.',
     now() - interval '3 days 12 hours') returning id into a1;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, aisha, 1), (a1, priya, 1), (a1, drlim, 1) on conflict do nothing;

  ------------------------------------------------------------------ PHYSICS
  -- Q: centre of mass formula. Wrong comment (avg of positions) corrected by lecturer.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (weijie, subj_phys,
    'Correct formula for the centre of mass of N point masses',
    E'For point masses m1..mN at positions r1..rN, how do I write the centre of mass R? I want the general vector formula, not just for equal masses.',
    'resolved', 176, now() - interval '9 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, marcus, E'The centre of mass is the MASS-WEIGHTED average position: R = (sum of m_i * r_i) / (sum of m_i) = (1/M) * sum(m_i r_i), where M = sum(m_i) is the total mass. Each position is weighted by its mass, so heavier masses pull R toward them.',
     now() - interval '8 days 18 hours') returning id into a1;
  update public.questions set preferred_answer_id = a1 where id = q;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a1, kenji, E'I thought it was just the average of the positions, (r1 + r2 + ... + rN)/N?', now() - interval '8 days 14 hours'),
    (a1, drlim, E'That plain average only works if every mass is equal. In general you must weight by mass: R = sum(m_i r_i) / sum(m_i). If all m_i are equal, the masses cancel and it reduces to your (sum r_i)/N -- which is the special case you were remembering.', now() - interval '8 days 11 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, kenji, 1), (a1, weijie, 1), (a1, sofia, 1), (a1, drlim, 1) on conflict do nothing;

  -- Q: what is conserved in a totally inelastic collision. Wrong comment corrected.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (sofia, subj_phys,
    'Totally inelastic collision: what is conserved and what is not?',
    E'A mass sticks to a rod after hitting it (totally inelastic). Which quantities are conserved through the collision -- momentum, kinetic energy, both?',
    'resolved', 143, now() - interval '6 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, aisha, E'Linear momentum is conserved, and (about a fixed axis) angular momentum is conserved. Kinetic energy is NOT conserved in an inelastic collision -- some of it goes into deformation, heat and sound. "Totally inelastic" just means the objects stick together afterward; it is the maximum-KE-loss case consistent with momentum conservation.',
     now() - interval '5 days 18 hours') returning id into a1;
  update public.questions set preferred_answer_id = a1 where id = q;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a1, kenji, E'But energy is always conserved, so isn''t kinetic energy conserved too?', now() - interval '5 days 14 hours'),
    (a1, priya, E'Total energy is conserved, yes -- but it changes FORM. The lost kinetic energy becomes heat/sound/deformation, so KINETIC energy specifically is not conserved. Only momentum is.', now() - interval '5 days 12 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, kenji, 1), (a1, priya, 1), (a1, drlim, 1) on conflict do nothing;

  -- Q: what is a Lagrangian. Conceptual, single answer.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (daniel, subj_phys,
    'In simple terms, what is the Lagrangian and what is it used for?',
    E'The mechanics problem set keeps saying "write the Lagrangian". What actually is it, and how do I go from it to the equations of motion?',
    'answered', 88, now() - interval '5 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, marcus, E'The Lagrangian is L = T - V: kinetic energy minus potential energy, written in terms of your chosen (generalized) coordinates. You then plug it into the Euler-Lagrange equation, d/dt(dL/dq_dot) - dL/dq = 0, for each coordinate q, and that spits out the equations of motion -- often far more cleanly than Newton''s laws for constrained systems.',
     now() - interval '4 days 15 hours') returning id into a1;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, daniel, 1), (a1, aisha, 1), (a1, drlim, 1) on conflict do nothing;

  ------------------------------------------------------------------ BIOLOGY
  -- Q: allele / dominant / recessive. The "recessive = weaker" misconception corrected by lecturer.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (priya, subj_bio,
    'What exactly is an allele, and what do dominant and recessive mean?',
    E'I can use the words dominant and recessive in a Punnett square but I am not sure I actually understand them. What is an allele, and does "recessive" mean the allele is weaker?',
    'resolved', 205, now() - interval '12 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, aisha, E'An allele is one of the alternative versions of a gene at a given locus -- e.g. a gene for flower colour might have a purple allele and a white allele. You inherit one from each parent. "Dominant" means the allele''s trait shows even in a heterozygote (one copy, Aa); "recessive" means the trait only shows when you have two copies (aa), because a single dominant copy masks it.',
     now() - interval '11 days 18 hours') returning id into a1;
  update public.questions set preferred_answer_id = a1 where id = q;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a1, daniel, E'So recessive = the weaker allele, and dominant = the stronger one?', now() - interval '11 days 14 hours'),
    (a1, drlim,  E'This is the most common misconception in genetics: recessive does NOT mean weaker. It only describes how the allele is EXPRESSED -- its effect is masked when a dominant allele is also present. A recessive allele can code for a perfectly functional (or a very serious) trait; "recessive" is about inheritance pattern, not strength.', now() - interval '11 days 11 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, daniel, 1), (a1, weijie, 1), (a1, sofia, 1), (a1, kenji, 1), (a1, drlim, 1) on conflict do nothing;

  -- Q: what is PCR. Factual, strong answer.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (kenji, subj_bio,
    'What is PCR, and what can real-time PCR measure that ordinary PCR cannot?',
    E'I understand PCR copies DNA, but what are the actual steps, and what is the difference between standard PCR and "real-time" (qPCR)?',
    'answered', 129, now() - interval '7 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, sofia, E'PCR (polymerase chain reaction) amplifies a specific DNA region exponentially through repeated cycles of: denaturation (heat splits the strands), annealing (primers bind the target), and extension (polymerase copies it). Standard PCR only tells you the FINAL amount (end-point). Real-time / quantitative PCR measures the product as it accumulates each cycle, so it can quantify how much target DNA (or, via reverse transcription, RNA) was there to start with.',
     now() - interval '6 days 16 hours') returning id into a1;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, kenji, 1), (a1, aisha, 1), (a1, drlim, 1) on conflict do nothing;

  -- Q: what is epigenetics. Wrong comment corrected.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (marcus, subj_bio,
    'What is epigenetics, in one clear explanation?',
    E'Epigenetics gets thrown around a lot. Does it mean changes to the DNA sequence, or something else? A concrete example would help.',
    'resolved', 114, now() - interval '8 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, priya, E'Epigenetics is heritable changes in gene EXPRESSION that do NOT change the underlying DNA sequence. The classic mechanisms are DNA methylation and histone modification, which switch genes on or off without editing the letters of the code. Example: two cells with identical DNA (a neuron and a skin cell) behave completely differently because of their epigenetic marks.',
     now() - interval '7 days 16 hours') returning id into a1;
  update public.questions set preferred_answer_id = a1 where id = q;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a1, daniel, E'So epigenetics is basically mutations that get inherited?', now() - interval '7 days 12 hours'),
    (a1, aisha,  E'Not quite -- mutations change the DNA sequence itself. Epigenetic marks sit ON TOP of the DNA and change whether genes are read, without altering the sequence. That is the key distinction.', now() - interval '7 days 10 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, daniel, 1), (a1, marcus, 1), (a1, drlim, 1) on conflict do nothing;

  -- Q: gene vs genome vs chromosome. Factual.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (aisha, subj_bio,
    'Difference between a gene, a genome, and a chromosome?',
    E'These three terms keep getting muddled in my notes. Can someone lay out clearly how a gene, a chromosome and a genome relate to each other?',
    'answered', 97, now() - interval '5 days')
  returning id into q;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, weijie, E'Think of scale. A GENE is a segment of DNA that codes for a product (a protein or functional RNA) -- the smallest unit here. A CHROMOSOME is a single long DNA molecule packaged with proteins, carrying many genes. The GENOME is the complete set of an organism''s DNA -- all chromosomes together. So: genes sit on chromosomes, and all the chromosomes make up the genome.',
     now() - interval '4 days 14 hours') returning id into a1;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a1, aisha, 1), (a1, priya, 1), (a1, kenji, 1) on conflict do nothing;

  -- A couple of fresh OPEN questions (no answers) so the feed shows live activity.
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at) values
    (daniel, subj_phys, 'Noether''s theorem: how do I spot the conserved quantity from a symmetry?',
     E'For a Lagrangian with rotational symmetry about the z-axis, I know something is conserved -- but how do I actually identify WHICH quantity from the symmetry? Trying to build the intuition.',
     'open', 23, now() - interval '5 hours'),
    (sofia, subj_bio, 'Difference between "orthologous" and "paralogous" genes?',
     E'Both come up when comparing sequences across species. What is the precise difference, and why does it matter for inferring gene function?',
     'open', 17, now() - interval '11 hours'),
    (marcus, subj_chem, 'When is a ligand-exchange reaction associative vs dissociative?',
     E'How do I predict whether a metal complex undergoes associative or dissociative substitution? Is it mostly about coordination number and electron count?',
     'open', 20, now() - interval '3 hours');

  raise notice 'Viva forum seed: 8 users, subjects (chem/phys/bio), ~18 threads with answers, comments, votes.';
end $$;
