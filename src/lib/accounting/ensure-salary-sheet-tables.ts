import { sql } from "drizzle-orm";
import { db } from "@/db";

let salarySheetTablesEnsured = false;

/** Create salary sheet import tables if drizzle migrate has not been run yet. */
export async function ensureSalarySheetTables(): Promise<void> {
  if (salarySheetTablesEnsured) {
    return;
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS salary_sheet_imports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      company_id uuid NOT NULL REFERENCES companies(id) ON DELETE cascade,
      year_month text NOT NULL,
      file_name text NOT NULL,
      uploaded_by_user_id uuid NOT NULL REFERENCES users(id),
      uploaded_at timestamptz DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS salary_sheet_imports_company_year_month_idx
    ON salary_sheet_imports (company_id, year_month)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS salary_sheet_rows (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      import_id uuid NOT NULL REFERENCES salary_sheet_imports(id) ON DELETE cascade,
      company_id uuid NOT NULL REFERENCES companies(id) ON DELETE cascade,
      year_month text NOT NULL,
      employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE cascade,
      salary_slip_id uuid REFERENCES salary_slips(id) ON DELETE set null,
      employee_code text NOT NULL,
      employee_name text NOT NULL,
      designation text,
      joining_date text,
      gross_salary_pkr integer DEFAULT 0 NOT NULL,
      basic_salary_pkr integer DEFAULT 0 NOT NULL,
      conveyance_allowance_pkr integer DEFAULT 0 NOT NULL,
      adhoc_pkr integer DEFAULT 0 NOT NULL,
      hr_allowance_pkr integer DEFAULT 0 NOT NULL,
      medical_allowance_pkr integer DEFAULT 0 NOT NULL,
      working_days integer DEFAULT 0 NOT NULL,
      days_worked integer DEFAULT 0 NOT NULL,
      leave_deduction_pkr integer DEFAULT 0 NOT NULL,
      earned_salary_pkr integer DEFAULT 0 NOT NULL,
      income_tax_pkr integer DEFAULT 0 NOT NULL,
      total_deduction_pkr integer DEFAULT 0 NOT NULL,
      net_salary_pkr integer DEFAULT 0 NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS salary_sheet_rows_company_year_month_employee_idx
    ON salary_sheet_rows (company_id, year_month, employee_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS salary_sheet_rows_import_id_idx
    ON salary_sheet_rows (import_id)
  `);

  salarySheetTablesEnsured = true;
}
