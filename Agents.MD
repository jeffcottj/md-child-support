# Agents.MD

**Purpose:** This file briefs a code-generation agent on the current project, target behavior, constraints, and how to write code that fits the repository. Follow it to implement features confidently and produce a production-quality Maryland child support calculator web app with PDF output.

---

## 0) Project Snapshot

 - **Name:**  md-child-support
  - **Goal:**  Compute Maryland child support per statute and judiciary worksheets; export a court-style PDF.
 - **Language/Stack:**  TypeScript (strict), Node.js, Vitest for tests, Zod for schema validation, ts-node for CLIs.
 - **Current modules (already present):j
    - src/schema.ts — Zod schemas & types for inputs/outputs (includes `CaseInputs`, `CaseOutputs`, `CustodyType`, aAddOns`, `DirectPay`).
    - src/schedule.ts — Types + demo schedule + `lookupBasicObligation` (next-higher-row rule; flags `aboveTop`).
    - src/addons.ts — `totalAddOns`, `splitByShare`, `directPayTotalForParent`, `directPayConsistencyWarning`.
    - src/calc.ts — Worksheet A core (`computeBasic`, `computePrimaryTotals`, `computePrimaryFinal`).
    - src/shared.ts — Worksheet B core (`sharedStarter`, cross-payments, 92–109 adjustment, cap vs A, `computeSharedFinal`).
    - src/multifamily.ts — Multifamily allowance (0.75   base for one child using that parent’s income   count).
    - CLIs/tests: src/cli.ts, tests in tests/.
 - **Build/Test:**
    - `npm run typecheck` x– strict TS check
    - `npx vitest` �‌ unit tests

---

## 1) Regulatory & Math Model (what the app must implement)

## A. Core definitions
- **AAI (Adjusted Actual Income)** per parent (monthly):
  ```
  AAI = actualMonthly
        - preexistingSupportPaid
        - alimonyPaid
        + alimonyReceived
        - multifamilyAllowance
  ```
- **Multifamily allowance:** for each additional child living in that parent’s home (not in this case):
  1) Look up **Basic obligation for 1 child** using **ONLY** that parent’s income, applying **Next-Higher-Row** rule.
  2) Multiply by *0.75*.
  3) Multiply by *count* of such in-home children.
  4) Subtract from that parent’s actual income before computing AAI.
- **Schedule lookup**. Use combined AAI and number of children in this case.
  - If combined AAI is between rows — pick *next higher row**.
  - If above the top row — * discretionary** (flag `aboveTop`).

---

J