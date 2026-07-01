import type {
  serializeAssignment,
  serializeCompensation,
  serializeCompensationListItem,
  serializeSalarySlipDetail,
  serializeSalarySlipListItem,
} from "./serialize";

export type SerializedAssignment = ReturnType<typeof serializeAssignment>;
export type SerializedCompensationListItem = ReturnType<typeof serializeCompensationListItem>;
export type SerializedCompensation = ReturnType<typeof serializeCompensation>;
export type SerializedSalarySlipListItem = ReturnType<typeof serializeSalarySlipListItem>;
export type SerializedSalarySlipDetail = ReturnType<typeof serializeSalarySlipDetail>;
