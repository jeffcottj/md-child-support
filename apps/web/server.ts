import * as http from "http";
import { calculateCase } from "../../src/calc";
import { demoSchedule } from "../../src/schedule";
import { CaseInputs as CaseInputsSchema } from "../../src/schema";
import type { CaseInputs, CaseOutputs } from "../../src/schema";

type FormState = Record<string, string>;

type RenderOptions = {
  form: FormState;
  step: number;
  result?: CaseOutputs | null;
  errors?: string[];
};

type StepDefinition = {
  id: number;
  title: string;
  description: string;
};

const steps: StepDefinition[] = [
  {
    id: 1,
    title: "Welcome",
    description: "Overview and what to gather before you begin.",
  },
  {
    id: 2,
    title: "Case participants",
    description: "Identify the parents, court, and preparer.",
  },
  {
    id: 3,
    title: "Custody & children",
    description: "Choose the worksheet path and custody split.",
  },
  {
    id: 4,
    title: "Parent 1 income",
    description: "Document monthly income and adjustments.",
  },
  {
    id: 5,
    title: "Parent 2 income",
    description: "Document monthly income and adjustments.",
  },
  {
    id: 6,
    title: "Add-ons & direct pay",
    description: "Capture expenses and direct payments.",
  },
  {
    id: 7,
    title: "Review & results",
    description: "Confirm details and view the calculation.",
  },
];

const TOTAL_STEPS = steps.length;

const defaultForm: FormState = {
  parent1_name: "",
  parent2_name: "",
  courtName: "",
  docketNumber: "",
  preparer_name: "",
  preparer_role: "",
  preparer_contact: "",
  numChildrenThisCase: "1",
  custodyType: "PRIMARY",
  primaryCustodian: "P1",
  overnightsParent1: "365",
  parent1_actualMonthly: "0",
  parent1_preexistingSupportPaid: "0",
  parent1_alimonyPaid: "0",
  parent1_alimonyReceived: "0",
  parent1_multifamilyChildrenInHome: "0",
  parent2_actualMonthly: "0",
  parent2_preexistingSupportPaid: "0",
  parent2_alimonyPaid: "0",
  parent2_alimonyReceived: "0",
  parent2_multifamilyChildrenInHome: "0",
  addOns_childcare: "0",
  addOns_healthInsurance: "0",
  addOns_extraordinaryMedical: "0",
  addOns_cashMedicalIVD: "0",
  addOns_additionalExpenses: "0",
  directPay_parent1_childcare: "0",
  directPay_parent1_healthInsurance: "0",
  directPay_parent1_extraordinaryMedical: "0",
  directPay_parent1_cashMedicalIVD: "0",
  directPay_parent1_additionalExpenses: "0",
  directPay_parent2_childcare: "0",
  directPay_parent2_healthInsurance: "0",
  directPay_parent2_extraordinaryMedical: "0",
  directPay_parent2_cashMedicalIVD: "0",
  directPay_parent2_additionalExpenses: "0",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readNumber(form: FormState, key: string, fallback = 0): number {
  const raw = form[key];
  if (raw == null || raw.trim() === "") return fallback;
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

function readInt(form: FormState, key: string, fallback = 0): number {
  return Math.trunc(readNumber(form, key, fallback));
}

function mergeForm(base: FormState, updates: FormState): FormState {
  const next: FormState = { ...base };
  for (const [key, value] of Object.entries(updates)) {
    next[key] = value;
  }
  return next;
}

function buildInputs(form: FormState): { inputs: CaseInputs | null; errors: string[] } {
  const errors: string[] = [];
  const custodyType = form.custodyType === "SHARED" ? "SHARED" : "PRIMARY";
  const primaryCustodian = form.primaryCustodian === "P2" ? "P2" : "P1";

  const candidate: CaseInputs = {
    numChildrenThisCase: Math.max(1, readInt(form, "numChildrenThisCase", 1)),
    custodyType,
    primaryCustodian,
    overnightsParent1: Math.min(365, Math.max(0, readInt(form, "overnightsParent1", 365))),
    parent1: {
      actualMonthly: Math.max(0, readNumber(form, "parent1_actualMonthly")),
      preexistingSupportPaid: Math.max(0, readNumber(form, "parent1_preexistingSupportPaid")),
      alimonyPaid: Math.max(0, readNumber(form, "parent1_alimonyPaid")),
      alimonyReceived: Math.max(0, readNumber(form, "parent1_alimonyReceived")),
      multifamilyChildrenInHome: Math.max(0, readInt(form, "parent1_multifamilyChildrenInHome")),
    },
    parent2: {
      actualMonthly: Math.max(0, readNumber(form, "parent2_actualMonthly")),
      preexistingSupportPaid: Math.max(0, readNumber(form, "parent2_preexistingSupportPaid")),
      alimonyPaid: Math.max(0, readNumber(form, "parent2_alimonyPaid")),
      alimonyReceived: Math.max(0, readNumber(form, "parent2_alimonyReceived")),
      multifamilyChildrenInHome: Math.max(0, readInt(form, "parent2_multifamilyChildrenInHome")),
    },
    addOns: {
      childcare: Math.max(0, readNumber(form, "addOns_childcare")),
      healthInsurance: Math.max(0, readNumber(form, "addOns_healthInsurance")),
      extraordinaryMedical: Math.max(0, readNumber(form, "addOns_extraordinaryMedical")),
      cashMedicalIVD: Math.max(0, readNumber(form, "addOns_cashMedicalIVD")),
      additionalExpenses: Math.max(0, readNumber(form, "addOns_additionalExpenses")),
    },
    directPay: {
      parent1: {
        childcare: Math.max(0, readNumber(form, "directPay_parent1_childcare")),
        healthInsurance: Math.max(0, readNumber(form, "directPay_parent1_healthInsurance")),
        extraordinaryMedical: Math.max(0, readNumber(form, "directPay_parent1_extraordinaryMedical")),
        cashMedicalIVD: Math.max(0, readNumber(form, "directPay_parent1_cashMedicalIVD")),
        additionalExpenses: Math.max(0, readNumber(form, "directPay_parent1_additionalExpenses")),
      },
      parent2: {
        childcare: Math.max(0, readNumber(form, "directPay_parent2_childcare")),
        healthInsurance: Math.max(0, readNumber(form, "directPay_parent2_healthInsurance")),
        extraordinaryMedical: Math.max(0, readNumber(form, "directPay_parent2_extraordinaryMedical")),
        cashMedicalIVD: Math.max(0, readNumber(form, "directPay_parent2_cashMedicalIVD")),
        additionalExpenses: Math.max(0, readNumber(form, "directPay_parent2_additionalExpenses")),
      },
    },
  };

  const parsed = CaseInputsSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "form";
      errors.push(`${path}: ${issue.message}`);
    }
    return { inputs: null, errors };
  }

  return { inputs: parsed.data, errors };
}

