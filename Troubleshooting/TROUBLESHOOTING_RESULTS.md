# Troubleshooting Audit & Fix Results

**Date:** October 26, 2026  
**Project:** Derivative Practice App  
**Status:** All 7 batches verified, confirmed accurate, and resolved locally.

---

## Executive Summary

A comprehensive audit was performed on the 7 issue reports located in the `Troubleshooting/` directory. All reported issues were found to be **accurate** and described genuine bugs or usability hurdles in the application.

All identified issues have been addressed in the local codebase within:
- `app.js`
- `style.css`

---

## Detailed Audit & Resolution by Batch

### Batch 1: How Terms Print (`fix-1-how-terms-print.md`)
**Assessment:** **Accurate (All 3 issues confirmed and fixed)**

1. **Adjacent Digits Display Bug ($3 \cdot 3^y$ displaying as $33^y$):**
   - **Root Cause:** In `partsToTex()`, `multiplyParts()`, and the quotient denominator formatting, numeric coefficients directly concatenated with factors beginning with digits without spacing.
   - **Fix:** Added a conditional check that inserts ` \cdot ` whenever a coefficient or factor ends with a digit and the adjacent factor starts with a digit (`/^[0-9]/.test(...)`).
2. **Basic Fraction Generator Display ($t^1$ and Coefficient $1$):**
   - **Root Cause:** In the Basic fraction generator, algebraic strings were constructed manually via raw template literals (e.g. `${a}${v}^{${n}}`), which failed to drop exponent $1$ or coefficient $1$.
   - **Fix:** Refactored the generator to construct intermediate term objects and render them through `partsToTex()`, which automatically suppresses exponent $1$, coefficient $1$, and formats signs.
3. **Uncombined Like Terms in Product Rule (e.g. $(-3\ln(x) + 8)(x) \implies -3 - 3\ln(x) + 8$):**
   - **Root Cause:** `addParts()` simply concatenated part arrays without combining parts possessing identical factors.
   - **Fix:** Implemented `combineSameTex(parts)` helper above `addParts()` that groups terms by their LaTeX factor key, sums fractional coefficients via `fracAdd()`, and eliminates zero terms. Applied this to all Product Rule results.

---

### Batch 2: Wrong Math in Solutions (`fix-2-wrong-math-in-solutions.md`)
**Assessment:** **Accurate (All 3 issues confirmed and fixed)**

1. **Negative Fractions in Exponents Causing Pattern Misses:**
   - **Root Cause:** In `getTerm()`, negative fraction exponents were formatted as `-\frac{a}{b}` rather than `\frac{-a}{b}`. This prevented internal exponent regex matchers in `multiplyParts()`, `getPolyPower()`, and quotient denominator simplify routines from matching negative fractional powers.
   - **Fix:** Changed exponent formatting in `getTerm()` to output `\frac{${num}}{${den}}` (e.g., `\frac{-1}{4}`), allowing all exponent simplification regexes to detect and simplify negative powers properly.
2. **Integer Constant Stored as Text Factor Instead of Coefficient:**
   - **Root Cause:** For integer constant terms (`cType === 'int'`), the constant was passed as `cTex` into `createPart(1, 1, cTex)`. This treated numbers like `-5` as algebraic factors rather than coefficients, breaking subsequent multiplication and power-rule differentiation.
   - **Fix:** Changed integer constants to be stored as numeric coefficients: `createPart(Number(cExpr), 1, '')`.
3. **$\ln$ Generated for Inner Functions with Negative Real Domains:**
   - **Root Cause:** Chain Rule selected outer function `log` without checking if the inner function was positive on the real domain, causing expressions like $\ln(-5x^{-2})$ which evaluate to `NaN`.
   - **Fix:** Added domain pre-validation evaluating the inner expression across test points `[-3, -2, -1, -0.5, 0.5, 1, 2, 3]`. If no point evaluates to a finite positive real number, `log` is excluded from candidate outer functions.

---

### Batch 3: The Answer Checker (`fix-3-the-answer-checker.md`)
**Assessment:** **Accurate (All 3 issues confirmed and fixed)**

