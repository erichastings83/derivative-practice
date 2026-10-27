# Derivative Practice Batch 2: wrong math in solutions (app.js)

Line numbers come from the version deployed on 22 October 2026. If the code has changed, search for the function named instead.

Fix these three bugs. Read only the lines named. Do not run a browser test. Show me the diff.

1. At about lines 448 and 460, write a negative fraction as `\frac{-a}{b}` instead of `-\frac{a}{b}`, so the exponent
   patterns at lines 139, 145, 244, 247, 338 and 853 recognize it. Today -3cos(t)/t^(-1/4) gets a final answer 4 times
   too big.
2. At about line 561, store an integer constant as a coefficient, `createPart(Number(cExpr), 1, '')`, instead of as a
   text factor. Today (-2ln(y) - 5)(y^(-2/3)) ends in "-(2y^(-5/3) - 5)/3" instead of "+(10/3)y^(-5/3)".
3. At about line 902, before choosing ln as the outer function, check that the inner expression is positive at one or
   more of x = -3, -2, -1, -0.5, 0.5, 1, 2, 3. Leave ln out if it is not. Today ln(-5x^(-2)) appears.

Check: Show Solution on several Medium Quotient and Hard Product problems; the final answers are correct, and no
problem shows "+ -5" or ln of a negative expression.


