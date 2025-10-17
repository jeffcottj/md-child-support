// src/cli.ts (temp demo)
import * as S from "./schema";
import * as Schedule from "./schedule";
import { computeBasic } from "./calc";
import { sharedStarter } from "./shared";

const sample: S.CaseInputs = {
  numChildrenThisCase: 2,
  custodyType: "SHARED",
  primaryCustodian: "P1",
  overnightsParent1: 200,
  parent1: { actualMonthly: 900, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
  parent2: { actualMonthly: 700, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
  addOns: { childcare: 0, healthInsurance: 0, extraordinaryMedical: 0, cashMedicalIVD: 0, additionalExpenses: 0 },
  directPay: { parent1: { childcare:0, healthInsurance:0, extraordinaryMedical:0, cashMedicalIVD:0, additionalExpenses:0 },
               parent2: { childcare:0, healthInsurance:0, extraordinaryMedical:0, cashMedicalIVD:0, additionalExpenses:0 }, },
};

console.log(sharedStarter(sample, Schedule.demoSchedule, computeBasic));