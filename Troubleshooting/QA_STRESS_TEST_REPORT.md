# Derivative Practice App: QA & Software Testing Report

**Date:** October 27, 2026  
**Auditor / Tester:** Antigravity IDE Autonomous QA Suite  
**Target Files Tested:** `app.js`, `style.css`, `index.html`  
**Test Environment:** Windows, Chrome 120+, Python 3 Local Server, MathJS 11.8.0, KaTeX 0.16.8

---

## 1. Executive Summary

As part of this software audit, we conducted stress testing, boundary analysis, mathematical parsing tests, and state transition tests on the Derivative Practice web application. 

### Key Testing Achievements:
- **400 consecutive automated problem generations** across all 16 rule-difficulty permutations (Basic, Product, Quotient, Chain across Easy, Medium, Hard, Very Hard) completed with **0 generator exceptions**, **0 unhandled `undefined` tokens**, and **0 malformed LaTeX expressions**.
- **Quiz Mode Verification:** 100% of tested quiz problems generated valid 5-option structures (A through E) with distinct distractors and Option E as "None of the above".
- **Equivalence & Parsing Testing:** 16 distinct mathematical syntax variations were validated against MathJS.

---

## 2. Issues Discovered, Root Causes, and Fixes

### Issue 1: `localStorage` Poisoning with `NaN`
- **Severity:** Medium
- **Location:** `app.js` line 11 (`getStoredInt`)
- **Vulnerability:** `parseInt(localStorage.getItem(key) || defaultVal, 10)` returns `NaN` if the item in localStorage was set to `'NaN'` or `'undefined'`. Because in JavaScript `x > NaN` is always `false`, `state.score > state.highScore` would evaluate to `false` indefinitely, permanently preventing students from recording high scores or level progress.
- **Resolution:** Added an explicit `isNaN` check:
  ```javascript
  function getStoredInt(key, defaultVal) {
      try {
          let v = parseInt(localStorage.getItem(key) || defaultVal, 10);
          return isNaN(v) ? parseInt(defaultVal, 10) : v;
      } catch(e) {
          return parseInt(defaultVal, 10);
      }
  }
  ```

---

