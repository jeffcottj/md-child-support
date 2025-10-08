// BEFORE
// import { demoSchedule, lookupBasicObligation } from "./schedule";

// AFTER
import * as schedule from "./schedule";

const cases = [
  { combinedIncome: 900,  kids: 2 },
  { combinedIncome: 1600, kids: 2 },
  { combinedIncome: 2100, kids: 2 },
];

for (const c of cases) {
  const res = schedule.lookupBasicObligation(schedule.demoSchedule, c.combinedIncome, c.kids);
  console.log(
    `Income=${c.combinedIncome}, kids=${c.kids} → status=${res.status}, amount=${res.amount}, rowIncome=${res.usedRowIncome}`
  );
}