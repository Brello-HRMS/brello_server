-- =====================================================================
--  Payroll Processing (Till Lock) — schema migration
--
--  Adds the monthly payroll-run workflow:
--    - leave_types.is_paid          (paid vs unpaid leave → LOP)
--    - payroll_runs                 (the Draft→Processing→Completed→Locked cycle)
--    - payroll_run_items            (per-employee frozen payslip data)
--    - payroll_run_adjustments      (manual bonus / deduction lines)
--
--  Dev environments auto-sync from the entities (synchronize=true) and do NOT
--  need this file. Run it only where synchronize is disabled (prod/staging).
--
--  Usage:
--    1. Set the schema in the SET search_path line below (dev: brello_dev,
--       prod: brello) to match your environment.
--    2. Run:  psql "<conn-string>" -f docs/migrations/2026-05-31-payroll-processing.sql
--
--  Safe to re-run. Every statement is guarded (IF NOT EXISTS / catalog checks).
-- =====================================================================

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

-- ─── 0. Leave type: paid / unpaid flag ───────────────────────────────────────
ALTER TABLE leave_types
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT true;

-- ─── 1. Enum types (created once, in the active schema) ───────────────────────
DO $$
DECLARE
  v_schema text := current_schema();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'payroll_runs_month_enum' AND n.nspname = v_schema) THEN
    CREATE TYPE payroll_runs_month_enum AS ENUM
      ('jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'payroll_runs_run_status_enum' AND n.nspname = v_schema) THEN
    CREATE TYPE payroll_runs_run_status_enum AS ENUM
      ('draft','processing','completed','locked');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'payroll_run_items_item_status_enum' AND n.nspname = v_schema) THEN
    CREATE TYPE payroll_run_items_item_status_enum AS ENUM
      ('pending','processed','error');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'payroll_run_adjustments_adjustment_type_enum' AND n.nspname = v_schema) THEN
    CREATE TYPE payroll_run_adjustments_adjustment_type_enum AS ENUM
      ('bonus','deduction');
  END IF;

  -- BaseEntity.status enums (one per table, matching TypeORM's per-column naming)
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'payroll_runs_status_enum' AND n.nspname = v_schema) THEN
    CREATE TYPE payroll_runs_status_enum AS ENUM
      ('ACTIVE','INACTIVE','DELETED','PENDING','ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'payroll_run_items_status_enum' AND n.nspname = v_schema) THEN
    CREATE TYPE payroll_run_items_status_enum AS ENUM
      ('ACTIVE','INACTIVE','DELETED','PENDING','ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'payroll_run_adjustments_status_enum' AND n.nspname = v_schema) THEN
    CREATE TYPE payroll_run_adjustments_status_enum AS ENUM
      ('ACTIVE','INACTIVE','DELETED','PENDING','ARCHIVED');
  END IF;
END $$;

-- ─── 2. payroll_runs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_runs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id               uuid,
  organization_id             uuid,
  status                      payroll_runs_status_enum NOT NULL DEFAULT 'ACTIVE',
  code                        varchar(50),
  description                 text,
  created_at                  timestamp NOT NULL DEFAULT now(),
  updated_at                  timestamp NOT NULL DEFAULT now(),
  modified_by                 uuid,
  modified_at                 timestamp,
  deleted_by                  uuid,
  deleted_at                  timestamp,

  month                       payroll_runs_month_enum NOT NULL,
  year                        integer NOT NULL,
  run_status                  payroll_runs_run_status_enum NOT NULL DEFAULT 'draft',
  pay_period_from             date NOT NULL,
  pay_period_to               date NOT NULL,
  total_working_days          integer NOT NULL DEFAULT 0,
  total_employees             integer NOT NULL DEFAULT 0,
  total_gross                 numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions            numeric(14,2) NOT NULL DEFAULT 0,
  total_net                   numeric(14,2) NOT NULL DEFAULT 0,
  total_employer_contribution numeric(14,2) NOT NULL DEFAULT 0,
  total_reimbursement         numeric(14,2) NOT NULL DEFAULT 0,
  processed_at                timestamp,
  processed_by                uuid,
  locked_at                   timestamp,
  locked_by                   uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_runs_org_year_month
  ON payroll_runs (organization_id, year, month);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_org_status
  ON payroll_runs (organization_id, run_status);

-- ─── 3. payroll_run_items ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_run_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id         uuid,
  organization_id       uuid,
  status                payroll_run_items_status_enum NOT NULL DEFAULT 'ACTIVE',
  code                  varchar(50),
  description           text,
  created_at            timestamp NOT NULL DEFAULT now(),
  updated_at            timestamp NOT NULL DEFAULT now(),
  modified_by           uuid,
  modified_at           timestamp,
  deleted_by            uuid,
  deleted_at            timestamp,

  payroll_run_id        uuid NOT NULL REFERENCES payroll_runs (id) ON DELETE CASCADE,
  user_id               uuid NOT NULL,
  total_working_days    integer NOT NULL DEFAULT 0,
  present_days          numeric(6,2) NOT NULL DEFAULT 0,
  paid_leave_days       numeric(6,2) NOT NULL DEFAULT 0,
  lop_days              numeric(6,2) NOT NULL DEFAULT 0,
  gross                 numeric(14,2) NOT NULL DEFAULT 0,
  deductions_total      numeric(14,2) NOT NULL DEFAULT 0,
  net                   numeric(14,2) NOT NULL DEFAULT 0,
  employer_contribution numeric(14,2) NOT NULL DEFAULT 0,
  reimbursement_total   numeric(14,2) NOT NULL DEFAULT 0,
  bonus_total           numeric(14,2) NOT NULL DEFAULT 0,
  item_status           payroll_run_items_item_status_enum NOT NULL DEFAULT 'pending',
  error_message         text,
  salary_snapshot       jsonb,
  calc_breakdown        jsonb,
  payslip_pdf_key       varchar(512)
);

-- For environments where payroll_run_items already exists from an earlier run.
ALTER TABLE payroll_run_items
  ADD COLUMN IF NOT EXISTS payslip_pdf_key varchar(512);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_run_items_run_user
  ON payroll_run_items (payroll_run_id, user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_run_items_run_status
  ON payroll_run_items (payroll_run_id, item_status);

-- ─── 4. payroll_run_adjustments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_run_adjustments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id    uuid,
  organization_id  uuid,
  status           payroll_run_adjustments_status_enum NOT NULL DEFAULT 'ACTIVE',
  code             varchar(50),
  description      text,
  created_at       timestamp NOT NULL DEFAULT now(),
  updated_at       timestamp NOT NULL DEFAULT now(),
  modified_by      uuid,
  modified_at      timestamp,
  deleted_by       uuid,
  deleted_at       timestamp,

  payroll_run_id   uuid NOT NULL REFERENCES payroll_runs (id) ON DELETE CASCADE,
  user_id          uuid NOT NULL,
  adjustment_type  payroll_run_adjustments_adjustment_type_enum NOT NULL,
  amount           numeric(12,2) NOT NULL,
  reason           text,
  created_by       uuid NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payroll_run_adjustments_run_user
  ON payroll_run_adjustments (payroll_run_id, user_id);
