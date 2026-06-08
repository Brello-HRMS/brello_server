-- =====================================================================
--  Payroll — disbursement tracking, payout status & audit-action values
--
--  Adds:
--    - payroll_runs        → is_disbursed / disbursed_at / disbursed_by /
--                            disbursement_reference (post-lock payout tracking)
--    - payroll_run_items   → payout_status (pending|paid) / paid_at
--    - payroll_audit_logs  → new action enum values: process, lock, disburse
--                            (these were added to the AuditAction enum but the
--                            prod enum type only had create/update/delete)
--
--  Dev auto-syncs from the entities; run this only where synchronize is disabled.
--
--  Usage:
--    1. Set the schema in the SET search_path line below to match your env.
--    2. Run:  psql "<conn-string>" -f docs/migrations/2026-06-08-payroll-disbursement-audit.sql
--
--  Safe to re-run.
-- =====================================================================

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

-- ─── 1. Audit action enum: add the lifecycle values ──────────────────────────
-- (ALTER TYPE ... ADD VALUE runs in autocommit; psql -f is fine.)
ALTER TYPE payroll_audit_logs_action_enum ADD VALUE IF NOT EXISTS 'process';
ALTER TYPE payroll_audit_logs_action_enum ADD VALUE IF NOT EXISTS 'lock';
ALTER TYPE payroll_audit_logs_action_enum ADD VALUE IF NOT EXISTS 'disburse';

-- ─── 2. Payout status enum for items ─────────────────────────────────────────
DO $$
DECLARE
  v_schema text := current_schema();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'payroll_run_items_payout_status_enum'
                   AND n.nspname = v_schema) THEN
    CREATE TYPE payroll_run_items_payout_status_enum AS ENUM ('pending','paid');
  END IF;
END $$;

-- ─── 3. payroll_runs — disbursement columns ──────────────────────────────────
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS is_disbursed boolean NOT NULL DEFAULT false;
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS disbursed_at timestamp;
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS disbursed_by uuid;
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS disbursement_reference varchar(255);

-- ─── 4. payroll_run_items — payout columns ───────────────────────────────────
ALTER TABLE payroll_run_items
  ADD COLUMN IF NOT EXISTS payout_status payroll_run_items_payout_status_enum
    NOT NULL DEFAULT 'pending';
ALTER TABLE payroll_run_items
  ADD COLUMN IF NOT EXISTS paid_at timestamp;
