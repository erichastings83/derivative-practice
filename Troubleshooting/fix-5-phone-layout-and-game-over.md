# Derivative Practice Batch 5: phone layout and Game Over (style.css, app.js)

Line numbers come from the version deployed on 22 October 2026. If the code has changed, search for the function named instead.

Fix these three bugs. Read only the rules and lines named. Do not run a browser test. Show me the diff.

1. In `.problem-container` (style.css about line 105), set `justify-content: flex-start` and `position: relative`,
   and add `.problem-container > .katex-display { margin-left: auto; margin-right: auto; }`. Today a long problem is
   cut off on the left on phones.
2. In `.steps-container` (style.css about line 268), add `overflow-x: auto; position: relative`. Today a long solution
   scrolls the whole page sideways on phones.
3. At app.js about line 1257, change the guard to `if (state.problem && !state.gameOver)`. Today choosing Practice
   after a Time Attack Game Over throws "Cannot set properties of null" and leaves the Game Over card on screen.

Check: on a phone, long problems and solutions scroll inside their boxes; after Time Attack ends, choosing Practice
starts a new problem.


