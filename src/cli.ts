/**
 * A tiny demonstration command-line script that runs the calculator with a
 * hard-coded example.  It is meant for curious readers or testers who want to
 * see sample numbers without building a user interface yet.
 */
import * as S from "./schema";
import * as Schedule from "./schedule";
import { calculateCase } from "./calc";

// Example scenario mirroring Worksheet B inputs.  Feel free to modify the
// numbers while experimenting from the terminal.
const sample: S.CaseInputs = {
  numChildrenThisCase: 2,
  custodyType: "SHARED",
  primaryCustodian: "P1",
  overnightsParent1: 200,
  parent1: {
    actualMonthly: 900,
    preexistingSupportPaid: 0,
    alimonyPaid: 0,
    alimonyReceived: 0,
    multifamilyChildrenInHome: 0,
  },
  parent2: {
    actualMonthly: 700,
    preexistingSupportPaid: 0,
    alimonyPaid: 0,
    alimonyReceived: 0,
    multifamilyChildrenInHome: 0,
  },
  addOns: {
    childcare: 120,
    healthInsurance: 30,
    extraordinaryMedical: 0,
    cashMedicalIVD: 0,
    additionalExpenses: 0,
  },
  directPay: {
    parent1: {
      childcare: 120,
      healthInsurance: 0,
      extraordinaryMedical: 0,
      cashMedicalIVD: 0,
      additionalExpenses: 0,
    },
    parent2: {
      childcare: 0,
      healthInsurance: 30,
      extraordinaryMedical: 0,
      cashMedicalIVD: 0,
      additionalExpenses: 0,
    },
  },
};

console.log(calculateCase(sample, Schedule.demoSchedule));
