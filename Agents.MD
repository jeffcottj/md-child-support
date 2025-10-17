
# Agents.MD

**Purpose:** This file briefs a code-generation agent on the current project, target behavior, constraints, and how to write code that fits the repository. Follow it to implement features confidently and produce a production-quality Maryland child support calculator web app with PDF output.

----------

## 0) Project Snapshot

-   **Name:** md-child-support
    
-   **Goal:** Compute Maryland child support per statute and judiciary worksheets; export a court-style PDF.
    
-   **Language/Stack:** TypeScript (strict), Node.js, Vitest for tests, Zod for schema validation, ts-node for CLIs.
    
-   **Current modules (already present):**
    
    -   `src/schema.ts` – Zod schemas & types for inputs/outputs (includes `CaseInputs`, `CaseOutputs`, `CustodyType`, `AddOns`, `DirectPay`).
        
    -   `src/schedule.ts` – Types + demo schedule + `lookupBasicObligation` (next-higher-row rule; flags `aboveTop`).
        
    -   `src/addons.ts` – `totalAddOns`, `splitByShare`, `directPayTotalForParent`, `directPayConsistencyWarning`.
        
    -   `src/calc.ts` – Worksheet A core (`computeBasic`, `computePrimaryTotals`, `computePrimaryFinal`).
        
    -   `src/shared.ts` – Worksheet B core (`sharedStarter`, cross-payments, 92–109 adjustment, cap vs A, `computeSharedFinal`).
        
    -   `src/multifamily.ts` – Multifamily allowance (0.75 × base for one child using that parent’s income × count).
        
    -   CLIs/tests: `src/cli.ts`, tests in `tests/`.
        
-   **Build/Test:**
    
    -   `npm run typecheck` → strict TS check
        
    -   `npx vitest` → unit tests
        

----------

## 1) Regulatory & Math Model (what the app must implement)

### A. Core definitions

-   **AAI (Adjusted Actual Income)** per parent (monthly):
    
    `AAI = actualMonthly
     - preexistingSupportPaid - alimonyPaid + alimonyReceived - multifamilyAllowance` 
    
-   **Multifamily allowance:** for each additional child living in that parent’s home (not in this case):
    
    1.  Look up **basic obligation for 1 child** using **only that parent’s income**, applying **next-higher-row** rule.
        
    2.  Multiply by **0.75**.
        
    3.  Multiply by **count** of such in-home children.
        
    4.  Subtract from that parent’s actual income before computing AAI.
        
-   **Schedule lookup:** Use combined AAI and number of children in this case.
    
    -   If combined AAI is between rows → pick **next higher row**.
        
    -   If above the top row → **discretionary** (flag `aboveTop`).
        

### B. Worksheet A (Primary Physical Custody)

1.  Compute both parents’ AAI and shares:  
    `share = parent AAI / combined AAI`.
    
2.  **Basic obligation** from schedule.
    
3.  **Add-ons** (monthly totals): childcare, child’s health insurance cost, extraordinary medical, cash medical (IV-D only), additional expenses.
    
4.  **Total child support obligation** = basic + add-ons.
    
5.  **Each parent’s obligation** = total × share.
    
6.  **Direct-pay credit**: subtract each parent’s actual direct payments for add-ons.
    
7.  **Recommended amount** (per parent) = obligation − direct-pay (floor at 0).
    
8.  **Final recommended order**: the **non-custodial** parent’s recommended amount.
    

### C. Worksheet B (Shared Physical Custody)

-   Threshold: both parents must have **≥ 25%** of overnights (**≥ 92** nights). Otherwise, revert to A.
    
-   **Adjusted Basic** = 1.5 × basic (uplift).
    
-   **Overnight %:** based on overnights per parent (sum 365 nights).
    
-   **Theoretical cross-payments:**
    
    -   P1 owes: `AdjustedBasic × P1Share × P2Overnight%`
        
    -   P2 owes: `AdjustedBasic × P2Share × P1Overnight%`
        
-   **92–109-night adjustment:** if a parent’s overnights are 92–109: increase their theoretical by:
    
    -   92–94 → +10%, 95–98 → +8%, 99–102 → +6%, 103–105 → +4%, 106–109 → +2%.
        
