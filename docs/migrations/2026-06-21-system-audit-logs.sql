-- Migration: System Audit Logs
-- Creates the centralized, immutable audit log table for all Brello modules.
-- Run once per environment. Dev uses TypeORM synchronize:true so this is for staging/prod.
--
--  Usage:
--    1. Edit the SET search_path line below to match your environment.
--    2. Run:  psql "<conn-string>" -f docs/migrations/2026-06-21-system-audit-logs.sql
--
--  Safe to re-run (CREATE TABLE IF NOT EXISTS, DO $$ BEGIN … EXCEPTION … END $$).

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello_v3, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE audit_log_module AS ENUM (
    'AUTH', 'SESSION',
    'EMPLOYEE', 'ORGANIZATION', 'DEPARTMENT', 'DESIGNATION',
    'ROLE', 'PERMISSION', 'USER_ROLE',
    'LEAVE_CONFIG', 'LEAVE_REQUEST', 'LEAVE_BALANCE',
    'ATTENDANCE', 'SHIFT',
    'PAYROLL', 'SALARY',
    'REIMBURSEMENT',
    'ANNOUNCEMENT', 'COMPANY_POLICY', 'HOLIDAY', 'HR_TEMPLATE', 'DOCUMENT',
    'PROJECT', 'CLIENT',
    'BILLING', 'SUBSCRIPTION',
    'PLATFORM_ENTERPRISE', 'PLATFORM_PLAN', 'PLATFORM_SETUP'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'CREATE', 'UPDATE', 'DELETE', 'RESTORE',
    'ACTIVATE', 'DEACTIVATE', 'PUBLISH', 'ARCHIVE',
    'SUBMIT', 'APPROVE', 'REJECT', 'CANCEL', 'WITHDRAW',
    'PROCESS', 'LOCK', 'DISBURSE', 'REGENERATE',
    'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
    'GRANT', 'REVOKE', 'ASSIGN', 'UNASSIGN',
    'EXPORT', 'IMPORT', 'ADJUST', 'ACCRUE', 'PAY'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_audit_logs (
  -- Identity
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenancy
  enterprise_id         UUID          NOT NULL,
  organization_id       UUID,

  -- Actor snapshot (name/email captured at action time — survives user deletion/rename)
  actor_id              UUID          NOT NULL,
  actor_name            VARCHAR(300)  NOT NULL,
  actor_email           VARCHAR(255)  NOT NULL,
  actor_role_label      VARCHAR(150),
  is_platform_admin     BOOLEAN       NOT NULL DEFAULT false,

  -- What changed
  module                audit_log_module  NOT NULL,
  sub_module            VARCHAR(100),
  action                audit_action      NOT NULL,
  entity_type           VARCHAR(100)  NOT NULL,
  entity_id             UUID          NOT NULL,
  entity_display_name   VARCHAR(500),
  description           TEXT,

  -- Change data (sensitive fields stripped before write)
  old_value             JSONB,
  new_value             JSONB,
  changed_fields        TEXT[],

  -- Request context
  ip_address            VARCHAR(45),
  user_agent            TEXT,
  device                VARCHAR(150),
  request_id            VARCHAR(100),

  -- Append-only: no updated_at, no deleted_at
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sal_org_time
  ON system_audit_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sal_org_module_time
  ON system_audit_logs (organization_id, module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sal_org_actor_time
  ON system_audit_logs (organization_id, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sal_entity
  ON system_audit_logs (organization_id, entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sal_org_action
  ON system_audit_logs (organization_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sal_enterprise_time
  ON system_audit_logs (enterprise_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sal_search
  ON system_audit_logs USING GIN (
    to_tsvector('english',
      coalesce(entity_display_name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(actor_name, '')
    )
  );

CREATE INDEX IF NOT EXISTS idx_sal_changed_fields
  ON system_audit_logs USING GIN (changed_fields);
