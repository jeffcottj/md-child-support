# Maryland Child Support Calculator

This project mirrors the Maryland Judiciary’s **Worksheet A (primary custody)** and **Worksheet B (shared custody)** and follows Family Law **§§ 12-201 to 12-204**.  
The spec below drives implementation and testing.

---

## Units
- All amounts are **monthly** (forms use monthly values).  
- UI may later accept weekly/bi-weekly inputs but must normalize to monthly.

---

## Inputs

### Parent income & adjustments
- **Actual Monthly Income** (Worksheet A/B line 1).  
- **Minus**: preexisting child support actually paid.  
- **Minus**: alimony paid.  
- **Plus/Minus**: alimony awarded in this case.  
- **Minus**: multifamily allowance (0.75 × basic support for each additional child in the home).  
- → Result: **Adjusted Actual Income (AAI)** (line 2).  
- Compute each parent’s **% share of income** (line 3).

### Case information
- **Number of children in this case**.  
- **Custody type**: `PRIMARY` or `SHARED`.  
- **Overnights per parent** (must sum to 365) – only used if `SHARED`.

### Add-ons (allocated by income share)
- Work-related **childcare** (line 13a / A-4a).  
- **Health insurance** costs for the child (13b / A-4b).  
- **Extraordinary medical expenses** (13c / A-4c).  
- **Cash medical (IV-D only)** (13d / A-4d).  
- **Additional expenses** such as special/private school, transportation (13e / A-4e).

---

## Schedule of Basic Child Support Obligations
- Look up **Basic Obligation** from statutory schedule using **combined AAI** and **number of children** (line 4).  
- If combined income falls **between rows → use the next higher amount**.  
- If combined income is **above the top → discretionary (flag advisory)**.

---

## Computation Flow

### Common (A & B)
1. Compute **AAI** for each parent.  
2. Compute **Combined AAI** and % shares.  
3. Lookup **Basic Obligation** from schedule (line 4).

### Worksheet A (Primary Custody)
4. **Total obligation** = basic + add-ons (line 5).  
5. **Each parent’s obligation** = total × % share (line 6).  
6. **Recommended amount** = obligation − direct add-ons paid (line 8).  
7. **Recommended order** = non-custodial parent’s amount (line 9).

### Worksheet B (Shared Custody)
4. **Adjusted basic** = 1.5 × basic (line 5).  
5. Record **overnights** (line 6) and % (line 7).  
   - If either parent < 25% (fewer than 92 nights), revert to Worksheet A.  
6. **Each parent’s share** of adjusted basic (line 8).  
7. **Theoretical obligation** each owes for time with the other parent (line 9).  
8. Apply **92–109 overnight adjustment** to that parent’s theoretical (line 10 → 11).  
9. Compute **Net basic** (line 12).  
10. Add **expenses** (line 13).  
11. Apply **Worksheet C** if add-ons were paid in a different split (line 14).  
12. **Final recommended order** (line 16).  
    - Cap: shared-custody amount may not exceed primary-custody amount.

---

## Outputs
- Line-by-line breakdown matching the court form (Worksheet A or B).  
- Final **Recommended Child Support Order**:  
  - Worksheet A → line 9.  
  - Worksheet B → line 16 (after Worksheet C, if used).

---

## Edge Rules
- **Between schedule rows**: pick the **next higher**.
- **Above top of schedule**: mark **“discretionary”**.
- **Shared threshold**: if <25% overnights, fall back to Worksheet A.
- **92–109 overnights**: apply statutory adjustment to that parent’s theoretical.

---

## Developer Quick Start

### Install & verify

```
npm install
npm run typecheck
npm test
```

### Command-line sample

```
npm start
```

The CLI prints a worksheet summary for the built-in demonstration case. Adjust the numbers inside `src/cli.ts` to explore other scenarios.

### Web interface

Run the minimal UI server and visit the printed URL (defaults to [http://localhost:3000](http://localhost:3000)).

```
npm run web:serve
```

The page accepts every field required by Worksheets A and B and renders the calculation, worksheet lines, advisories, and notes.

---

## Source Documents (store in `/docs`)
- CC-DR-034 Worksheet A (Primary Custody)
- CC-DR-035 Worksheet B (Shared Custody)
- Maryland Family Law §§ 12-201 to 12-204 (statutes)