1. **Lack of Answer Normalization:**
   - **Root Cause:** MathJS cannot parse common student calculus notations without explicit multiplication (e.g. `-4x^3ln(x)`), capitalized functions (`Cos(x)`), or notations like `sin^2(x)` and `cos x`.
   - **Fix:** Created `normalizeAnswer(s, varName)`:
     - Lowercases input.
     - Strips leading equation prefixes (e.g. `dy/dx =`, `y' =`, `f'(x) =`).
     - Replaces `\bln\b` with `log`.
     - Rewrites `sin^n(x)` to `sin(x)^n`.
     - Converts `cos x` to `cos(x)`.
     - Automatically inserts `*` between numbers, variables, or closing parentheses and following function names, `e^`, or opening parentheses.
2. **Equivalence Checking & Relative Tolerance:**
   - **Root Cause:** Fixed absolute tolerance `1e-5` failed on functions with large values (e.g. $e^{3e^t}$ on test points like $3.14$), where standard IEEE 754 float precision cannot satisfy an absolute $10^{-5}$ threshold.
   - **Fix:** Rewrote `checkEquivalence()` to:
     - Use test points `[0.1, 0.3, 0.5, 0.7, 1.23, 2.71, 3.14]`.
     - Skip evaluation points where the correct expression is not finite or is `NaN`.
     - Require at least 3 usable evaluation points.
     - Compare using relative error: `Math.abs(uVal - cVal) <= 1e-6 * Math.max(1, Math.abs(cVal))`.
3. **Mobile Virtual Keyboard Interfering with Input:**
   - **Root Cause:** `#answer-input` lacked mobile input attributes, causing phone keyboards to auto-capitalize the first letter (e.g. `Cos(x)`) and auto-correct calculus terms.
   - **Fix:** Added `autocapitalize="off" autocorrect="off" spellcheck="false"` to `#answer-input`.

---

### Batch 4: Buttons, Enter, and the Answer Box (`fix-4-buttons-enter-and-the-answer-box.md`)
**Assessment:** **Accurate (All 4 issues confirmed and fixed)**

1. **Enter Key Advancing Immediately Past "Correct!" Screen:**
   - **Root Cause:** The keydown event on input triggered `handleSubmit()`, setting `waitingForNext = true`, which immediately bubbled to the global Enter handler in the same cycle.
   - **Fix:** Added `e.preventDefault()` and `e.stopPropagation()` to input keydown, added a 250ms guard against rapid double-submits, and focused the Next button inside `setTimeout(..., 0)`.
2. **Answer Box Emptied on Hint, Show Solution, or Re-Render:**
   - **Root Cause:** `render()` replaced `app.innerHTML` without preserving the live DOM input value.
   - **Fix:** At the start of `render()`, the current value of `#answer-input` is captured into `state.currentInput`, and preserved into the reconstructed input element until `nextProblem()` explicitly resets it.
3. **Unwanted Page Scrolling on Every Click on Touch Devices:**
   - **Root Cause:** `render()` called `ansInput.focus()` unconditionally after every state change.
   - **Fix:** Restricted auto-focus to desktop devices (`!window.matchMedia('(pointer: coarse)').matches`) and only for new problems or after incorrect submissions.
4. **Rule Checkbox Alert Leaving DOM Checkbox Unchecked:**
   - **Root Cause:** When attempting to uncheck the last remaining rule, `toggleRule()` reset `state.rules[rule] = true` and triggered an alert, but returned before calling `render()`.
   - **Fix:** Added `render()` call before returning from the alert condition.

---

### Batch 5: Phone Layout and Game Over (`fix-5-phone-layout-and-game-over.md`)
**Assessment:** **Accurate (All 3 issues confirmed and fixed)**

1. **Problem Truncated on the Left on Small Screens:**
   - **Root Cause:** `.problem-container` used CSS `justify-content: center` with `overflow-x: auto`. In CSS flexbox, centering overflowing items pushes content off the left edge where it cannot be scrolled to.
   - **Fix:** Updated `.problem-container` to `justify-content: flex-start; position: relative;` and added `.problem-container > .katex-display { margin-left: auto; margin-right: auto; }`.
