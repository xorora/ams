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
export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "leave"]);
export const attendanceSourceEnum = pgEnum("attendance_source", ["auto", "manual", "system"]);
export const leaveTypeEnum = pgEnum("leave_type", ["annual", "casual", "sick"]);
export const leaveRequestStatusEnum = pgEnum("leave_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeCode: text("employee_code").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  department: text("department"),
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

export const breakSessions = pgTable("break_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  attendanceDayId: uuid("attendance_day_id")
    .notNull()
    .references(() => attendanceDays.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
});
