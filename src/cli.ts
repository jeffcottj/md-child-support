import * as S from "./schema";
import * as Schedule from "./schedule";
import { computePrimaryTotals } from "./calc";

// Make combined AAI = 1600 so we hit the 2000 row via "next higher"
const sample: S.CaseInputs = {
  numChildrenThisCase: 2,
  custodyType: "PRIMARY",
  overnightsParent1: 365,
  parent1: { actualMonthly: 900, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
  parent2: { actualMonthly: 700, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
  addOns: {
    childcare: 120,          // pick some non-zero numbers
    healthInsurance: 30,
    extraordinaryMedical: 0,
    cashMedicalIVD: 0,
    additionalExpenses: 0,
  },
};

const res = computePrimaryTotals(sample, Schedule.demoSchedule);
console.log(res);