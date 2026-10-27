# Derivative Practice Batch 3: the answer checker (app.js)

Line numbers come from the version deployed on 22 October 2026. If the code has changed, search for the function named instead.

Fix these three bugs. Read only `checkEquivalence` (about line 1046), its call site (about line 1482) and the answer
input (about line 1141). Do not run a browser test. Show me the diff.

1. Add `normalizeAnswer(s, varName)` and run it on the input before checking. It should: lowercase; strip a leading
   "dy/dx =" style prefix; turn `sin^2(x)` into `sin(x)^2` and `cos x` into `cos(x)`; replace `ln` with `log`; insert
   `*` between a number, the variable or `)` and a following function name, `e^` or `(`; insert `*` after `)` before a
   letter or digit. Today the app's own printed answer typed as `-4x^3ln(x) - x^3` is marked wrong.
2. Compare by relative error, `Math.abs(u - c) <= 1e-6 * Math.max(1, Math.abs(c))`, written so NaN fails. Use test
   points 0.1, 0.3, 0.5, 0.7, 1.23, 2.71, 3.14, skip any point where the correct value is not finite, and require at
   least 3 usable points. Today `3*e^t*e^(3*e^t)` for d/dt e^(3e^t) is marked wrong.
3. Add `autocapitalize="off" autocorrect="off" spellcheck="false"` to `#answer-input`.

Check: `-4x^3ln(x) - x^3`, `Cos(t)`, `cos t` and `3*e^t*e^(3*e^t)` are all accepted on matching problems, and a
wrong answer is still rejected.


