import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSalarySlipPdf, type SalarySlipPdfData } from "../src/lib/accounting/salary-slip-pdf";

const sampleData: SalarySlipPdfData = {
  companyName: "Xorora Technologies",
  yearMonth: "2026-05",
  employeeCode: "EMP-1042",
  employeeName: "Ayesha Khan",
  department: "ADMINISTRATION",
  designation: "Senior Executive Assistant",
  totalDays: 31,
  earnedDays: 31,
  deductDays: 0,
  calculatedSalaryPkr: 85_000,
  autoLeaveDeductionPkr: 0,
  incomeTaxPkr: 4_250,
  securityDeductionPkr: 2_000,
  additionalDeductionPkr: 0,
  deductionDetails: null,
  totalDeductionPkr: 6_250,
  totalOtherPayPkr: 5_000,
  incrementPkr: 0,
  otherPayableDetails: "Transport allowance — PKR 5,000",
  netSalaryPkr: 83_750,
  transferDetails: "HBL - 1234567890123456",
};

async function main() {
  const outputPath = resolve(process.cwd(), "docs/sample-salary-slip.pdf");
  const buffer = await buildSalarySlipPdf(sampleData);
  writeFileSync(outputPath, buffer);
  console.log(`Sample salary slip written to ${outputPath} (${buffer.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
