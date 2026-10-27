# Derivative Practice Batch 6: modes, Rule Identification and Career (app.js)

Line numbers come from the version deployed on 22 October 2026. If the code has changed, search for the function named instead.

Fix these four bugs. Read only the lines named. Do not run a browser test. Show me the diff.

1. Remove the `state.mode === 'practice' || state.mode === 'career'` wrapper around the Difficulty section (about
   line 1219) and its closing line (about line 1251), so Difficulty shows in every mode. Keep the Practice Timer's
   own mode test.
2. In Rule Identification, accept every rule a student could fairly pick. Have the generators return a `rules` array:
   about line 607 `['basic', 'quotient']`, 680 and 731 `['product', 'basic']`, 801 `['quotient', 'basic']`. Pass it
   through `generateProblem` (about line 1042) as `rules: gen.rules || [rule]` and check
   `(state.problem.rules || [state.problem.rule]).includes(state.selectedRule)` (about line 1475). Today Basic Rules is
   marked wrong for (-3y^3)(y^3).
3. In Rule Identification, end the prompt with "which rule does this need?" instead of "what is f'(x)?" (about line
   1033).
4. In the Career branch of `setMode` (about line 1351), if the difficulty is above what the level allows
   (easy 1, medium 3, hard 5, very hard 8), drop to the hardest unlocked one. Today Career at Level 1 serves Very hard
   problems and awards 50 XP each.

Check: Time Attack shows Difficulty; Basic is accepted for (x^2)(x^3); the Rule Identification prompt asks for a
rule; Career at Level 1 serves Easy problems after Very hard was chosen in Practice.