2. **Steps Container Causing Horizontal Page Scroll:**
   - **Root Cause:** Long LaTeX formulas in `.steps-container` overflowed without localized scrollbars.
   - **Fix:** Added `overflow-x: auto; position: relative;` to `.steps-container`.
3. **TypeError on Game Over in Time Attack:**
   - **Root Cause:** When `state.gameOver === true`, `#math-display` is not present in the DOM. `render()` still attempted to call `katex.render(..., display)` where `display === null`, throwing `Cannot set properties of null`.
   - **Fix:** Added guard `if (state.problem && !state.gameOver)` around KaTeX math rendering.

---

### Batch 6: Modes, Rule Identification, and Career (`fix-6-modes-rule-identification-and-career.md`)
**Assessment:** **Accurate (All 4 issues confirmed and fixed)**

1. **Difficulty Selector Hidden in Certain Modes:**
   - **Root Cause:** The Difficulty section in `render()` was wrapped in a conditional for `practice`, `career`, and `quiz`, hiding it during Time Attack and Rule Identification.
   - **Fix:** Removed the outer wrapper so Difficulty controls remain accessible in all game modes, while keeping Practice Timer restricted to Practice mode.
2. **Rule Identification Rejecting Valid Algebraic Simplification:**
   - **Root Cause:** Multiple-rule problems (such as polynomial products $(-3y^3)(y^3)$ or fractions $(2x^4+x)/x$) could be evaluated via Basic rules (simplification) or Product/Quotient rules, but the app only checked `state.problem.rule`.
   - **Fix:** Generators now supply `rules: [...]` arrays (e.g. `['basic', 'quotient']`, `['product', 'basic']`), and `handleSubmit()` checks `(state.problem.rules || [state.problem.rule]).includes(state.selectedRule)`.
3. **Rule Identification Prompt Inaccurate:**
   - **Root Cause:** In Rule Identification mode, the LaTeX prompt asked "what is $f'(x)$?" instead of asking which rule to apply.
   - **Fix:** Updated prompt for Rule Identification mode to: `\text{If } ${notation.str} = ${tex}\text{, which rule does this need?}`.
4. **Career Mode Difficulty Progression Bypass:**
   - **Root Cause:** If a user chose "Very Hard" in Practice and then switched to Career mode at Level 1, the difficulty remained "Very Hard", awarding 50 XP per problem.
   - **Fix:** In `setMode('career')`, if the current difficulty exceeds the level unlock threshold (Easy: Lvl 1, Medium: Lvl 3, Hard: Lvl 5, Very Hard: Lvl 8), difficulty is automatically capped to the highest unlocked level.

---

### Batch 7: Nice-to-Have (`fix-7-nice-to-have.md`)
**Assessment:** **Accurate (All items addressed)**

1. **Preserving Practice Rules When Exiting Career Mode:**
   - **Root Cause:** Career mode disables locked rules based on user level. Switching back to Practice kept those rules disabled.
   - **Fix:** Saved `state.practiceRules` when entering Career mode and restored them upon returning to Practice mode.
2. **Button Typography:**
   - **Root Cause:** Buttons did not inherit the web application's Outfit font.
   - **Fix:** Added `button, input, select, textarea { font-family: var(--font-main); }` to `style.css`.
3. **Screen Reader Accessibility:**
   - **Root Cause:** Dynamic status messages in `#feedback-msg` were not announced to assistive technology.
   - **Fix:** Added `aria-live="polite"` and `role="status"` attributes to `#feedback-msg`.

---

## Verification & Testing Summary

1. **Automated Verification:** Verified syntax validity and functionality via browser automation on test server.
2. **User Input & Hint Preservation:** Confirmed that typing answers into the answer box and clicking "Hint" preserves the entered text without resetting.
3. **Rule Validation:** Confirmed that attempting to uncheck the final active rule prevents deselection and maintains checkbox state synchronization.
4. **Mode Navigation:** Verified that Difficulty options render across all modes, Rule Identification asks for the rule name, and Quiz mode maintains 5 options (A–E).
5. **Git Status:** All changes remain strictly local on the local machine and uncommitted.
