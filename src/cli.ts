// src/cli.ts
import * as S from "./schema";
import * as Schedule from "./schedule";
import { computeBasic } from "./calc";

const sample: S.CaseInputs = {
  numChildrenThisCase: 2,
  custodyType: "PRIMARY",
  overnightsParent1: 300, // ignored until we wire shared math
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
    childcare: 0,
    healthInsurance: 0,
    extraordinaryMedical: 0,
    cashMedicalIVD: 0,
    additionalExpenses: 0,
  },
};

const res = computeBasic(sample, Schedule.demoSchedule);
console.log(res);