// src/schema.ts
import { z } from "zod";

/**
 * Custody type corresponds to which worksheet we run:
 * - PRIMARY  → Worksheet A (sole/primary physical custody)
 * - SHARED   → Worksheet B (shared physical custody)
 */
export const CustodyType = z.enum(["PRIMARY", "SHARED"]);
export type CustodyType = z.infer<typeof CustodyType>;

/**
 * ParentIncome captures the line 1 adjustments that produce line 2 (AAI).
 * We keep everything MONTHLY, because the court forms are monthly.
 *
 * Mappings (Worksheet A/B):
 * - Actual Monthly Income:               line 1
 * - Preexisting child support PAID:      line 1a (subtract)
 * - Alimony PAID in any case:            line 1b (subtract)
 * - Alimony RECEIVED in THIS case:       line 1c (add)
 * - Multifamily allowance (for in-home children not in this case) appears
 *   on the form as a helper area. We capture the *count* and will compute
 *   the allowance in the calculator (0.75 × basic for each such child).
 */
export const ParentIncome = z.object({
  actualMonthly: z.number().nonnegative(),            // line 1
  preexistingSupportPaid: z.number().nonnegative().default(0), // line 1a
  alimonyPaid: z.number().nonnegative().default(0),   // line 1b
  alimonyReceived: z.number().nonnegative().default(0), // line 1c
  multifamilyChildrenInHome: z.number().int().min(0).default(0), // count only
});
export type ParentIncome = z.infer<typeof ParentIncome>;

/**
 * Add-ons appear the same on A and B:
 * - Childcare (a)
 * - Child’s health insurance cost (b)
 * - Extraordinary medical (c)
 * - Cash medical (IV-D only) (d)
 * - Additional expenses (e) e.g., special/private school, transportation
 *
 * We record the TOTAL amounts (monthly). Allocation by income share happens
 * in the calculator step, not here.
 */
export const AddOns = z.object({
  childcare: z.number().nonnegative().default(0),
  healthInsurance: z.number().nonnegative().default(0),
  extraordinaryMedical: z.number().nonnegative().default(0),
  cashMedicalIVD: z.number().nonnegative().default(0),
  additionalExpenses: z.number().nonnegative().default(0),
});
export type AddOns = z.infer<typeof AddOns>;

/**
 * CaseInputs is what one calculation run needs.
 * - numChildrenThisCase: matches the row you’ll pick in the schedule table
 * - custodyType: which worksheet math to run
 * - overnightsParent1: only used for SHARED; must be 0..365
 * - parent1/parent2: each parent’s income inputs
 * - addOns: total monthly add-ons for this case
 *
 * NOTE on overnights: we only store Parent1’s; Parent2’s is 365 - p1.
 * This keeps inputs minimal and prevents “sum isn’t 365” conflicts.
 */
export const CaseInputs = z.object({
  numChildrenThisCase: z.number().int().min(1),
  custodyType: CustodyType,
  overnightsParent1: z.number().int().min(0).max(365).default(365),
  parent1: ParentIncome,
  parent2: ParentIncome,
  addOns: AddOns,
}).superRefine((v, ctx) => {
  // For SHARED custody we require overnights in range 0..365 (already constrained by .min/.max)
  if (v.custodyType === "SHARED") {
    if (v.overnightsParent1 < 0 || v.overnightsParent1 > 365) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "overnightsParent1 must be between 0 and 365 when custodyType is SHARED.",
        path: ["overnightsParent1"],
      });
    }
  }
});
export type CaseInputs = z.infer<typeof CaseInputs>;

/**
 * CaseOutputs is intentionally small:
 * - recommendedOrderParent1PaysParent2: the final monthly amount (>= 0)
 * - worksheet: a bag of intermediate line items (for transparency, testing, and PDF rendering)
 * - path: which worksheet logic produced the result ("WorksheetA" | "WorksheetB")
 *
 * We'll populate `worksheet` with keys that mirror the line numbers later
 * (e.g., basic, adjustedBasic, p1AAI, p2AAI, p1Share, p2Share, etc.).
 */
export type CaseOutputs = {
  recommendedOrderParent1PaysParent2: number;
  worksheet: Record<string, number>;
  path: "WorksheetA" | "WorksheetB";
};