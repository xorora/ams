import type { AssignmentListItem } from "./assignments-service";
import type { CompensationListItem, CompensationRecord } from "./compensation-service";
import type { SalarySlipDetail, SalarySlipListItem } from "./salary-slip-service";

export function serializeAssignment(assignment: AssignmentListItem) {
  return {
    userId: assignment.userId,
    userEmail: assignment.userEmail,
    userName: assignment.userName,
    companyId: assignment.companyId,
    companyName: assignment.companyName,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
  };
}

export function serializeCompensationListItem(item: CompensationListItem) {
  return {
    employeeId: item.employeeId,
    employeeCode: item.employeeCode,
    fullName: item.fullName,
    department: item.department,
    designation: item.designation,
    joiningDate: item.joiningDate,
    grossSalaryPkr: item.grossSalaryPkr,
    basicSalaryPkr: item.basicSalaryPkr,
    conveyanceAllowancePkr: item.conveyanceAllowancePkr,
    adhocPkr: item.adhocPkr,
    hrAllowancePkr: item.hrAllowancePkr,
    medicalAllowancePkr: item.medicalAllowancePkr,
    bankName: item.bankName,
    bankAccountNumber: item.bankAccountNumber,
    fixedSecurityDeductionPkr: item.fixedSecurityDeductionPkr,
    fixedOtherPayPkr: item.fixedOtherPayPkr,
    updatedAt: item.updatedAt?.toISOString() ?? null,
    workingDays: item.workingDays,
    daysWorked: item.daysWorked,
    leaveDeductionPkr: item.leaveDeductionPkr,
    earnedSalaryPkr: item.earnedSalaryPkr,
    incomeTaxPkr: item.incomeTaxPkr,
    totalDeductionPkr: item.totalDeductionPkr,
    netSalaryPkr: item.netSalaryPkr,
    salarySlipId: item.salarySlipId,
  };
}

export function serializeCompensation(record: CompensationRecord) {
  return {
    id: record.id,
    employeeId: record.employeeId,
    grossSalaryPkr: record.grossSalaryPkr,
    basicSalaryPkr: record.basicSalaryPkr,
    conveyanceAllowancePkr: record.conveyanceAllowancePkr,
    adhocPkr: record.adhocPkr,
    hrAllowancePkr: record.hrAllowancePkr,
    medicalAllowancePkr: record.medicalAllowancePkr,
    bankName: record.bankName,
    bankAccountNumber: record.bankAccountNumber,
    fixedSecurityDeductionPkr: record.fixedSecurityDeductionPkr,
    fixedOtherPayPkr: record.fixedOtherPayPkr,
    updatedByUserId: record.updatedByUserId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function serializeSalarySlipListItem(item: SalarySlipListItem) {
  return {
    id: item.id,
    employeeId: item.employeeId,
    employeeCode: item.employeeCode,
    employeeName: item.employeeName,
    department: item.department,
    designation: item.designation,
    companyId: item.companyId,
    companyName: item.companyName,
    yearMonth: item.yearMonth,
    netSalaryPkr: item.netSalaryPkr,
    calculatedSalaryPkr: item.calculatedSalaryPkr,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function serializeSalarySlipDetail(item: SalarySlipDetail) {
  return {
    ...serializeSalarySlipListItem(item),
    incomeTaxPkr: item.incomeTaxPkr,
    additionalDeductionPkr: item.additionalDeductionPkr,
    deductionDetails: item.deductionDetails,
    otherPayPkr: item.otherPayPkr,
    incrementPkr: item.incrementPkr,
    otherPayableDetails: item.otherPayableDetails,
    totalDays: item.totalDays,
    earnedDays: item.earnedDays,
    deductDays: item.deductDays,
    autoLeaveDeductionPkr: item.autoLeaveDeductionPkr,
    securityDeductionPkr: item.securityDeductionPkr,
    totalOtherPayPkr: item.totalOtherPayPkr,
    totalDeductionPkr: item.totalDeductionPkr,
    transferDetails: item.transferDetails,
    createdByUserId: item.createdByUserId,
    updatedByUserId: item.updatedByUserId,
    grossSalaryPkr: item.grossSalaryPkr,
    basicSalaryPkr: item.basicSalaryPkr,
    conveyanceAllowancePkr: item.conveyanceAllowancePkr,
    adhocPkr: item.adhocPkr,
    hrAllowancePkr: item.hrAllowancePkr,
    medicalAllowancePkr: item.medicalAllowancePkr,
  };
}
