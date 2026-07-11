-- Migration: Add OFFER_MANAGEMENT (and other already-shipped-in-code) values
-- to the audit_log_module enum type.
--
-- The audit_log_module Postgres enum (created in
-- docs/migrations/2026-06-21-system-audit-logs.sql) predates the
-- LETTER_MANAGEMENT/OFFER_LETTER/LETTER_SIGNATORY and OFFER_MANAGEMENT
-- values added to src/modules/audit/enums/audit-log-module.enum.ts.
-- Dev relies on TypeORM synchronize:true so this only matters for
-- staging/prod, where writing an audit log row for any of these modules
-- currently fails with "invalid input value for enum audit_log_module"
-- and is silently swallowed by AuditInterceptor.
--
-- Usage:
--   1. Edit the SET search_path line below to match your environment.
--   2. Run:  psql "<conn-string>" -f docs/migrations/2026-07-10-audit-log-module-offer-management.sql
--
-- Safe to re-run (ADD VALUE IF NOT EXISTS).

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello_v3, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

ALTER TYPE audit_log_module ADD VALUE IF NOT EXISTS 'LETTER_MANAGEMENT';
ALTER TYPE audit_log_module ADD VALUE IF NOT EXISTS 'OFFER_LETTER';
ALTER TYPE audit_log_module ADD VALUE IF NOT EXISTS 'LETTER_SIGNATORY';
ALTER TYPE audit_log_module ADD VALUE IF NOT EXISTS 'OFFER_MANAGEMENT';