-   **Net basic:** subtract the smaller adjusted theoretical from the larger; payer is the one with the larger adjusted theoretical.
    
-   **Add-ons:** allocate by income shares; subtract direct-pay; net the difference between parents.
    
-   **Final shared amount:** combine **net basic** and **net add-ons** respecting direction; **cap**: may **not exceed** what would be owed under Worksheet A for same case.
    

----------

## 2) Data Model (canonical types)

### `CaseInputs` (monthly values)

-   `numChildrenThisCase: number` (≥ 1)
    
-   `custodyType: "PRIMARY" | "SHARED"`
    
-   `overnightsParent1: number` (0..365) – only used in SHARED; Parent2 = 365 − Parent1
    
-   `primaryCustodian: "P1" | "P2"` (for A and for cap comparison in B)
    
-   `parent1`, `parent2` each:
    
    -   `actualMonthly: number`
        
    -   `preexistingSupportPaid: number`
        
    -   `alimonyPaid: number`
        
    -   `alimonyReceived: number`
        
    -   `multifamilyChildrenInHome: number` (count; allowance computed by schedule)
        
-   `addOns`:
    
    -   `childcare`, `healthInsurance`, `extraordinaryMedical`, `cashMedicalIVD`, `additionalExpenses` (numbers, ≥ 0)
        
-   `directPay`:
    
    -   `parent1` & `parent2`: same five add-on categories (amounts they pay directly)
        

### `CaseOutputs`

-   `path: "WorksheetA" | "WorksheetB"`
    
-   `recommendedOrderParent1PaysParent2: number` (monthly dollars)
    
-   `worksheet: Record<string, number>` (intermediate line items for transparency / PDF)
    
-   Additional fields for B as needed: net basic, theoreticals, adjustments, cap flag.
    

### Schedule JSON (to replace demo)

`{  "combinedMonthlyIncome":  [ ... ascending numbers ... ],  "byChildren":  {  "1":  [ ... amounts ... ],  "2":  [ ... amounts ... ],  "3":  [ ... amounts ... ],  "...":  [ ... ]  },  "meta":  {  "units":  "USD per month",  "note":  "Maryland schedule vYYYYMMDD"  }  }` 

----------

## 3) Coding Standards & Conventions

-   **TypeScript strict**; no `any` unless truly necessary, and isolate it.
    
-   **Zod validation** on public-facing endpoints; trust only objects that pass schema parsing.
    
-   **Pure functions** for math; no side effects. All amounts are **monthly**.
    
-   **Money handling:** floats acceptable for now; round to cents at display; long-term option: **integer cents** internally.
    
-   **Test-first** where possible; new logic must have unit tests.
    
-   **Error handling:** return structured flags (`advisory`, `basicStatus`, `redirectToWorksheetA`) rather than throwing, unless input is structurally invalid.
    

----------

## 4) Back-End API (to implement)

Create an HTTP API (Express or Fastify) to power the web UI.

### Endpoints

-   `POST /api/calc`
    
    -   Body: `CaseInputs` (validated by Zod)
        
    -   Behavior: routes to Worksheet A or B based on `custodyType`, performs the calculation pipeline, returns `CaseOutputs` + detailed worksheet fields (including advisory flags).
        
-   `GET /api/schedule`
    
    -   Returns current schedule metadata/version and min/max incomes and supported child-count columns.
        
-   `POST /api/pdf`
    
    -   Body: `{ inputs: CaseInputs, outputs: CaseOutputs }`
        
    -   Returns a generated PDF (court-like formatting).
        

### Middleware & validation

-   Parse JSON; validate with `CaseInputs.safeParse`.
    
-   Return 400 with issue details if validation fails.
    
-   Log errors with request correlation ids.
    

----------

## 5) Front-End (to implement)

Framework options: **React + Vite** or **Next.js**. Keep it simple:

### Pages/Components

-   **Inputs Form:** mirrors court worksheets—grouped sections:
    
    -   Parents’ incomes + adjustments, multifamily counts
        
    -   Case data: # children, custody type, overnights (if shared)
        
    -   Add-ons: five categories (total amounts)
        
    -   Direct-pay table per parent and category
        
