# Derivative Practice Batch 4: buttons, Enter and the answer box (app.js)

Line numbers come from the version deployed on 22 October 2026. If the code has changed, search for the function named instead.

Fix these four bugs. Read only `render()` and the event listeners near lines 1091, 1276, 1290, 1322, 1465 and
1531. Do not run a browser test. Show me the diff.

1. Enter after a correct answer skips the result screen, because the same key press reaches the Next button. Call
   `e.preventDefault()` on Enter (about line 1276), and focus the Next button inside `setTimeout(..., 0)` (about
   lines 1531-1532).
2. The answer box empties after a wrong answer, Hint or Show Solution. In `render()`, save the box's value before
   replacing the HTML and put it back afterwards. Clear it only in `nextProblem()`.
3. Every click focuses the answer box and scrolls the page to it. Focus it only for a new problem or after a wrong
   answer, and never when `matchMedia('(pointer: coarse)').matches`.
4. After the "At least one rule must be selected!" alert (about line 1322), call `render()` before `return`, so the
   Basic box shows checked again.

Check: Enter on a correct answer shows "Correct!" and the solution; a typed answer survives Hint; on a phone, tapping
a difficulty does not jump the page; the last rule box stays checked after the alert.


