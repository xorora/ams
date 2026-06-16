import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "employee"]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "leave",
  "weekend_off",
]);
export const attendanceSourceEnum = pgEnum("attendance_source", ["auto", "manual", "system"]);
export const leaveTypeEnum = pgEnum("leave_type", ["annual", "casual", "sick"]);
export const leaveRequestStatusEnum = pgEnum("leave_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeCode: text("employee_code").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  department: text("department"),
  designation: text("designation"),
  machineCardNo: text("machine_card_no").unique(),
  companyId: uuid("company_id")
    .notNull()
    .references((): AnyPgColumn => companies.id),
  isActive: boolean("is_active").notNull().default(true),
  probationEnabled: boolean("probation_enabled").notNull().default(false),
  probationCompleted: boolean("probation_completed").notNull().default(false),
  probationStartDate: date("probation_start_date"),
  probationPeriodMonths: integer("probation_period_months").notNull().default(3),
  userId: uuid("user_id").references((): AnyPgColumn => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("employee"),
  googleSubject: text("google_subject").unique(),
  employeeId: uuid("employee_id").references((): AnyPgColumn => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const officeSettings = pgTable("office_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  radiusMeters: integer("radius_meters").notNull().default(100),
  timezone: text("timezone").notNull().default("Asia/Karachi"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attendanceDays = pgTable(
  "attendance_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    shiftDate: date("shift_date").notNull(),
    status: attendanceStatusEnum("status").notNull().default("present"),
    source: attendanceSourceEnum("source").notNull().default("auto"),
    checkInAt: timestamp("check_in_at", { withTimezone: true }),
    checkOutAt: timestamp("check_out_at", { withTimezone: true }),
    checkInLat: real("check_in_lat"),
    checkInLng: real("check_in_lng"),
    checkOutLat: real("check_out_lat"),
    checkOutLng: real("check_out_lng"),
    isLate: boolean("is_late").notNull().default(false),
    isEarlyLeave: boolean("is_early_leave").notNull().default(false),
    isMissedCheckout: boolean("is_missed_checkout").notNull().default(false),
    overtimeStartedAt: timestamp("overtime_started_at", { withTimezone: true }),
    overtimeEndedAt: timestamp("overtime_ended_at", { withTimezone: true }),
    overtimeSeconds: integer("overtime_seconds"),
    totalBreakSeconds: integer("total_break_seconds").notNull().default(0),
    notes: text("notes"),
    editedByUserId: uuid("edited_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("attendance_days_employee_shift_date_idx").on(table.employeeId, table.shiftDate),
    index("attendance_days_shift_date_status_idx").on(table.shiftDate, table.status),
  ],
);

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    leaveType: leaveTypeEnum("leave_type").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    daysCount: integer("days_count").notNull(),
    reason: text("reason").notNull(),
    medicalCertificateNote: text("medical_certificate_note"),
    status: leaveRequestStatusEnum("status").notNull().default("pending"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("leave_requests_employee_id_idx").on(table.employeeId),
    index("leave_requests_status_idx").on(table.status),
    index("leave_requests_start_date_idx").on(table.startDate),
  ],
);

export const machinePunches = pgTable(
  "machine_punches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Tran_MachineRawPunchId from the Access DB; idempotency key for the sync.
    sourcePunchId: integer("source_punch_id").notNull().unique(),
    cardNo: text("card_no").notNull(),
    // PunchDatetime, converted from machine-local time to UTC by the sync script.
    punchAt: timestamp("punch_at", { withTimezone: true }).notNull(),
    machineNo: text("machine_no"),
    isManual: boolean("is_manual").notNull().default(false),
    // Resolved on the Access side by joining CardNo -> Mst_Employee.
    machineEmpCode: text("machine_emp_code"),
    machineEmpName: text("machine_emp_name"),
    sourceEmpId: integer("source_emp_id"),
    // Best-effort link to an app employee via employees.machineCardNo.
    employeeId: uuid("employee_id").references((): AnyPgColumn => employees.id),
    // Original PunchDatetime string as stored by the device, for auditing.
    rawPunchAt: text("raw_punch_at"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("machine_punches_punch_at_idx").on(table.punchAt),
    index("machine_punches_card_no_idx").on(table.cardNo),
    index("machine_punches_employee_id_idx").on(table.employeeId),
  ],
);

export const biometricEmployeeMappings = pgTable("biometric_employee_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Mst_Employee.Empid from the Access DB; durable key for the sync service.
  sourceEmpId: integer("source_emp_id").notNull().unique(),
  cardNo: text("card_no").notNull().unique(),
  machineEmpCode: text("machine_emp_code"),
  machineEmpName: text("machine_emp_name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  employeeId: uuid("employee_id")
    .notNull()
    .references((): AnyPgColumn => employees.id),
  // card | mapping | exact_name | fuzzy_name | created
  matchMethod: text("match_method").notNull(),
  matchScore: real("match_score"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const breakSessions = pgTable("break_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  attendanceDayId: uuid("attendance_day_id")
    .notNull()
    .references(() => attendanceDays.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
});
