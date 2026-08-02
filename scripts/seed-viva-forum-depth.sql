-- seed-viva-forum-depth.sql
-- Run AFTER seed-viva-forum.sql. Makes the seeded threads look lived-in:
--   * 2-4 answers per thread instead of 1 (different approaches, some weaker)
--   * comment threads hanging off the SECOND/THIRD answer, not just the top one
--   * Dr. Lim (verified lecturer) verifies strong answers and disputes weak ones
--   * AI tutor answers (source='ai', author_id=null -> renders as "AI tutor"):
--       - 3 verified by the lecturer
--       - 2 disputed by the lecturer (they contain real, plausible errors)
--       - 4 left with NO verdict, so you can Accept/Decline them LIVE in the viva
--
-- Run in the Supabase SQL editor. Idempotent: skips if its marker answer exists.
-- Note: answers.score is maintained by the answer_votes trigger, never set it here.

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
  q uuid; a1 uuid; a2 uuid; a3 uuid;
begin
  -- Guard on a marker unique to THIS script. Do not guard on source='ai':
  -- earlier manual testing already left AI answers on the old test threads.
  if exists (select 1 from public.answers where body like 'Another way to see it without calculus:%') then
    raise notice 'Depth seed already present, skipping.';
    return;
  end if;

  ---------------------------------------------------------------- CALCULUS: tangent
  select id into q from public.questions where title = 'Finding the tangent line to y = x^2 at the point (1,1)';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, marcus, E'Another way to see it without calculus: substitute y = mx + c into y = x^2 and demand a repeated root. x^2 - mx - c = 0 has a double root when m^2 + 4c = 0. Forcing it through (1,1) gives c = 1 - m, so m^2 - 4m + 4 = 0, (m-2)^2 = 0, m = 2. Same answer, y = 2x - 1 -- the "touches at exactly one point" condition IS the tangent condition.',
     now() - interval '8 days 6 hours') returning id into a2;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, kenji, E'Just plug x = 1 into the derivative and you get the answer, y = 2x. That is the tangent.',
     now() - interval '8 days 4 hours') returning id into a3;

  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, sofia,  E'This is a really nice check. So the discriminant being zero is exactly "the line meets the curve once"?', now() - interval '8 days 3 hours'),
    (a2, marcus, E'Exactly. For a parabola the tangent is the unique line through the point that meets it with multiplicity two. Calculus and the discriminant agree here.', now() - interval '8 days 2 hours'),
    (a3, priya,  E'y = 2x has the right slope but it does not pass through (1,1) -- at x = 1 it gives y = 2, not 1. You still need the constant: y - 1 = 2(x - 1) -> y = 2x - 1.', now() - interval '8 days 1 hour'),
    (a3, kenji,  E'You are right, I forgot the point entirely. Slope alone is not a line.', now() - interval '8 days');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, weijie, 1), (a2, sofia, 1), (a2, aisha, 1), (a2, drlim, 1),
    (a3, priya, -1), (a3, daniel, -1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a1, drlim, 'verified', E'Correct and clearly set out. Differentiate, evaluate the slope at the point, then use point-slope -- that is the whole method.', now() - interval '7 days 20 hours'),
    (a3, drlim, 'disputed', E'The slope of 2 is right but y = 2x is not the tangent: it misses the point (1,1). Always substitute the point back to fix the constant.', now() - interval '7 days 19 hours')
    on conflict do nothing;

  -- AI answer, VERIFIED by the lecturer
  insert into public.answers (question_id, author_id, source, body, created_at) values
    (q, null, 'ai', E'Here is the general method. The tangent at a point needs two ingredients: the slope there, and the point itself. Step 1, differentiate: for y = x^2, dy/dx = 2x. Step 2, evaluate at x = 1: the slope is 2. Step 3, use point-slope form through (1,1): y - 1 = 2(x - 1), so y = 2x - 1. The reason it is not y = x^2 is that a tangent is a straight line which agrees with the curve in value and in slope at that one point -- it does not follow the curve away from it.',
     now() - interval '8 days 16 hours') returning id into a3;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a3, drlim, 'verified', E'Accurate, and the three-step structure is exactly how I want students to lay this out.', now() - interval '7 days 18 hours') on conflict do nothing;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a3, weijie, 1), (a3, kenji, 1), (a3, sofia, 1) on conflict do nothing;

  ---------------------------------------------------------------- CALCULUS: at rest
  select id into q from public.questions where title = 'Kinematics: at what times is a body with y(t) = t - sin(t) at rest?';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, priya, E'Worth adding the sanity check: v(t) = 1 - cos(t) is never negative, because cos(t) never exceeds 1. So the body never reverses -- it only pauses instantaneously at t = 0, 2pi, 4pi, ... and then keeps moving forward. Those are stationary points of the displacement, not turning points.',
     now() - interval '5 days 14 hours') returning id into a2;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, kenji, E'That helps -- I assumed "at rest" meant it turns around, like a ball at the top of its flight.', now() - interval '5 days 10 hours'),
    (a2, priya, E'Common trap. Velocity zero means it stopped; whether it turns depends on whether v changes SIGN. Here it does not.', now() - interval '5 days 9 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, kenji, 1), (a2, daniel, 1), (a2, drlim, 1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a1, drlim, 'verified', E'Right. "At rest" is always a velocity condition.', now() - interval '5 days 8 hours'),
    (a2, drlim, 'verified', E'Good extension -- distinguishing a stationary point from a turning point is exactly the follow-up marks.', now() - interval '5 days 7 hours')
    on conflict do nothing;

  ---------------------------------------------------------------- CALCULUS: slope of 4x + e^x
  select id into q from public.questions where title = 'What is the slope of y = 4x + e^x at the point (0,1)?';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, weijie, E'Also worth noting why the point (0,1) is consistent: y(0) = 4(0) + e^0 = 1, so (0,1) really is on the curve. If it were not, the question would be ill-posed. Slope 5, and the tangent there is y = 5x + 1.',
     now() - interval '3 days 14 hours') returning id into a2;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, sofia, E'I never think to check the point is actually on the curve. Adding that to my checklist.', now() - interval '3 days 10 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, sofia, 1), (a2, drlim, 1) on conflict do nothing;

  -- AI answer, VERIFIED
  insert into public.answers (question_id, author_id, source, body, created_at) values
    (q, null, 'ai', E'Yes -- e^x is the function that is its own derivative, which is what makes it special. So differentiating term by term: d/dx(4x) = 4 and d/dx(e^x) = e^x, giving dy/dx = 4 + e^x. Evaluating at x = 0 and using e^0 = 1, the slope is 4 + 1 = 5. A useful check: near x = 0 the curve should climb a little faster than the line y = 4x, and it does, because the e^x term contributes an extra 1 to the slope.',
     now() - interval '3 days 18 hours') returning id into a3;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a3, drlim, 'verified', E'Correct, including the e^0 = 1 step that students most often drop.', now() - interval '3 days 8 hours') on conflict do nothing;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a3, sofia, 1), (a3, weijie, 1), (a3, marcus, 1) on conflict do nothing;

  ---------------------------------------------------------------- CALCULUS: acceleration
  select id into q from public.questions where title = 'Acceleration of a particle with y(t) = 3t^3 + 4t + 1 at t = 4 s';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, kenji, E'A way to keep them straight: displacement -> differentiate -> velocity -> differentiate -> acceleration. Each derivative is "rate of change of the thing above it". So y = 3t^3 + 4t + 1, v = 9t^2 + 4, a = 18t. Notice the constant 1 disappears after one derivative and the 4t after two -- only the cubic term survives to affect acceleration.',
     now() - interval '6 days 10 hours') returning id into a2;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, priya,  E'The chain of "rate of change of the thing above" finally made this click for me.', now() - interval '6 days 8 hours'),
    (a2, daniel, E'Does that mean a constant acceleration would need y to be quadratic in t?', now() - interval '6 days 7 hours'),
    (a2, kenji,  E'Exactly -- y = ut + (1/2)at^2 differentiates twice down to the constant a. That is where the suvat formula comes from.', now() - interval '6 days 6 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, priya, 1), (a2, daniel, 1), (a2, aisha, 1), (a2, drlim, 1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a1, drlim, 'verified', E'Correct: 72 m/s^2.', now() - interval '6 days 5 hours') on conflict do nothing;

  ---------------------------------------------------------------- LINEAR ALGEBRA: 2x2 inverse
  select id into q from public.questions where title = 'How do I find the inverse of the 2x2 matrix [[1, -1], [2, 1]]?';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, aisha, E'If you would rather not memorise the adjugate formula, row-reduce [A | I] to [I | A^-1]. Start with [1 -1 | 1 0; 2 1 | 0 1]. R2 -> R2 - 2*R1 gives [1 -1 | 1 0; 0 3 | -2 1]. R2 -> R2/3 gives [1 -1 | 1 0; 0 1 | -2/3 1/3]. R1 -> R1 + R2 gives [1 0 | 1/3 1/3; 0 1 | -2/3 1/3]. So A^-1 = (1/3)[[1, 1], [-2, 1]] -- matching the formula, and this method generalises to any size.',
     now() - interval '10 days 8 hours') returning id into a2;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, sofia, E'Quick shortcut: just swap the diagonal and flip the signs of the off-diagonal, so [[1, 1], [-2, 1]]. That is the inverse.',
     now() - interval '10 days 6 hours') returning id into a3;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, daniel, E'Row reduction is slower but I can actually follow every step. Thanks for writing them all out.', now() - interval '10 days 5 hours'),
    (a2, marcus, E'And it is the only method that still works at 3x3 and above, so it is worth the practice.', now() - interval '10 days 4 hours'),
    (a3, priya,  E'That is the adjugate but you dropped the 1/det factor. Without dividing by 3 the product A * [[1,1],[-2,1]] gives 3I, not I.', now() - interval '10 days 3 hours'),
    (a3, sofia,  E'Ah, so the swap-and-flip is only half the recipe. Noted.', now() - interval '10 days 2 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, daniel, 1), (a2, marcus, 1), (a2, weijie, 1), (a2, drlim, 1),
    (a3, priya, -1), (a3, kenji, -1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a1, drlim, 'verified', E'Correct throughout, and the determinant sign is handled properly.', now() - interval '10 days 1 hour'),
    (a2, drlim, 'verified', E'Gauss-Jordan on the augmented matrix -- this is the method I would rather you learned, since it scales past 2x2.', now() - interval '10 days'),
    (a3, drlim, 'disputed', E'The adjugate is right but the 1/det factor is missing. Check your answer by multiplying it back: you should get the identity, and here you get 3I.', now() - interval '9 days 22 hours')
    on conflict do nothing;

  ---------------------------------------------------------------- LINEAR ALGEBRA: symmetric + skew
  select id into q from public.questions where title = 'Express a square matrix as a sum of a symmetric and a skew-symmetric matrix';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, daniel, E'Concrete example so you can see it working. Take A = [[1, 2], [0, 3]]. Then A^T = [[1, 0], [2, 3]]. S = (1/2)(A + A^T) = [[1, 1], [1, 3]] which is symmetric, and K = (1/2)(A - A^T) = [[0, 1], [-1, 0]] which is skew. Add them: [[1, 2], [0, 3]] = A. The decomposition is also unique, which is the part the question usually asks you to prove next.',
     now() - interval '4 days 12 hours') returning id into a2;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, weijie, E'Seeing actual numbers made the algebra obvious. How do you prove uniqueness?', now() - interval '4 days 10 hours'),
    (a2, daniel, E'Suppose A = S + K with S symmetric and K skew. Transpose it: A^T = S - K. Adding and subtracting the two equations forces S = (A + A^T)/2 and K = (A - A^T)/2, so there is no other choice.', now() - interval '4 days 9 hours'),
    (a2, marcus, E'Neat -- the proof is basically the construction run backwards.', now() - interval '4 days 8 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, weijie, 1), (a2, marcus, 1), (a2, drlim, 1) on conflict do nothing;

  -- AI answer, NO VERDICT YET -- accept/decline this one live in the viva
  insert into public.answers (question_id, author_id, source, body, created_at) values
    (q, null, 'ai', E'There is a standard construction. For any square matrix A, define S = (1/2)(A + A^T) and K = (1/2)(A - A^T). Then S^T = (1/2)(A^T + A) = S, so S is symmetric, and K^T = (1/2)(A^T - A) = -K, so K is skew-symmetric. Adding them, S + K = (1/2)(A + A^T) + (1/2)(A - A^T) = A, because the transpose terms cancel. So every square matrix splits into a symmetric part and a skew-symmetric part, and this splitting is unique.',
     now() - interval '4 days 4 hours') returning id into a3;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a3, weijie, 1), (a3, daniel, 1) on conflict do nothing;

  ---------------------------------------------------------------- CHEMISTRY: first law
  select id into q from public.questions where title = 'First law: system loses 250 kJ of heat and does 500 kJ of work -- find delta U';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, weijie, E'A trick that stops the sign confusion: ask "did energy enter or leave the system?" for each term, then just add signed numbers. Heat lost -> energy leaves -> -250 kJ. Work done BY the system -> energy leaves -> -500 kJ. Total change = -750 kJ. You get the same answer as delta U = q - w without having to remember which convention your textbook uses.',
     now() - interval '9 days 8 hours') returning id into a2;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, daniel, E'Careful with textbooks here: some physics texts write the first law as delta U = q + w, where w is work done ON the system. Under that convention w = -500 kJ and you still get delta U = -250 + (-500) = -750 kJ. The number never changes -- only the bookkeeping does. Always check which convention your paper uses before plugging in.',
     now() - interval '9 days 6 hours') returning id into a3;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, sofia,  E'The "did energy enter or leave" question is much easier to hold in my head than the formula.', now() - interval '9 days 5 hours'),
    (a3, kenji,  E'This explains why I kept getting a different sign to my textbook. Two conventions, same physics.', now() - interval '9 days 4 hours'),
    (a3, drlim,  E'Very good point to raise. In this module we use delta U = q - w with w as work done BY the system, but you should be able to convert between the two.', now() - interval '9 days 3 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, sofia, 1), (a2, kenji, 1), (a2, drlim, 1),
    (a3, kenji, 1), (a3, marcus, 1), (a3, aisha, 1), (a3, drlim, 1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a1, drlim, 'verified', E'Correct: -750 kJ, with the sign convention handled properly.', now() - interval '9 days 2 hours'),
    (a3, drlim, 'verified', E'Exactly right, and worth everyone reading -- the convention clash costs marks every year.', now() - interval '9 days 1 hour')
    on conflict do nothing;

  ---------------------------------------------------------------- CHEMISTRY: bitter almonds
  select id into q from public.questions where title = 'Which compound is known as "oil of bitter almonds"?';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, marcus, E'To separate the two in future: benzaldehyde is C6H5-CHO, an aldehyde group straight onto the ring. Cinnamaldehyde is C6H5-CH=CH-CHO -- there is a two-carbon alkene bridge before the CHO, which is why it is the larger, spicier-smelling one. Ring plus CHO with nothing in between = bitter almonds.',
     now() - interval '2 days 16 hours') returning id into a2;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, sofia,  E'The structural difference is what I needed -- I was trying to memorise the names with no hook.', now() - interval '2 days 12 hours'),
    (a2, kenji,  E'Also worth knowing benzaldehyde is what you smell in almond extract and in apricot kernels.', now() - interval '2 days 10 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, sofia, 1), (a2, kenji, 1), (a2, priya, 1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a1, drlim, 'verified', E'Benzaldehyde is correct.', now() - interval '2 days 8 hours') on conflict do nothing;

  ---------------------------------------------------------------- CHEMISTRY: activation energy
  select id into q from public.questions where title = 'How do you get the activation energy Ea from a graph?';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, aisha, E'Practical version for the lab report: measure the rate constant k at several temperatures, tabulate ln(k) and 1/T (T in KELVIN, not Celsius -- this is the single most common error), plot ln(k) on y against 1/T on x, fit a straight line, take the gradient, and then Ea = -gradient * R with R = 8.314 J/mol/K. The gradient is negative, so Ea comes out positive.',
     now() - interval '7 days 8 hours') returning id into a2;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, marcus, E'The Kelvin warning just saved my coursework. I had degrees Celsius in the spreadsheet.', now() - interval '7 days 6 hours'),
    (a2, kenji,  E'And the units of Ea come out in J/mol with R in J/mol/K -- divide by 1000 if the mark scheme wants kJ/mol.', now() - interval '7 days 5 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, marcus, 1), (a2, kenji, 1), (a2, daniel, 1), (a2, drlim, 1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a1, drlim, 'verified', E'Correct: ln(k) against 1/T, gradient -Ea/R.', now() - interval '7 days 4 hours'),
    (a2, drlim, 'verified', E'The Kelvin point deserves the emphasis. I see this error in almost every submitted Arrhenius plot.', now() - interval '7 days 3 hours')
    on conflict do nothing;

  ---------------------------------------------------------------- CHEMISTRY: CO2 symmetry
  select id into q from public.questions where title = 'What is the point/symmetry group of the CO2 molecule?';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, sofia, E'The practical consequence worth remembering: because CO2 has a centre of inversion, the symmetric stretch is IR-INACTIVE (no dipole change) but Raman-active, while the asymmetric stretch and the bends are IR-active. Water, being C2v with no inversion centre, has all three modes IR-active. So the symmetry label directly predicts what you will see in the spectrum.',
     now() - interval '3 days 8 hours') returning id into a2;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, aisha, E'So the group theory is not just labelling, it actually tells you which peaks appear?', now() - interval '3 days 6 hours'),
    (a2, sofia, E'Right -- that is the whole reason the course teaches it. The mutual exclusion rule for centrosymmetric molecules comes straight out of the point group.', now() - interval '3 days 5 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, aisha, 1), (a2, kenji, 1), (a2, drlim, 1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a2, drlim, 'verified', E'Excellent -- linking the point group to IR/Raman selection rules is exactly the connection I want you making.', now() - interval '3 days 4 hours') on conflict do nothing;

  ---------------------------------------------------------------- PHYSICS: centre of mass
  select id into q from public.questions where title = 'Correct formula for the centre of mass of N point masses';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, priya, E'Two-mass example to make it concrete. Put m1 = 1 kg at x = 0 and m2 = 3 kg at x = 4 m. The mass-weighted formula gives X = (1*0 + 3*4)/(1+3) = 12/4 = 3 m, sitting close to the heavy mass as you would expect. The plain average of positions would give 2 m, exactly halfway, which is clearly wrong once the masses differ.',
     now() - interval '8 days 8 hours') returning id into a2;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, daniel, E'For a continuous body the sum becomes an integral: R = (1/M) * integral of r dm, with M = integral of dm. Same idea -- weight each bit of position by the mass sitting there -- just with infinitely many pieces.',
     now() - interval '8 days 6 hours') returning id into a3;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, kenji,  E'The numbers make the mistake obvious. 3 m vs 2 m is a big difference.', now() - interval '8 days 5 hours'),
    (a2, weijie, E'And it explains why a hammer balances near the head rather than in the middle of the handle.', now() - interval '8 days 4 hours'),
    (a3, sofia,  E'Is that how you would do a uniform rod, then? Integrating x dm over the length?', now() - interval '8 days 3 hours'),
    (a3, daniel, E'Yes -- for a uniform rod dm = (M/L) dx and the integral gives the midpoint, which matches intuition.', now() - interval '8 days 2 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, kenji, 1), (a2, weijie, 1), (a2, sofia, 1), (a2, drlim, 1),
    (a3, sofia, 1), (a3, marcus, 1), (a3, drlim, 1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a2, drlim, 'verified', E'The worked example is the fastest way to kill the "just average the positions" habit.', now() - interval '8 days 1 hour') on conflict do nothing;

  -- AI answer, VERIFIED
  insert into public.answers (question_id, author_id, source, body, created_at) values
    (q, null, 'ai', E'The centre of mass R of point masses m_1..m_N at positions r_1..r_N is the mass-weighted average of the positions: R = (m_1*r_1 + m_2*r_2 + ... + m_N*r_N) / (m_1 + m_2 + ... + m_N), which is usually written R = (1/M) * sum over i of m_i * r_i, with M = sum of m_i the total mass. This is a vector equation, so in practice you apply it component by component: X = (1/M) sum m_i x_i, and similarly for Y and Z. Only when every mass is equal do the masses cancel and reduce it to the plain average of the positions.',
     now() - interval '8 days 15 hours') returning id into a3;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a3, drlim, 'verified', E'Correct, and it flags the equal-mass special case rather than presenting the plain average as general. Safe to rely on.', now() - interval '8 days') on conflict do nothing;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a3, weijie, 1), (a3, kenji, 1), (a3, priya, 1) on conflict do nothing;

  ---------------------------------------------------------------- PHYSICS: inelastic collision
  select id into q from public.questions where title = 'Totally inelastic collision: what is conserved and what is not?';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, marcus, E'Numbers make it undeniable. A 2 kg block at 3 m/s hits a stationary 2 kg block and they stick. Momentum: 2*3 = 6 kg m/s before, so the combined 4 kg moves at 1.5 m/s after -- momentum conserved. Kinetic energy: before = (1/2)(2)(3^2) = 9 J, after = (1/2)(4)(1.5^2) = 4.5 J. Exactly half the kinetic energy is gone, into heat and deformation. Momentum survives, kinetic energy does not.',
     now() - interval '5 days 10 hours') returning id into a2;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, kenji, E'Losing exactly half is a striking result. Is that always the case?', now() - interval '5 days 8 hours'),
    (a2, marcus, E'Only for equal masses with one initially at rest. In general the fraction depends on the mass ratio, but some KE is always lost unless the collision is elastic.', now() - interval '5 days 7 hours'),
    (a2, drlim,  E'And note the rod version in your problem sheet is the angular analogue: angular momentum about the pivot is conserved, rotational kinetic energy is not.', now() - interval '5 days 6 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, kenji, 1), (a2, sofia, 1), (a2, aisha, 1), (a2, drlim, 1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a1, drlim, 'verified', E'Correct.', now() - interval '5 days 5 hours'),
    (a2, drlim, 'verified', E'The worked numbers are the clearest possible demonstration. Use this approach in the exam if you are unsure.', now() - interval '5 days 4 hours')
    on conflict do nothing;

  -- AI answer, DISPUTED by the lecturer (contains a real error)
  insert into public.answers (question_id, author_id, source, body, created_at) values
    (q, null, 'ai', E'In a totally inelastic collision the two objects stick together and move as one afterward. Because energy is always conserved in an isolated system, both momentum and kinetic energy are conserved through the collision -- the combined object simply carries the same total kinetic energy at a lower speed because its mass is larger. You can therefore solve these problems by setting the total kinetic energy before equal to the total kinetic energy after.',
     now() - interval '5 days 16 hours') returning id into a3;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a3, drlim, 'disputed', E'This is wrong and would cost you the whole question. TOTAL energy is conserved; KINETIC energy is not -- that is the definition of an inelastic collision. Solve these with momentum conservation only. Please use the community answers above instead.', now() - interval '5 days 12 hours') on conflict do nothing;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a3, marcus, -1), (a3, priya, -1), (a3, aisha, -1) on conflict do nothing;

  ---------------------------------------------------------------- PHYSICS: Lagrangian
  select id into q from public.questions where title = 'In simple terms, what is the Lagrangian and what is it used for?';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, aisha, E'Smallest useful example: a simple pendulum. Coordinate is the angle theta. Kinetic energy T = (1/2) m L^2 theta_dot^2, potential V = -m g L cos(theta), so L = T - V. Euler-Lagrange gives m L^2 theta_doubledot = -m g L sin(theta), i.e. theta_doubledot = -(g/L) sin(theta) -- the pendulum equation, with no free-body diagram and no tension to worry about. The constraint force drops out automatically, and that is the real selling point.',
     now() - interval '4 days 10 hours') returning id into a2;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, daniel, E'Not having to resolve the tension is exactly why I wanted to learn this. Newton gets messy fast with constraints.', now() - interval '4 days 8 hours'),
    (a2, weijie, E'Does the choice of coordinate matter? Could you use arc length instead of theta?', now() - interval '4 days 7 hours'),
    (a2, aisha,  E'You can use any coordinates that describe the configuration -- that is the point of "generalized". Arc length s = L*theta works and gives the same physics.', now() - interval '4 days 6 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, daniel, 1), (a2, weijie, 1), (a2, marcus, 1), (a2, drlim, 1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a2, drlim, 'verified', E'The pendulum is the right first example, and the observation about constraint forces dropping out is the key insight.', now() - interval '4 days 5 hours') on conflict do nothing;

  ---------------------------------------------------------------- BIOLOGY: allele
  select id into q from public.questions where title = 'What exactly is an allele, and what do dominant and recessive mean?';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, sofia, E'A counterexample that kills the "recessive = weak" idea for good: Huntington''s disease is caused by a DOMINANT allele and is devastating, while cystic fibrosis is caused by a RECESSIVE allele and is also severe. Meanwhile plenty of harmless traits are recessive too. Dominance says nothing about how strong or harmful the trait is -- only about whether one copy is enough to show it.',
     now() - interval '11 days 8 hours') returning id into a2;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, marcus, E'Mechanistically, many recessive alleles are simply loss-of-function: the gene makes no working product. You get away with one broken copy because the remaining good copy makes enough product -- that is why the trait only appears when BOTH copies are broken. So "recessive" is often about dosage, not weakness.',
     now() - interval '11 days 6 hours') returning id into a3;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, daniel, E'Huntington''s being dominant completely breaks the mental model I had. Thanks.', now() - interval '11 days 5 hours'),
    (a3, priya,  E'So a heterozygote is basically running on half production and that is usually enough?', now() - interval '11 days 4 hours'),
    (a3, marcus, E'Usually. When half is NOT enough you get haploinsufficiency, and the condition looks dominant instead. That is the exception worth knowing.', now() - interval '11 days 3 hours'),
    (a3, drlim,  E'Good -- that is a second-year concept and you have it right.', now() - interval '11 days 2 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, daniel, 1), (a2, priya, 1), (a2, kenji, 1), (a2, drlim, 1),
    (a3, priya, 1), (a3, sofia, 1), (a3, drlim, 1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a1, drlim, 'verified', E'Accurate definition of allele, dominant and recessive.', now() - interval '11 days 1 hour'),
    (a2, drlim, 'verified', E'The Huntington''s/cystic fibrosis pairing is the example I use in lectures for exactly this reason.', now() - interval '11 days')
    on conflict do nothing;

  -- AI answer, DISPUTED -- reproduces the exact misconception, good demo of why review matters
  insert into public.answers (question_id, author_id, source, body, created_at) values
    (q, null, 'ai', E'An allele is a version of a gene, and you inherit one from each parent. Dominant and recessive describe which version wins when the two differ: the dominant allele is the stronger one and overrides the weaker recessive allele, which is why the dominant trait is the one you see. A recessive allele produces a weaker version of the protein, so it can only show its effect when there is no stronger allele present to overpower it.',
     now() - interval '11 days 16 hours') returning id into a3;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a3, drlim, 'disputed', E'Rejecting this one. "Stronger" and "weaker" alleles is the misconception this whole thread is trying to correct -- recessive describes an inheritance pattern, not protein strength, and many recessive alleles produce no protein at all rather than a weak one. Read the verified answers above.', now() - interval '11 days 12 hours') on conflict do nothing;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a3, aisha, -1), (a3, sofia, -1), (a3, marcus, -1), (a3, priya, -1) on conflict do nothing;

  ---------------------------------------------------------------- BIOLOGY: PCR
  select id into q from public.questions where title = 'What is PCR, and what can real-time PCR measure that ordinary PCR cannot?';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, kenji, E'Typical cycling numbers for your write-up: denature around 95 C, anneal around 50-65 C depending on your primers, extend around 72 C for Taq polymerase, repeated 25-40 times. Each cycle roughly doubles the target, so 30 cycles is about 2^30 -- that is the exponential amplification everyone talks about.',
     now() - interval '6 days 12 hours') returning id into a2;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, daniel, E'On the qPCR side, the number you actually report is Cq (or Ct), the cycle at which fluorescence crosses a threshold. More starting template means it crosses earlier, so a LOWER Cq means MORE target. That inverse relationship trips people up constantly in the lab report.',
     now() - interval '6 days 10 hours') returning id into a3;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, sofia,  E'Adding the temperatures makes this actually usable for the methods section, thanks.', now() - interval '6 days 8 hours'),
    (a3, kenji,  E'Lower Cq = more DNA. I definitely had that backwards in my draft.', now() - interval '6 days 7 hours'),
    (a3, aisha,  E'It follows from the exponential: fewer doublings needed to reach the threshold if you started with more.', now() - interval '6 days 6 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, sofia, 1), (a2, priya, 1), (a2, drlim, 1),
    (a3, kenji, 1), (a3, aisha, 1), (a3, sofia, 1), (a3, drlim, 1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a3, drlim, 'verified', E'The inverse Cq relationship is worth memorising -- it is the most common misreading in submitted qPCR data.', now() - interval '6 days 5 hours') on conflict do nothing;

  -- AI answer, VERIFIED
  insert into public.answers (question_id, author_id, source, body, created_at) values
    (q, null, 'ai', E'PCR amplifies a chosen stretch of DNA through repeated thermal cycles, each with three stages: denaturation, where heat separates the double strand; annealing, where short primers bind either side of the target and define what gets copied; and extension, where a heat-stable DNA polymerase builds the new strands. Each cycle roughly doubles the target, so the amount grows exponentially. Conventional PCR is end-point: you run the reaction to completion and then look at the product on a gel, which tells you whether the target was present but not reliably how much you started with. Real-time (quantitative) PCR adds a fluorescent reporter and measures signal after every cycle, so the cycle at which fluorescence rises above background reflects the starting quantity -- letting you quantify the original template rather than just detect it.',
     now() - interval '6 days 15 hours') returning id into a3;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a3, drlim, 'verified', E'Accurate on both the three stages and the end-point versus real-time distinction. Fine to use as a starting point.', now() - interval '6 days 4 hours') on conflict do nothing;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a3, kenji, 1), (a3, sofia, 1), (a3, daniel, 1) on conflict do nothing;

  ---------------------------------------------------------------- BIOLOGY: epigenetics
  select id into q from public.questions where title = 'What is epigenetics, in one clear explanation?';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, kenji, E'The analogy that made it stick for me: the DNA sequence is the text of a book, and epigenetic marks are the highlighting and the sticky notes saying "skip this chapter". The words are untouched -- what changes is which parts get read. Methylation of a promoter is roughly a sticky note reading "do not read", and histone modification is roughly how tightly the pages are glued shut.',
     now() - interval '7 days 8 hours') returning id into a2;
  insert into public.answers (question_id, author_id, body, created_at) values
    (q, sofia, E'Concrete case: agouti mice. Genetically identical mice end up yellow and obese or brown and lean depending on how heavily one gene is methylated, and the mother''s diet during pregnancy shifts that methylation. Same DNA sequence, different coat colour and body weight, purely from epigenetic marks.',
     now() - interval '7 days 6 hours') returning id into a3;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, marcus, E'The book analogy is the first version of this I have actually understood.', now() - interval '7 days 5 hours'),
    (a3, daniel, E'Identical genomes with visibly different mice is a very convincing demonstration.', now() - interval '7 days 4 hours'),
    (a3, drlim,  E'Agouti is the standard teaching example for exactly that reason. Note the marks are reversible, which is what separates them from mutation.', now() - interval '7 days 3 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, marcus, 1), (a2, daniel, 1), (a2, priya, 1),
    (a3, daniel, 1), (a3, marcus, 1), (a3, aisha, 1), (a3, drlim, 1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a1, drlim, 'verified', E'Correct: heritable changes in expression without sequence change.', now() - interval '7 days 2 hours'),
    (a3, drlim, 'verified', E'Good use of a real study rather than a hand-wave.', now() - interval '7 days 1 hour')
    on conflict do nothing;

  ---------------------------------------------------------------- BIOLOGY: gene/genome/chromosome
  select id into q from public.questions where title = 'Difference between a gene, a genome, and a chromosome?';
  select id into a1 from public.answers where question_id = q order by created_at limit 1;

  insert into public.answers (question_id, author_id, body, created_at) values
    (q, priya, E'Human numbers to anchor the scales: roughly 20,000 protein-coding genes, sitting on 46 chromosomes (23 pairs), together making up a genome of about 3.1 billion base pairs. So it goes gene -> many genes per chromosome -> all chromosomes together = genome. And note the genome is mostly NOT genes: coding sequence is only a couple of percent of it.',
     now() - interval '4 days 10 hours') returning id into a2;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a2, weijie, E'Only a couple of percent coding? I assumed the genome was basically a list of genes.', now() - interval '4 days 8 hours'),
    (a2, priya,  E'Very common assumption. The rest is regulatory sequence, introns, repeats and so on -- much of it does something, just not by coding for protein.', now() - interval '4 days 7 hours');
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a2, weijie, 1), (a2, aisha, 1), (a2, kenji, 1), (a2, drlim, 1) on conflict do nothing;
  insert into public.answer_verifications (answer_id, lecturer_id, verdict, note, created_at) values
    (a1, drlim, 'verified', E'Clear and correct hierarchy.', now() - interval '4 days 6 hours') on conflict do nothing;

  ---------------------------------------------------- OPEN QUESTIONS: AI answered, AWAITING REVIEW
  -- These three deliberately have NO lecturer verdict so you can Accept/Decline them live.

  select id into q from public.questions where title = 'Noether''s theorem: how do I spot the conserved quantity from a symmetry?';
  insert into public.answers (question_id, author_id, source, body, created_at) values
    (q, null, 'ai', E'The recipe is to find the coordinate that the Lagrangian does NOT depend on. If L is unchanged when you shift a coordinate q, then q is called cyclic or ignorable, and the Euler-Lagrange equation immediately says that the corresponding conjugate momentum, dL/dq_dot, is constant in time. For rotational symmetry about the z-axis, the ignorable coordinate is the azimuthal angle phi: L does not contain phi itself, only phi_dot. So the conserved quantity is dL/dphi_dot, which works out to be the z-component of angular momentum. The pattern generalises: symmetry under time translation gives conservation of energy, under spatial translation gives linear momentum, and under rotation gives angular momentum.',
     now() - interval '3 hours') returning id into a3;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a3, daniel, 1), (a3, marcus, 1) on conflict do nothing;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a3, daniel, E'This looks right to me but I would rather have it checked before I quote it in my assignment.', now() - interval '2 hours');

  select id into q from public.questions where title = 'Difference between "orthologous" and "paralogous" genes?';
  insert into public.answers (question_id, author_id, source, body, created_at) values
    (q, null, 'ai', E'Both are types of homologous gene, meaning they share a common ancestor, but they differ in the event that separated them. Orthologues are separated by a SPECIATION event: the same gene in two different species, such as human and mouse haemoglobin beta. Paralogues are separated by a DUPLICATION event within a genome: two copies in the same organism that then diverged, such as human haemoglobin alpha and beta. This matters for inferring function, because orthologues usually retain the ancestral function, whereas paralogues are freer to pick up a new one -- one copy can keep doing the original job while the other drifts. So when annotating an unknown gene, an orthologue in a well-studied species is the more reliable functional guide.',
     now() - interval '9 hours') returning id into a3;
  insert into public.answer_votes (answer_id, voter_id, value) values
    (a3, sofia, 1) on conflict do nothing;

  select id into q from public.questions where title = 'When is a ligand-exchange reaction associative vs dissociative?';
  insert into public.answers (question_id, author_id, source, body, created_at) values
    (q, null, 'ai', E'The main predictor is how much room there is around the metal. A dissociative pathway, where a ligand leaves first to give a lower-coordinate intermediate, is favoured by high coordination number, bulky ligands, and electron-rich or 18-electron centres that cannot accept another donor. An associative pathway, where an incoming ligand binds first to give a higher-coordinate intermediate, is favoured by low coordination number, small ligands, and coordinatively unsaturated or electron-poor centres with a vacant orbital. Square-planar d8 complexes such as those of Pt(II) are the classic associative case, going through a five-coordinate intermediate; octahedral d6 complexes such as those of Co(III) are typically dissociative. Experimentally you can distinguish them by whether the rate depends on the incoming ligand concentration -- associative rates do, dissociative rates largely do not.',
     now() - interval '1 hour') returning id into a3;
  insert into public.answer_comments (answer_id, author_id, body, created_at) values
    (a3, marcus, E'The rate-dependence test at the end is the bit I was missing. Waiting on a lecturer check before I rely on it.', now() - interval '40 minutes');

  raise notice 'Depth seed done.';
end $$;
