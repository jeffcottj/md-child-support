/**
 * Input and output shapes for the calculator.  These Zod schemas describe the
 * pieces of information the worksheets expect, but the comments are written in
 * everyday language so a non-programmer can read them as a checklist.
 */
import { z } from "zod";

/**
 * Breakdown of a parent's direct payments to third parties.  Each field is the
 * monthly amount that parent pays straight to a provider.
 */
export const DirectPayAddOns = z.object({
  childcare: z.number().nonnegative().default(0),
  healthInsurance: z.number().nonnegative().default(0),
  extraordinaryMedical: z.number().nonnegative().default(0),
  cashMedicalIVD: z.number().nonnegative().default(0),
  additionalExpenses: z.number().nonnegative().default(0),
});
export type DirectPayAddOns = z.infer<typeof DirectPayAddOns>;

// A fully-zero default that satisfies DirectPayAddOns
const ZERO_DIRECT_PAY_ADDONS: DirectPayAddOns = {
  childcare: 0,
  healthInsurance: 0,
  extraordinaryMedical: 0,
  cashMedicalIVD: 0,
  additionalExpenses: 0,
};

/**
 * Pair of direct-pay add-on sets, one for each parent.  Defaults to zero so we
 * can skip the section when no direct payments exist.
 */
export const DirectPay = z.object({
  parent1: DirectPayAddOns.default(ZERO_DIRECT_PAY_ADDONS),
  parent2: DirectPayAddOns.default(ZERO_DIRECT_PAY_ADDONS),
});
export type DirectPay = z.infer<typeof DirectPay>;

/**
 * Plain-language choice between Worksheet A (primary custody) and Worksheet B
 * (shared custody).
 */
export const CustodyType = z.enum(["PRIMARY", "SHARED"]);
export type CustodyType = z.infer<typeof CustodyType>;

/**
 * Captures the income-related lines from the worksheets for one parent.  Every
 * amount is monthly to match the court forms.
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
 * Total monthly add-on expenses for the case.  Later we split these by income
 * share; here we simply record the combined amounts.
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
 * The full set of answers we need from a user to calculate support.
 *
 * It asks for the number of children, the custody style, Parent 1's
 * overnights, both parents' income details, the add-on totals, who is the
 * primary custodian, and any direct payments already being made.
 */
export const CaseInputs = z.object({
  numChildrenThisCase: z.number().int().min(1),
  custodyType: CustodyType,
  overnightsParent1: z.number().int().min(0).max(365).default(365),
  parent1: ParentIncome,
  parent2: ParentIncome,
  addOns: AddOns,

  primaryCustodian: z.enum(["P1", "P2"]).default("P1"),
  directPay: DirectPay.default({
    parent1: ZERO_DIRECT_PAY_ADDONS,
    parent2: ZERO_DIRECT_PAY_ADDONS,
  }),
}).superRefine((v, ctx) => {
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
 * Simplified output returned to the caller after we run the calculator.  It
 * includes who pays, how much, the worksheet line items for transparency, and
 * any advisory notes that a court might want to review.
 */
export type CaseOutputs = {
  recommendedOrderParent1PaysParent2: number;
  payor: "P1" | "P2" | null;
  worksheet: Record<string, number>;
  path: "WorksheetA" | "WorksheetB";
  notes: string[];
  advisory: "aboveTopOfSchedule" | "redirectedToWorksheetA" | null;
};