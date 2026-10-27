# Derivative Practice Batch 1: how terms print (app.js)

Line numbers come from the version deployed on 22 October 2026. If the code has changed, search for the function named instead.

Fix these three display bugs. Read only the functions named, not the whole file. Do not run a browser test. Show me
the diff when done.

1. In `partsToTex` (about line 372), `multiplyParts` (about line 177) and the quotient denominator (about line 851),
   put ` \cdot ` between a coefficient and a factor that starts with a digit. Today 3*3^y prints as "33^y".
2. In the Basic fraction generator (about lines 591-595), build the three displays with `partsToTex`, so exponents and
   coefficients of 1 are dropped. Today it prints "(2t^5 - 4t^1)/t^1".
3. Add a `combineSameTex(parts)` helper above `addParts` (about line 187) that adds the coefficients of parts with
   identical factors and drops zeros. Use it on the results at about lines 686 and 736. Today (-3ln(x) + 8)(x) gives
   "-3 - 3ln(x) + 8".

Check: Hard and Very hard problems show no "33^y" or "t^1", and Product final answers have no uncombined terms.