-   **Results View:** present worksheet-style lines:
    
    -   A: basic, add-ons, total, each parent’s share, direct-pay, recommended, order
        
    -   B: adjusted basic, overnights %, theoreticals, 92–109 adjustment, net basic, add-ons allocation, cap
        
    -   Warnings: `aboveTop`, direct-pay consistency note, shared threshold redirect
        
-   **Export PDF button:** calls `/api/pdf`
    
-   **Schedule status:** show min/max income rows and a note if above top.
    

### UX details

-   Live validation with Zod (use `zod` + `react-hook-form`).
    
-   Tooltips explaining each line item, referencing the worksheet line numbers.
    
-   Preserve drafts in local storage.
    

----------

## 6) PDF Generation (to implement)

-   Use **react-pdf** or **pdf-lib** or **Puppeteer** (HTML→PDF). Easiest: server-side HTML template + Puppeteer for pixel-perfect control.
    
-   Templates:
    
    -   `templates/worksheetA.html`
        
    -   `templates/worksheetB.html`
        
    -   Include a summary page consolidating final order and inputs.
        
-   Rendering rules:
    
    -   Show all key line numbers; include advisory messages (e.g., “Above top of schedule – court discretion”).
        
    -   Money formatted to 2 decimals.
        
    -   Footer with timestamp and version hash (git commit).
        

----------

## 7) Acceptance Criteria / Tests

### Unit tests (Vitest)

-   **Schedule lookup:**
    
    -   next-higher-row selection
        
    -   `aboveTop` flagged correctly
        
-   **Multifamily allowance:**
    
    -   per-child base uses parent’s income only
        
    -   0.75 × base × count deducted from AAI
        
-   **Worksheet A:**
    
    -   totals and shares computed correctly for a known scenario
        
    -   direct-pay credits applied; final order equals non-custodial’s recommended
        
    -   `aboveTop` returns advisory and null totals
        
-   **Worksheet B:**
    
    -   shared threshold (≥92) enforced; otherwise redirect to A
        
    -   adjusted basic = 1.5 × basic
        
    -   theoretical cross-payments computed correctly
        
    -   92–109 adjustments applied per band
        
    -   net basic direction identified; add-ons integrated; final ≥ 0
        
    -   cap vs A enforced
        
-   **API contract tests** (supertest): POST `/api/calc` validates inputs and returns expected shape.
    

### E2E (later)

-   Form submit → result view → PDF download; golden file compare on PDF text content.
    

----------

## 8) Implementation Roadmap (what to build next)

1.  **Replace demo schedule with real statutory data**
    
    -   Add a script `scripts/import-schedule.ts` to transform CSV → JSON shape used by `src/schedule.ts`.
        
    -   Add versioning metadata (`meta.version`, `meta.effectiveDate`).
        
    -   Update tests’ “top row” expectations accordingly.
        
2.  **API layer**
    
    -   Create `src/server.ts` (Fastify/Express).
        
    -   Implement `/api/calc`, `/api/schedule`, `/api/pdf`.
        
    -   Add `npm scripts`: `dev:server`, `start`.
        
3.  **Front-end app**
    
    -   Create `apps/web/` (Vite React or Next.js).
        
    -   Build pages/components as per section 5; wire to API.
        
4.  **PDF service**
    
    -   Choose renderer (Puppeteer HTML→PDF recommended).
        
    -   Build templates and `renderWorksheetA/B()`.
        
5.  **Polish & safeguards**
    
    -   Add **rounding utilities** and standardized currency formatting.
        
    -   Add **input presets** and a “share this case” JSON export/import.
        

----------

## 9) File/Folder Structure (target)

