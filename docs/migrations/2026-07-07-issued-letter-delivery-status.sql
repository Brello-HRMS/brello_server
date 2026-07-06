-- =====================================================================
--  Issued Letters — recipient delivery/acknowledgement lifecycle
--
--  Adds:
--    - issued_letters      → delivery_status (ISSUED|VIEWED|ACKNOWLEDGED),
--                            viewed_at, acknowledged_at
--    - system_audit_logs   → new action enum values: VIEW, DOWNLOAD, ACKNOWLEDGE
--                            (added to the AuditAction enum but the prod enum
--                            type won't have them until this runs)
--
--  Dev auto-syncs from the entities; run this only where synchronize is disabled.
--
--  Usage:
--    1. Set the schema in the SET search_path line below to match your env.
--    2. Run:  psql "<conn-string>" -f docs/migrations/2026-07-07-issued-letter-delivery-status.sql
--
--  Safe to re-run.
-- =====================================================================

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

-- ─── 1. Audit action enum: add the new lifecycle values ──────────────────────
-- (ALTER TYPE ... ADD VALUE runs in autocommit; psql -f is fine.)
ALTER TYPE system_audit_logs_action_enum ADD VALUE IF NOT EXISTS 'VIEW';
ALTER TYPE system_audit_logs_action_enum ADD VALUE IF NOT EXISTS 'DOWNLOAD';
ALTER TYPE system_audit_logs_action_enum ADD VALUE IF NOT EXISTS 'ACKNOWLEDGE';

-- ─── 2. Delivery status enum for issued letters ──────────────────────────────
DO $$
DECLARE
  v_schema text := current_schema();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'issued_letters_delivery_status_enum'
                   AND n.nspname = v_schema) THEN
    CREATE TYPE issued_letters_delivery_status_enum AS ENUM ('ISSUED','VIEWED','ACKNOWLEDGED');
  END IF;
END $$;

-- ─── 3. issued_letters — delivery lifecycle columns ──────────────────────────
ALTER TABLE issued_letters
  ADD COLUMN IF NOT EXISTS delivery_status issued_letters_delivery_status_enum
    NOT NULL DEFAULT 'ISSUED';
ALTER TABLE issued_letters
  ADD COLUMN IF NOT EXISTS viewed_at timestamp;
ALTER TABLE issued_letters
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamp;
