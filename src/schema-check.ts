import { CaseInputs } from "./schema";

// A minimal primary-custody sample:
const sample: CaseInputs = {
  numChildrenThisCase: 1,
  custodyType: "PRIMARY",
  overnightsParent1: 300, // ignored for PRIMARY, but harmless to keep
  parent1: {
    actualMonthly: 5000,
    preexistingSupportPaid: 0,
    alimonyPaid: 0,
    alimonyReceived: 0,
    multifamilyChildrenInHome: 0,
  },
  parent2: {
    actualMonthly: 3000,
    preexistingSupportPaid: 0,
    alimonyPaid: 0,
    alimonyReceived: 0,
    multifamilyChildrenInHome: 0,
  },
  addOns: {
    childcare: 400,
    healthInsurance: 150,
    extraordinaryMedical: 0,
    cashMedicalIVD: 0,
    additionalExpenses: 0,
  },
};

console.log("Sample inputs look good:", sample);