`md-child-support/
  src/ schema.ts
    schedule.ts
    addons.ts
    calc.ts
    shared.ts
    multifamily.ts
    util/ money.ts        # (optional future: integer cents helpers)
      number.ts       # round2, formatUSD server/ server.ts       # API bootstrap
      routes/
        calc.ts
        schedule.ts
        pdf.ts
      pdf/
        templates/
          worksheetA.html
          worksheetB.html
        render.ts
  tests/
    calc.basic.test.ts
    calc.primary.test.ts
    shared.starter.test.ts
    shared.adjustment.test.ts
    shared.final.test.ts
    multifamily.test.ts
  scripts/ import-schedule.ts
  apps/
    web/              # React/Next front end schedule-data.json  # real schedule once imported
  Agents.MD           # (this file)
  README.md
  tsconfig.json
  package.json` 

----------

## 10) Guardrails & Gotchas (for the agent)

-   **Do not** silently ignore `aboveTop` — propagate an advisory and avoid fabricating amounts.
    
-   **Shared threshold:** if either parent has < 92 nights → **must** revert to Worksheet A, not “almost shared.”
    
-   **92–109 adjustment:** apply only to the parent whose overnights fall in that band; multiply theoretical by **(1 + factor)**.
    
-   **Cap (Shared vs Primary):** compute a corresponding primary scenario using the parent with **more overnights** as custodial; final shared amount ≤ primary.
    
-   **Direct pay vs add-ons allocation:** our default is allocation by income share; subtract per-parent direct pay; net the difference between parents.
    
-   **Rounding:** At present, use floating math; round for display. Avoid accumulating `.toFixed()` strings as numbers mid-pipeline.
    
-   **Validation:** Always Zod-validate API input before calculation; return structured error payloads.
    

----------

## 11) Example API Contract

**Request:** `POST /api/calc`

`{  "numChildrenThisCase":  2,  "custodyType":  "PRIMARY",  "primaryCustodian":  "P1",  "overnightsParent1":  365,  "parent1":  {  "actualMonthly":  900,  "preexistingSupportPaid":  0,  "alimonyPaid":  0,  "alimonyReceived":  0,  "multifamilyChildrenInHome":  0  },  "parent2":  {  "actualMonthly":  700,  "preexistingSupportPaid":  0,  "alimonyPaid":  0,  "alimonyReceived":  0,  "multifamilyChildrenInHome":  0  },  "addOns":  {  "childcare":  120,  "healthInsurance":  30,  "extraordinaryMedical":  0,  "cashMedicalIVD":  0,  "additionalExpenses":  0  },  "directPay":  {  "parent1":  {  "childcare":  120,  "healthInsurance":  0,  "extraordinaryMedical":  0,  "cashMedicalIVD":  0,  "additionalExpenses":  0  },  "parent2":  {  "childcare":  0,  "healthInsurance":  30,  "extraordinaryMedical":  0,  "cashMedicalIVD":  0,  "additionalExpenses":  0  }  }  }` 

**Response (abridged):**

`{  "path":  "WorksheetA",  "recommendedOrderParent1PaysParent2":  166.88,  "worksheet":  {  "basic":  300,  "addOnsTotal":  150,  "totalObligation":  450,  "p1Share":  0.5625,  "p2Share":  0.4375,  "p1Obligation":  253.125,  "p2Obligation":  196.875,  "p1Direct":  120,  "p2Direct":  30,  "p1Recommended":  133.125,  "p2Recommended":  166.875  },  "advisory":  null  }` 

----------

## 12) Definition of Done (for the web app milestone)

-   ✅ Accepts all required inputs with validation and helpful UI affordances.
    
-   ✅ Computes per Maryland guidelines for A and B, including multifamily and 92–109.
    
-   ✅ Handles next-higher-row rule and above-top discretion with clear messaging.
    
-   ✅ Enforces shared cap vs primary.
    
-   ✅ Exports a neatly formatted PDF resembling the judiciary worksheets.
    
-   ✅ Has unit tests for schedule lookup, multifamily, Worksheet A and B pipelines, and API contract tests.
    
-   ✅ README updated with run/build/test instructions and schedule import notes.
    

----------

## 13) Agent Execution Notes

-   Prefer small PR-sized commits with tests.
    
-   Keep function names explicit and line-number comments when relevant to worksheets.
    
-   If a regulation edge-case is uncertain, expose an `advisory` and write the function to be pluggable (e.g., policy hooks).
    
-   Assume monthly units throughout the pipeline.
    

**You are now fully briefed. Build confidently.**