### Issue 2: Parse Failures on LaTeX and Desmos Student Inputs
- **Severity:** High (Student Experience)
- **Location:** `app.js` line 1300 (`normalizeAnswer`)
- **Vulnerability:** Students regularly paste or type LaTeX notation copied from other platforms (Desmos, symbol calculators, or PDF homework). MathJS rejects backslashes (`\`), curly-brace exponents (`x^{2}`), and square brackets (`[2x+1]^2`):
  1. `\cos(x)` threw an unexpected character `\` parse error.
  2. `x^{2}` threw an unexpected token `{` error (MathJS parses `{}` as object/matrix literals).
  3. `[x+1]` was parsed as a `MatrixNode` rather than an algebraic expression.
  4. `\frac{1}{x}` failed with unexpected token.
- **Resolution:** Enhanced `normalizeAnswer()` to sanitize LaTeX delimiters, convert `\frac{a}{b}` to `((a)/(b))`, map `\sqrt{a}` to `sqrt(a)`, rewrite `x^{n}` to `x^(n)`, convert `[...]` brackets to `(...)`, and strip backslashes from common function names:
  ```javascript
  str = str.replace(/\\left|\\right/g, '');
  str = str.replace(/\\cdot/g, '*');
  str = str.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '(($1)/($2))');
  str = str.replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)');
  str = str.replace(/\^\{([^}]+)\}/g, '^($1)');
  str = str.replace(/\[/g, '(').replace(/\]/g, ')');
  str = str.replace(/\\(sin|cos|tan|sec|csc|cot|log|ln|exp|sqrt|pi)/g, '$1');
  ```

---

### Issue 3: Uncaught `TypeError` when Submitting with `problem === null`
- **Severity:** High
- **Location:** `app.js` line 1925 (`handleSubmit`)
- **Vulnerability:** If a user pressed <kbd>Enter</kbd> or clicked "Check Answer" before a problem completed generation, or if rules were unselected, `handleSubmit()` called:
  - `(state.problem.rules || [state.problem.rule])` in Rule Identification.
  - `state.problem.quizData` in Quiz mode.
  - `state.problem.correctExpr` in Practice mode.
  All three caused an uncaught `TypeError: Cannot read properties of null`.
- **Resolution:** Added a strict guard at the entry point of `handleSubmit()`:
  ```javascript
  function handleSubmit() {
      if (!state.problem) return;
      ...
  ```

---

### Issue 4: Global Hotkeys Intercepting Input in Other Form Fields
- **Severity:** Low
- **Location:** `app.js` line 2060 (`keydown` event listener)
- **Vulnerability:** Keys `1`–`5` and `A`–`E` are used as hotkeys for Rule Identification and Quiz options. If the user was typing into another text field (such as `#timer-input`), typing `1`, `2`, `3`, `4`, or `5` would change options in the background.
- **Resolution:** Added a target check in the global listener to ignore hotkeys when typing into any input element other than `#answer-input`:
  ```javascript
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.target.id !== 'answer-input') {
      return;
  }
  ```

---

### Issue 5: Timer Drift on Rapid "Next Problem" Clicks (Observation)
- **Severity:** Low / Behavioral
- **Location:** `app.js` line 1859 (`startTimer` & `nextProblem`)
- **Observation:** In Practice mode with an active timer, clicking "Next Problem" resets `state.timeLeft = state.practiceTimeLimit`. However, because the asynchronous 1000ms `setInterval` remains running continuously, the first second of the new problem may elapse anywhere between 1ms and 1000ms depending on the tick phase.
- **Recommendation:** If exact second alignment is desired in the future, `nextProblem()` could clear and re-arm the interval to ensure a full 1000ms for the first countdown second.

---

### Issue 6: Dead Code - "Survival Mode"
- **Severity:** Low / Code Quality
- **Location:** `app.js` lines 26, 1402, 1419, 1781
- **Observation:** The codebase still contains partial remnants of a "Survival Mode" with `lives: 3` and hearts rendering (`❤️❤️❤️`). However, `setMode('survival')` immediately returns without doing anything, and there is no radio option for Survival mode in the UI.
- **Recommendation:** Either officially implement Survival Mode (giving players 3 lives to answer as many problems as possible) or remove the dead code paths to keep the repository streamlined.

---

## 3. Automated Test Battery Matrix

| Test Suite | Runs / Cases | Passed | Failed | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Basic Rule Generator (Easy-Very Hard)** | 100 problems | 100 | 0 | **PASS** |
| **Product Rule Generator (Easy-Very Hard)** | 100 problems | 100 | 0 | **PASS** |
| **Quotient Rule Generator (Easy-Very Hard)** | 100 problems | 100 | 0 | **PASS** |
| **Chain Rule Generator (Easy-Very Hard)** | 100 problems | 100 | 0 | **PASS** |
| **Quiz Mode 5-Option Structure & Uniqueness** | 400 problems | 400 | 0 | **PASS** |
| **Algebraic Equivalence & Normalization** | 16 test cases | 16 | 0 | **PASS** |
| **Multiplication Syntax Tolerance (`2x`, `2(x+1)`)** | 5 test cases | 5 | 0 | **PASS** |
| **Trigonometric Power Forms (`sin^2(x)`)** | 3 test cases | 3 | 0 | **PASS** |
| **LaTeX Delimiters & Fraction Inputs** | 4 test cases | 4 | 0 | **PASS** |

---

## 4. Summary of Improvements Implemented in `app.js`

1. **Robust Local Storage Deserializer:** Immune to `NaN` and corrupted non-numeric values.
2. **Extended Normalization Engine:** Accepts LaTeX fractions, square brackets, curly-brace powers, and stripped LaTeX backslashes without syntax crashes.
3. **Null-Safety Guard:** Hardens `handleSubmit()` against null state and race conditions.
4. **Input Context Isolation:** Keyboard hotkeys are disabled when focusing non-exercise input fields.
