-- =====================================================================
--  Letter Management — Consolidate modules and remove redundant routes
--
--  This migration:
--    1. Renames LETTER_TEMPLATES to 'Letter Setup' and updates its path
--       to '/organisation/letter-management/setup'
--    2. Deletes LETTER_CATEGORIES, LETTER_SIGNATORIES, LETTER_SETTINGS
--       (cascades to module_access and plan_module due to foreign keys,
--       or we will delete them explicitly to be safe).
--
--  Usage:
--    psql "<conn-string>" -f docs/migrations/2026-07-07-letter-management-consolidation.sql
-- =====================================================================

SET search_path TO brello_v3, public;

BEGIN;

-- 1. Rename LETTER_TEMPLATES and update path
UPDATE modules
SET name = 'Letter Setup',
    path = '/organisation/letter-management/setup',
    updated_at = NOW()
WHERE code = 'LETTER_TEMPLATES';

-- 2. Delete dependent records first to be safe, then delete the modules
-- Explicitly delete module_access entries
DELETE FROM module_access 
WHERE module_id IN (
  SELECT id FROM modules WHERE code IN ('LETTER_CATEGORIES', 'LETTER_SIGNATORIES', 'LETTER_SETTINGS')
);

-- Explicitly delete plan_module_action entries
DELETE FROM plan_module_action
WHERE module_id IN (
  SELECT id FROM modules WHERE code IN ('LETTER_CATEGORIES', 'LETTER_SIGNATORIES', 'LETTER_SETTINGS')
);

-- Explicitly delete plan_module entries
DELETE FROM plan_module
WHERE module_id IN (
  SELECT id FROM modules WHERE code IN ('LETTER_CATEGORIES', 'LETTER_SIGNATORIES', 'LETTER_SETTINGS')
);

-- Finally, delete the modules themselves
DELETE FROM modules
WHERE code IN ('LETTER_CATEGORIES', 'LETTER_SIGNATORIES', 'LETTER_SETTINGS');

COMMIT;
