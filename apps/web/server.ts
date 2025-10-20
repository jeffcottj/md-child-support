import * as http from "http";
import { calculateCase } from "../../src/calc";
import { demoSchedule } from "../../src/schedule";
import { CaseInputs as CaseInputsSchema } from "../../src/schema";
import type { CaseInputs, CaseOutputs } from "../../src/schema";

type FormState = Record<string, string>;

type RenderOptions = {
  form: FormState;
  result?: CaseOutputs | null;
  errors?: string[];
};

const defaultForm: FormState = {
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
    ? Math.abs(result.recommendedOrderParent1PaysParent2).toFixed(2)
    : "–";

  const worksheetRows = Object.entries(result.worksheet)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `
        <tr>
          <th scope="row">${escapeHtml(key)}</th>
          <td>$${value.toFixed(2)}</td>
        </tr>`)
    .join("");

  const notes = result.notes.length
    ? `<ul>${result.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
    : "<p>No additional notes.</p>";

  const advisory = result.advisory
    ? `<p class="advisory">Advisory: ${escapeHtml(result.advisory)}</p>`
    : "";

  return `
    <section class="results">
      <h2>Results (${escapeHtml(result.path)})</h2>
      <p class="summary"><strong>${direction}</strong> — ${amount === "–" ? "Discretionary" : `$${amount}`}</p>
      ${advisory}
      <h3>Worksheet Details</h3>
      <div class="worksheet">
        <table>
          <thead>
            <tr><th scope="col">Line</th><th scope="col">Amount</th></tr>
          </thead>
          <tbody>${worksheetRows}</tbody>
        </table>
      </div>
      <h3>Notes</h3>
      ${notes}
    </section>
  `;
}

function renderPage({ form, result, errors }: RenderOptions): string {
  const errList = errors && errors.length
    ? `<div class="errors"><h2>Validation issues</h2><ul>${errors
        .map((e) => `<li>${escapeHtml(e)}</li>`)
        .join("")}</ul></div>`
    : "";

  const field = (name: string) => escapeHtml(form[name] ?? "");
  const checked = (name: string, value: string) => (form[name] === value ? "checked" : "");
  const selected = (name: string, value: string) => (form[name] === value ? "selected" : "");

  const resultHtml = renderResult(result);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Maryland Child Support Calculator</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 0; background: #f7f7f8; color: #1f2933; }
    header { background: #223a5e; color: white; padding: 1.5rem 2rem; }
    main { padding: 1.5rem 2rem 3rem; display: grid; gap: 2rem; max-width: 1200px; margin: 0 auto; }
    form { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); display: grid; gap: 1rem; }
    fieldset { border: 1px solid #d0d7e2; border-radius: 8px; padding: 1rem 1.25rem; }
    legend { font-weight: 600; }
    label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.95rem; }
    input[type="number"], select { padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid #c2c8d4; font-size: 1rem; }
    .grid { display: grid; gap: 1rem; }
    .grid.two { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .grid.three { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
    .actions { display: flex; justify-content: flex-end; }
    button { background: #1d4ed8; color: white; border: none; padding: 0.75rem 1.25rem; border-radius: 6px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #1a3fb0; }
    .results { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); }
    .results table { width: 100%; border-collapse: collapse; }
    .results th, .results td { border-bottom: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; }
    .results tbody tr:nth-child(odd) { background: #f9fafc; }
    .summary { font-size: 1.1rem; }
    .errors { background: #fff5f5; border: 1px solid #feb2b2; color: #822727; padding: 1rem 1.25rem; border-radius: 8px; }
    .advisory { background: #fef3c7; border-radius: 6px; padding: 0.5rem 0.75rem; }
    @media (max-width: 768px) {
      main { padding: 1rem; }
      form, .results { padding: 1rem; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Maryland Child Support Calculator</h1>
    <p>Enter the financial details below to compute Worksheet A or Worksheet B guidance.</p>
  </header>
  <main>
    ${errList}
    <section>
      <form method="post" action="/calculate">
        <fieldset>
          <legend>Case overview</legend>
          <div class="grid two">
            <label>
              Number of children in this case
              <input type="number" name="numChildrenThisCase" min="1" value="${field("numChildrenThisCase")}" required />
            </label>
            <label>
              Parent 1 overnights
              <input type="number" name="overnightsParent1" min="0" max="365" value="${field("overnightsParent1")}" />
            </label>
          </div>
          <div class="grid two">
            <div>
              <label><input type="radio" name="custodyType" value="PRIMARY" ${checked("custodyType", "PRIMARY")} /> Primary custody</label>
              <label><input type="radio" name="custodyType" value="SHARED" ${checked("custodyType", "SHARED")} /> Shared custody</label>
            </div>
            <label>
              Primary custodian
              <select name="primaryCustodian">
                <option value="P1" ${selected("primaryCustodian", "P1")}>Parent 1</option>
                <option value="P2" ${selected("primaryCustodian", "P2")}>Parent 2</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Parent 1 income</legend>
          <div class="grid three">
            <label>Actual monthly income<input type="number" step="0.01" name="parent1_actualMonthly" value="${field("parent1_actualMonthly")}" /></label>
            <label>Preexisting support paid<input type="number" step="0.01" name="parent1_preexistingSupportPaid" value="${field("parent1_preexistingSupportPaid")}" /></label>
            <label>Alimony paid<input type="number" step="0.01" name="parent1_alimonyPaid" value="${field("parent1_alimonyPaid")}" /></label>
            <label>Alimony received<input type="number" step="0.01" name="parent1_alimonyReceived" value="${field("parent1_alimonyReceived")}" /></label>
            <label>Additional in-home children<input type="number" min="0" step="1" name="parent1_multifamilyChildrenInHome" value="${field("parent1_multifamilyChildrenInHome")}" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Parent 2 income</legend>
          <div class="grid three">
            <label>Actual monthly income<input type="number" step="0.01" name="parent2_actualMonthly" value="${field("parent2_actualMonthly")}" /></label>
            <label>Preexisting support paid<input type="number" step="0.01" name="parent2_preexistingSupportPaid" value="${field("parent2_preexistingSupportPaid")}" /></label>
            <label>Alimony paid<input type="number" step="0.01" name="parent2_alimonyPaid" value="${field("parent2_alimonyPaid")}" /></label>
            <label>Alimony received<input type="number" step="0.01" name="parent2_alimonyReceived" value="${field("parent2_alimonyReceived")}" /></label>
            <label>Additional in-home children<input type="number" min="0" step="1" name="parent2_multifamilyChildrenInHome" value="${field("parent2_multifamilyChildrenInHome")}" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Add-on expenses</legend>
          <div class="grid three">
            <label>Childcare<input type="number" step="0.01" name="addOns_childcare" value="${field("addOns_childcare")}" /></label>
            <label>Health insurance<input type="number" step="0.01" name="addOns_healthInsurance" value="${field("addOns_healthInsurance")}" /></label>
            <label>Extraordinary medical<input type="number" step="0.01" name="addOns_extraordinaryMedical" value="${field("addOns_extraordinaryMedical")}" /></label>
            <label>Cash medical (IV-D)<input type="number" step="0.01" name="addOns_cashMedicalIVD" value="${field("addOns_cashMedicalIVD")}" /></label>
            <label>Additional expenses<input type="number" step="0.01" name="addOns_additionalExpenses" value="${field("addOns_additionalExpenses")}" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Direct payments</legend>
          <div class="grid two">
            <div>
              <h4>Parent 1 direct pay</h4>
              <label>Childcare<input type="number" step="0.01" name="directPay_parent1_childcare" value="${field("directPay_parent1_childcare")}" /></label>
              <label>Health insurance<input type="number" step="0.01" name="directPay_parent1_healthInsurance" value="${field("directPay_parent1_healthInsurance")}" /></label>
              <label>Extraordinary medical<input type="number" step="0.01" name="directPay_parent1_extraordinaryMedical" value="${field("directPay_parent1_extraordinaryMedical")}" /></label>
              <label>Cash medical (IV-D)<input type="number" step="0.01" name="directPay_parent1_cashMedicalIVD" value="${field("directPay_parent1_cashMedicalIVD")}" /></label>
              <label>Additional expenses<input type="number" step="0.01" name="directPay_parent1_additionalExpenses" value="${field("directPay_parent1_additionalExpenses")}" /></label>
            </div>
            <div>
              <h4>Parent 2 direct pay</h4>
              <label>Childcare<input type="number" step="0.01" name="directPay_parent2_childcare" value="${field("directPay_parent2_childcare")}" /></label>
              <label>Health insurance<input type="number" step="0.01" name="directPay_parent2_healthInsurance" value="${field("directPay_parent2_healthInsurance")}" /></label>
              <label>Extraordinary medical<input type="number" step="0.01" name="directPay_parent2_extraordinaryMedical" value="${field("directPay_parent2_extraordinaryMedical")}" /></label>
              <label>Cash medical (IV-D)<input type="number" step="0.01" name="directPay_parent2_cashMedicalIVD" value="${field("directPay_parent2_cashMedicalIVD")}" /></label>
              <label>Additional expenses<input type="number" step="0.01" name="directPay_parent2_additionalExpenses" value="${field("directPay_parent2_additionalExpenses")}" /></label>
            </div>
          </div>
        </fieldset>

        <div class="actions">
          <button type="submit">Calculate</button>
        </div>
      </form>
    </section>
    ${resultHtml || ""}
  </main>
</body>
</html>`;
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method === "POST" && req.url === "/calculate") {
    let body = "";
      req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
      });
    req.on("end", () => {
      const params = new URLSearchParams(body);
      const updates: FormState = {};
      for (const [key, value] of params.entries()) {
        updates[key] = value;
      }
      const form = mergeForm(defaultForm, updates);
      const { inputs, errors } = buildInputs(form);
      let result: CaseOutputs | null = null;
      const errorList = [...errors];
      if (inputs) {
        try {
          result = calculateCase(inputs, demoSchedule);
        } catch (err) {
          errorList.push(err instanceof Error ? err.message : String(err));
        }
      }
      const html = renderPage({ form, result, errors: errorList });
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
    });
    return;
  }

  // Default: render blank form
  const html = renderPage({ form: defaultForm, result: null });
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
}

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const host = process.env.HOST || "0.0.0.0";

http.createServer(handleRequest).listen(port, host, () => {
  console.log(`Child support calculator running on http://${host}:${port}`);
});