function formatCurrency(raw: string): string {
  const num = Number(raw);
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, style: "currency", currency: "USD" });
}

function renderHiddenInputs(form: FormState, visibleFields: string[]): string {
  const exclude = new Set(visibleFields);
  const entries = Object.entries(form)
    .filter(([key]) => !exclude.has(key))
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`);
  return entries.join("");
}

function renderResult(result: CaseOutputs | null | undefined): string {
  if (!result) {
    return "";
  }

  const direction = result.payor
    ? result.payor === "P1"
      ? "Parent 1 pays Parent 2"
      : "Parent 2 pays Parent 1"
    : "Discretionary";
  const amount = result.payor
    ? Math.abs(result.recommendedOrderParent1PaysParent2).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        style: "currency",
        currency: "USD",
      })
    : "–";

  const worksheetRows = Object.entries(result.worksheet)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, value]) => `
          <tr>
            <th scope="row">${escapeHtml(key)}</th>
            <td>${formatCurrency(String(value))}</td>
          </tr>`
    )
    .join("");

  const notes = result.notes.length
    ? `<ul>${result.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
    : "<p class=\"muted\">No additional notes.</p>";

  const advisory = result.advisory
    ? `<p class="advisory">Advisory: ${escapeHtml(result.advisory)}</p>`
    : "";

  return `
    <section class="results">
      <header>
        <h2>Worksheet results (${escapeHtml(result.path)})</h2>
        <p class="summary"><strong>${direction}</strong> — ${amount === "–" ? "Discretionary" : amount}</p>
        ${advisory}
      </header>
      <div class="results-grid">
        <div class="result-card">
          <h3>Worksheet detail</h3>
          <div class="worksheet">
            <table>
              <thead>
                <tr><th scope="col">Line</th><th scope="col">Amount</th></tr>
              </thead>
              <tbody>${worksheetRows}</tbody>
            </table>
          </div>
        </div>
        <div class="result-card">
          <h3>Notes</h3>
          ${notes}
        </div>
      </div>
    </section>
  `;
}

function renderDataSummary(form: FormState): string {
  const custodyLabel = form.custodyType === "SHARED" ? "Shared physical custody" : "Primary physical custody";
  const primaryCustodian = form.primaryCustodian === "P2" ? "Parent 2" : "Parent 1";
  const parent1Overnights = readInt(form, "overnightsParent1", 365);
  const parent2Overnights = Math.max(0, 365 - parent1Overnights);

  return `
    <section class="review">
      <h2>Review your entries</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <h3>Participants & court</h3>
          <dl>
            <dt>Parent 1</dt><dd>${escapeHtml(form.parent1_name || "Parent 1")}</dd>
            <dt>Parent 2</dt><dd>${escapeHtml(form.parent2_name || "Parent 2")}</dd>
            <dt>Court</dt><dd>${escapeHtml(form.courtName || "—")}</dd>
            <dt>Docket / Case #</dt><dd>${escapeHtml(form.docketNumber || "—")}</dd>
            <dt>Preparer</dt><dd>${escapeHtml(form.preparer_name || "—")}</dd>
            <dt>Preparer details</dt><dd>${escapeHtml([form.preparer_role, form.preparer_contact].filter(Boolean).join(" • ") || "—")}</dd>
          </dl>
        </div>
        <div class="summary-card">
          <h3>Custody profile</h3>
          <dl>
            <dt>Worksheet path</dt><dd>${escapeHtml(custodyLabel)}</dd>
            <dt>Primary custodian</dt><dd>${escapeHtml(primaryCustodian)}</dd>
            <dt>Children in this case</dt><dd>${escapeHtml(form.numChildrenThisCase)}</dd>
            <dt>Parent 1 overnights</dt><dd>${parent1Overnights}</dd>
            <dt>Parent 2 overnights</dt><dd>${parent2Overnights}</dd>
          </dl>
        </div>
        <div class="summary-card">
          <h3>Parent 1 income</h3>
          <dl>
            <dt>Actual monthly income</dt><dd>${formatCurrency(form.parent1_actualMonthly)}</dd>
            <dt>Preexisting support paid</dt><dd>${formatCurrency(form.parent1_preexistingSupportPaid)}</dd>
            <dt>Alimony paid</dt><dd>${formatCurrency(form.parent1_alimonyPaid)}</dd>
            <dt>Alimony received</dt><dd>${formatCurrency(form.parent1_alimonyReceived)}</dd>
            <dt>Additional in-home children</dt><dd>${escapeHtml(form.parent1_multifamilyChildrenInHome)}</dd>
          </dl>
        </div>
        <div class="summary-card">
          <h3>Parent 2 income</h3>
          <dl>
            <dt>Actual monthly income</dt><dd>${formatCurrency(form.parent2_actualMonthly)}</dd>
            <dt>Preexisting support paid</dt><dd>${formatCurrency(form.parent2_preexistingSupportPaid)}</dd>
            <dt>Alimony paid</dt><dd>${formatCurrency(form.parent2_alimonyPaid)}</dd>
            <dt>Alimony received</dt><dd>${formatCurrency(form.parent2_alimonyReceived)}</dd>
            <dt>Additional in-home children</dt><dd>${escapeHtml(form.parent2_multifamilyChildrenInHome)}</dd>
          </dl>
        </div>
        <div class="summary-card">
          <h3>Add-on expenses</h3>
          <dl>
            <dt>Childcare</dt><dd>${formatCurrency(form.addOns_childcare)}</dd>
            <dt>Health insurance</dt><dd>${formatCurrency(form.addOns_healthInsurance)}</dd>
            <dt>Extraordinary medical</dt><dd>${formatCurrency(form.addOns_extraordinaryMedical)}</dd>
            <dt>Cash medical (IV-D)</dt><dd>${formatCurrency(form.addOns_cashMedicalIVD)}</dd>
            <dt>Additional expenses</dt><dd>${formatCurrency(form.addOns_additionalExpenses)}</dd>
          </dl>
        </div>
        <div class="summary-card">
          <h3>Direct payments</h3>
          <dl>
            <dt>Parent 1 childcare</dt><dd>${formatCurrency(form.directPay_parent1_childcare)}</dd>
            <dt>Parent 1 health insurance</dt><dd>${formatCurrency(form.directPay_parent1_healthInsurance)}</dd>
            <dt>Parent 1 extraordinary medical</dt><dd>${formatCurrency(form.directPay_parent1_extraordinaryMedical)}</dd>
            <dt>Parent 1 cash medical</dt><dd>${formatCurrency(form.directPay_parent1_cashMedicalIVD)}</dd>
            <dt>Parent 1 additional expenses</dt><dd>${formatCurrency(form.directPay_parent1_additionalExpenses)}</dd>
            <dt>Parent 2 childcare</dt><dd>${formatCurrency(form.directPay_parent2_childcare)}</dd>
            <dt>Parent 2 health insurance</dt><dd>${formatCurrency(form.directPay_parent2_healthInsurance)}</dd>
            <dt>Parent 2 extraordinary medical</dt><dd>${formatCurrency(form.directPay_parent2_extraordinaryMedical)}</dd>
            <dt>Parent 2 cash medical</dt><dd>${formatCurrency(form.directPay_parent2_cashMedicalIVD)}</dd>
            <dt>Parent 2 additional expenses</dt><dd>${formatCurrency(form.directPay_parent2_additionalExpenses)}</dd>
          </dl>
        </div>
      </div>
    </section>
  `;
}

type StepTemplate = {
  content: string;
  visibleFields: string[];
};

type StepHelpers = {
  field: (name: string) => string;
  checked: (name: string, value: string) => string;
  selected: (name: string, value: string) => string;
};

function renderStepContent(step: number, helpers: StepHelpers, result: CaseOutputs | null | undefined, form: FormState): StepTemplate {
  const { field, checked, selected } = helpers;
  switch (step) {
    case 1:
      return {
        visibleFields: [],
        content: `
          <section class="step">
            <h2>Welcome to the Maryland child support interview</h2>
            <p>This guided interview will help you gather the information required to compute the Maryland child support worksheet. You can move back and forth between steps at any time.</p>
            <div class="callout">
              <h3>What you'll need</h3>
              <ul>
                <li>Parent names and the court docket or case number.</li>
                <li>Monthly income details for each parent, including any alimony or preexisting support paid.</li>
                <li>Counts of any additional children living in each parent's home.</li>
                <li>Child-related add-on expenses such as childcare, health insurance premiums, and extraordinary medical costs.</li>
                <li>Any direct payments either parent makes toward those add-ons.</li>
              </ul>
            </div>
            <p>When you're ready, choose <strong>Next</strong> to begin entering your case information.</p>
          </section>
        `,
      };
    case 2:
      return {
        visibleFields: [
          "parent1_name",
          "parent2_name",
          "courtName",
          "docketNumber",
          "preparer_name",
          "preparer_role",
          "preparer_contact",
        ],
        content: `
          <section class="step">
            <h2>Case participants</h2>
            <p>Provide the identifying details that will appear on the generated worksheet.</p>
            <div class="grid two">
              <label>Parent 1 name<input type="text" name="parent1_name" value="${field("parent1_name")}" /></label>
              <label>Parent 2 name<input type="text" name="parent2_name" value="${field("parent2_name")}" /></label>
            </div>
            <div class="grid two">
              <label>Court name<input type="text" name="courtName" value="${field("courtName")}" /></label>
              <label>Docket / case number<input type="text" name="docketNumber" value="${field("docketNumber")}" /></label>
            </div>
            <div class="grid three">
              <label>Preparer name<input type="text" name="preparer_name" value="${field("preparer_name")}" /></label>
              <label>Preparer role or firm<input type="text" name="preparer_role" value="${field("preparer_role")}" /></label>
              <label>Preparer contact details<input type="text" name="preparer_contact" value="${field("preparer_contact")}" /></label>
            </div>
          </section>
        `,
      };
    case 3:
      return {
        visibleFields: ["numChildrenThisCase", "custodyType", "primaryCustodian", "overnightsParent1"],
        content: `
          <section class="step">
            <h2>Custody & worksheet selection</h2>
            <p>These answers determine which worksheet applies and how parenting time is allocated.</p>
            <div class="grid two">
              <label>
                Number of children in this case
                <input type="number" name="numChildrenThisCase" min="1" required value="${field("numChildrenThisCase")}" />
              </label>
              <label>
                Parent 1 overnights per year
                <input type="number" name="overnightsParent1" min="0" max="365" value="${field("overnightsParent1")}" />
              </label>
            </div>
            <div class="grid two">
              <fieldset class="choice-group">
                <legend>Custody type</legend>
                <label><input type="radio" name="custodyType" value="PRIMARY" ${checked("custodyType", "PRIMARY")} /> Primary custody (Worksheet A)</label>
                <label><input type="radio" name="custodyType" value="SHARED" ${checked("custodyType", "SHARED")} /> Shared custody (Worksheet B)</label>
              </fieldset>
              <label>
                Primary custodian
                <select name="primaryCustodian">
                  <option value="P1" ${selected("primaryCustodian", "P1")}>Parent 1</option>
                  <option value="P2" ${selected("primaryCustodian", "P2")}>Parent 2</option>
                </select>
              </label>
            </div>
            <p class="muted">If shared custody is selected, the overnights entry is used to calculate the split.</p>
          </section>
        `,
      };
    case 4:
      return {
        visibleFields: [
          "parent1_actualMonthly",
          "parent1_preexistingSupportPaid",
          "parent1_alimonyPaid",
          "parent1_alimonyReceived",
          "parent1_multifamilyChildrenInHome",
        ],
        content: `
          <section class="step">
            <h2>Parent 1 income</h2>
            <p>Enter monthly figures. Leave a field blank or zero if it does not apply.</p>
            <div class="grid three">
              <label>Actual monthly income<input type="number" step="0.01" name="parent1_actualMonthly" value="${field("parent1_actualMonthly")}" /></label>
              <label>Preexisting support paid<input type="number" step="0.01" name="parent1_preexistingSupportPaid" value="${field("parent1_preexistingSupportPaid")}" /></label>
              <label>Alimony paid<input type="number" step="0.01" name="parent1_alimonyPaid" value="${field("parent1_alimonyPaid")}" /></label>
              <label>Alimony received<input type="number" step="0.01" name="parent1_alimonyReceived" value="${field("parent1_alimonyReceived")}" /></label>
              <label>Additional in-home children<input type="number" min="0" step="1" name="parent1_multifamilyChildrenInHome" value="${field("parent1_multifamilyChildrenInHome")}" /></label>
            </div>
          </section>
        `,
      };
    case 5:
      return {
        visibleFields: [
          "parent2_actualMonthly",
          "parent2_preexistingSupportPaid",
          "parent2_alimonyPaid",
          "parent2_alimonyReceived",
          "parent2_multifamilyChildrenInHome",
        ],
        content: `
          <section class="step">
            <h2>Parent 2 income</h2>
            <p>Enter monthly figures. Leave a field blank or zero if it does not apply.</p>
            <div class="grid three">
              <label>Actual monthly income<input type="number" step="0.01" name="parent2_actualMonthly" value="${field("parent2_actualMonthly")}" /></label>
              <label>Preexisting support paid<input type="number" step="0.01" name="parent2_preexistingSupportPaid" value="${field("parent2_preexistingSupportPaid")}" /></label>
              <label>Alimony paid<input type="number" step="0.01" name="parent2_alimonyPaid" value="${field("parent2_alimonyPaid")}" /></label>
              <label>Alimony received<input type="number" step="0.01" name="parent2_alimonyReceived" value="${field("parent2_alimonyReceived")}" /></label>
              <label>Additional in-home children<input type="number" min="0" step="1" name="parent2_multifamilyChildrenInHome" value="${field("parent2_multifamilyChildrenInHome")}" /></label>
            </div>
          </section>
        `,
      };
    case 6:
      return {
        visibleFields: [
          "addOns_childcare",
          "addOns_healthInsurance",
          "addOns_extraordinaryMedical",
          "addOns_cashMedicalIVD",
          "addOns_additionalExpenses",
          "directPay_parent1_childcare",
          "directPay_parent1_healthInsurance",
          "directPay_parent1_extraordinaryMedical",
          "directPay_parent1_cashMedicalIVD",
          "directPay_parent1_additionalExpenses",
          "directPay_parent2_childcare",
          "directPay_parent2_healthInsurance",
          "directPay_parent2_extraordinaryMedical",
          "directPay_parent2_cashMedicalIVD",
          "directPay_parent2_additionalExpenses",
        ],
        content: `
          <section class="step">
            <h2>Add-on expenses & direct payments</h2>
            <p>Include monthly amounts paid for child-related expenses and any direct contributions each parent makes toward them.</p>
            <div class="grid three">
              <label>Childcare<input type="number" step="0.01" name="addOns_childcare" value="${field("addOns_childcare")}" /></label>
              <label>Health insurance<input type="number" step="0.01" name="addOns_healthInsurance" value="${field("addOns_healthInsurance")}" /></label>
              <label>Extraordinary medical<input type="number" step="0.01" name="addOns_extraordinaryMedical" value="${field("addOns_extraordinaryMedical")}" /></label>
              <label>Cash medical (IV-D)<input type="number" step="0.01" name="addOns_cashMedicalIVD" value="${field("addOns_cashMedicalIVD")}" /></label>
              <label>Additional expenses<input type="number" step="0.01" name="addOns_additionalExpenses" value="${field("addOns_additionalExpenses")}" /></label>
            </div>
            <div class="direct-pay">
              <div>
                <h3>Parent 1 direct pay</h3>
                <label>Childcare<input type="number" step="0.01" name="directPay_parent1_childcare" value="${field("directPay_parent1_childcare")}" /></label>
                <label>Health insurance<input type="number" step="0.01" name="directPay_parent1_healthInsurance" value="${field("directPay_parent1_healthInsurance")}" /></label>
                <label>Extraordinary medical<input type="number" step="0.01" name="directPay_parent1_extraordinaryMedical" value="${field("directPay_parent1_extraordinaryMedical")}" /></label>
                <label>Cash medical (IV-D)<input type="number" step="0.01" name="directPay_parent1_cashMedicalIVD" value="${field("directPay_parent1_cashMedicalIVD")}" /></label>
                <label>Additional expenses<input type="number" step="0.01" name="directPay_parent1_additionalExpenses" value="${field("directPay_parent1_additionalExpenses")}" /></label>
              </div>
              <div>
                <h3>Parent 2 direct pay</h3>
                <label>Childcare<input type="number" step="0.01" name="directPay_parent2_childcare" value="${field("directPay_parent2_childcare")}" /></label>
                <label>Health insurance<input type="number" step="0.01" name="directPay_parent2_healthInsurance" value="${field("directPay_parent2_healthInsurance")}" /></label>
                <label>Extraordinary medical<input type="number" step="0.01" name="directPay_parent2_extraordinaryMedical" value="${field("directPay_parent2_extraordinaryMedical")}" /></label>
                <label>Cash medical (IV-D)<input type="number" step="0.01" name="directPay_parent2_cashMedicalIVD" value="${field("directPay_parent2_cashMedicalIVD")}" /></label>
                <label>Additional expenses<input type="number" step="0.01" name="directPay_parent2_additionalExpenses" value="${field("directPay_parent2_additionalExpenses")}" /></label>
              </div>
            </div>
          </section>
        `,
      };
    case 7:
    default:
      return {
        visibleFields: [],
        content: `
          <section class="step">
            <h2>Review & results</h2>
            <p>Confirm the information below. Use the back button to make changes to any step.</p>
            ${renderDataSummary(form)}
            ${renderResult(result)}
            ${!result ? '<p class="muted">Complete all required fields to generate a worksheet.</p>' : ""}
          </section>
        `,
      };
  }
}

function clampStep(step: number): number {
  if (!Number.isFinite(step)) return 1;
  if (step < 1) return 1;
  if (step > TOTAL_STEPS) return TOTAL_STEPS;
  return step;
}

function renderPage({ form, step, result, errors }: RenderOptions): string {
  const errList = errors && errors.length
    ? `<div class="errors"><h2>Validation issues</h2><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>`
    : "";

  const field = (name: string) => escapeHtml(form[name] ?? "");
  const checked = (name: string, value: string) => (form[name] === value ? "checked" : "");
  const selected = (name: string, value: string) => (form[name] === value ? "selected" : "");

  const template = renderStepContent(step, { field, checked, selected }, result, form);
  const hiddenInputs = renderHiddenInputs(form, template.visibleFields);

  const progress = steps
    .map((definition) => {
      const state = definition.id === step ? "current" : definition.id < step ? "complete" : "upcoming";
      return `
        <li class="${state}">
          <span class="step-number">${definition.id}</span>
          <div>
            <p class="step-title">${escapeHtml(definition.title)}</p>
            <p class="step-description">${escapeHtml(definition.description)}</p>
          </div>
        </li>`;
    })
    .join("");

  const showBack = step > 1;
  const isFinalStep = step === TOTAL_STEPS;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Maryland Child Support Calculator</title>
  <style>
    :root {
      color-scheme: light;
    }
    * { box-sizing: border-box; }
    body { font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 0; background: #f5f7fb; color: #1f2933; }
    header { background: #1f3269; color: white; padding: 1.5rem 2rem; }
    header h1 { margin: 0; font-size: 1.8rem; }
    header p { margin: 0.25rem 0 0; max-width: 60ch; }
    main { padding: 1.5rem 2rem 3rem; max-width: 1200px; margin: 0 auto; }
    .wizard { display: grid; gap: 1.5rem; }
    .stepper { list-style: none; margin: 0; padding: 0; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .stepper li { background: white; border-radius: 12px; padding: 1rem; border: 1px solid #d0d7e2; display: grid; grid-template-columns: auto 1fr; gap: 0.75rem; align-items: center; }
    .stepper li.current { border-color: #3b82f6; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12); }
    .stepper li.complete { border-color: #16a34a; }
    .stepper li.complete .step-number { background: #16a34a; }
    .stepper li.upcoming { opacity: 0.8; }
    .step-number { display: inline-flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem; border-radius: 50%; background: #3b82f6; color: white; font-weight: 600; }
    .stepper .step-title { font-weight: 600; margin: 0; }
    .stepper .step-description { margin: 0.25rem 0 0; font-size: 0.9rem; color: #4a5668; }
    form { background: white; border-radius: 16px; padding: 1.75rem; box-shadow: 0 18px 38px rgba(15, 23, 42, 0.12); display: grid; gap: 1.5rem; }
    form section.step { display: grid; gap: 1rem; }
    label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.95rem; color: #1f2933; }
    input[type="text"], input[type="number"], select { padding: 0.5rem 0.6rem; border-radius: 8px; border: 1px solid #c2c8d4; font-size: 1rem; background: #f9fbff; }
    input[type="text"]:focus, input[type="number"]:focus, select:focus { outline: 2px solid #3b82f6; outline-offset: 2px; background: white; }
    .grid { display: grid; gap: 1rem; }
    .grid.two { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .grid.three { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
    fieldset.choice-group { border: 1px solid #d0d7e2; border-radius: 10px; padding: 1rem; display: grid; gap: 0.5rem; }
    fieldset.choice-group legend { font-weight: 600; padding: 0 0.5rem; }
    .callout { background: #eff6ff; border: 1px solid #c7ddff; border-radius: 12px; padding: 1rem 1.25rem; }
    .callout ul { margin: 0.75rem 0 0; padding-left: 1.2rem; }
    .callout li { margin: 0.35rem 0; }
    .direct-pay { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .direct-pay h3 { margin-top: 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: flex-end; align-items: center; }
    button { background: #2563eb; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 999px; font-size: 1rem; cursor: pointer; transition: transform 0.1s ease, box-shadow 0.1s ease; }
    button:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3); }
    button.secondary { background: white; color: #1f2933; border: 1px solid #c2c8d4; }
    button.secondary:hover { box-shadow: none; transform: none; background: #f3f4f6; }
    button.link-button { background: transparent; color: #2563eb; border: none; padding: 0.5rem 0.75rem; }
    button.link-button:hover { text-decoration: underline; box-shadow: none; transform: none; }
    .errors { background: #fff5f5; border: 1px solid #feb2b2; color: #822727; padding: 1rem 1.25rem; border-radius: 12px; }
    .errors ul { margin: 0.5rem 0 0; padding-left: 1.2rem; }
    .muted { color: #64748b; }
    .advisory { background: #fef3c7; border-radius: 8px; padding: 0.75rem 1rem; border: 1px solid #facc15; }
    .review { display: grid; gap: 1.25rem; }
    .summary-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .summary-card { background: #f9fbff; border-radius: 12px; border: 1px solid #dbe5ff; padding: 1rem 1.25rem; display: grid; gap: 0.25rem; }
    .summary-card h3 { margin: 0 0 0.5rem; }
    .summary-card dl { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem 1rem; }
    .summary-card dt { font-weight: 600; }
    .summary-card dd { margin: 0; text-align: right; }
    .results { background: white; border-radius: 16px; border: 1px solid #d0d7e2; padding: 1.5rem; display: grid; gap: 1.25rem; }
    .results header { padding: 0; background: none; color: inherit; }
    .summary { font-size: 1.15rem; }
    .results-grid { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .result-card { background: #f9fbff; border-radius: 12px; border: 1px solid #dbe5ff; padding: 1rem 1.25rem; }
    .worksheet table { width: 100%; border-collapse: collapse; }
    .worksheet th, .worksheet td { border-bottom: 1px solid #e2e8f0; padding: 0.45rem 0.5rem; text-align: left; }
    .worksheet tbody tr:nth-child(odd) { background: #eef2ff; }
    @media (max-width: 768px) {
      header, main { padding: 1rem; }
      form { padding: 1.25rem; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Maryland Child Support Calculator</h1>
    <p>A guided interview that prepares the official Maryland child support worksheets.</p>
  </header>
  <main>
    <div class="wizard">
      <ol class="stepper">${progress}</ol>
      ${errList}
      <form method="post" action="/">
        <input type="hidden" name="currentStep" value="${step}" />
        ${hiddenInputs}
        ${template.content}
        <div class="actions">
          ${showBack ? '<button type="submit" name="navigate" value="back" class="secondary" formnovalidate>Back</button>' : ""}
          <button type="submit" name="navigate" value="${isFinalStep ? "calculate" : "next"}">${isFinalStep ? "Update results" : "Next"}</button>
          <button type="submit" name="navigate" value="reset" class="link-button" formnovalidate>Start over</button>
        </div>
      </form>
    </div>
  </main>
</body>
</html>`;
}

function parseStep(value: string | null): number {
  if (!value) return 1;
  const num = Number(value);
  return clampStep(Number.isFinite(num) ? num : 1);
}

function handleWizardResponse(res: http.ServerResponse, html: string) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;
  const isWizardRoute = path === "/" || path === "/calculate";

  if (method === "GET" && isWizardRoute) {
    const step = parseStep(url.searchParams.get("step"));
    const html = renderPage({ form: { ...defaultForm }, step, result: null });
    handleWizardResponse(res, html);
    return;
  }

  if (method === "POST" && isWizardRoute) {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const params = new URLSearchParams(body);
      const navigate = params.get("navigate") ?? "next";
      const currentStep = parseStep(params.get("currentStep"));

      let form = { ...defaultForm };

      if (navigate !== "reset") {
        const updates: FormState = {};
        for (const [key, value] of params.entries()) {
          if (key === "currentStep" || key === "navigate") continue;
          updates[key] = value;
        }
        form = mergeForm(defaultForm, updates);
      }

      let nextStep = currentStep;
      if (navigate === "back") {
        nextStep = clampStep(currentStep - 1);
      } else if (navigate === "next") {
        nextStep = clampStep(currentStep + 1);
      } else if (navigate === "calculate") {
        nextStep = TOTAL_STEPS;
      } else if (navigate === "reset") {
        nextStep = 1;
        form = { ...defaultForm };
      }

      let result: CaseOutputs | null = null;
      let errors: string[] | undefined;

      if (nextStep === TOTAL_STEPS) {
        const { inputs, errors: validationErrors } = buildInputs(form);
        const errorList = [...validationErrors];
        if (inputs) {
          try {
            result = calculateCase(inputs, demoSchedule);
          } catch (err) {
            errorList.push(err instanceof Error ? err.message : String(err));
          }
        }
        errors = errorList.length ? errorList : undefined;
      }

      const html = renderPage({ form, step: nextStep, result, errors });
      handleWizardResponse(res, html);
    });
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Not Found");
}

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const host = process.env.HOST || "0.0.0.0";

http.createServer(handleRequest).listen(port, host, () => {
  console.log(`Child support calculator running on http://${host}:${port}`);
});
