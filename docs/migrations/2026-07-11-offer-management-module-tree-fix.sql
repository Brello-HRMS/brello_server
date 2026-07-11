-- =====================================================================
--  Offer Management — fix the module tree numbering.
--
--  The original seed (src/seeds/seed-offer-management.ts) placed the
--  "Offer Management" module at wbs 14 with children 14.1-14.3. That
--  left a gap: the last real top-level module is Audit Log at wbs 11
--  (wbs 12 and 13 are unused — 12 is only occupied by an already-
--  archived "Letter Management" ghost row, 13 is empty). Offer
--  Management should be the next module in sequence at wbs 12, not an
--  island at 14.
--
--  This migration:
--    1. Renumbers OFFER_MANAGEMENT (wbs 14 → 12) and its three children
--       OFFER_CANDIDATES, OFFER_ANALYTICS, OFFER_SETTINGS (14.1-14.3 →
--       12.1-12.3). No reparenting needed — they were already correctly
--       nested under OFFER_MANAGEMENT, just numbered wrong.
--
--  Note: this migration does NOT touch the separately-named, already-
--  archived OFFER_TEMPLATES module (the old org-side letter-templates
--  page, retired in 2026-07-05-letter-management-module-tree-rearrange.sql)
--  — that is unrelated to this feature despite the similar name.
--
--  Usage:
--    1. Edit the SET search_path line below to match your environment.
--    2. Run:  psql "<conn-string>" -f docs/migrations/2026-07-11-offer-management-module-tree-fix.sql
--
--  Safe to re-run (idempotent — updates by code, not position).
-- =====================================================================

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello_v3, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

BEGIN;

UPDATE modules SET wbs_code = '12',   updated_at = NOW() WHERE code = 'OFFER_MANAGEMENT' AND deleted_at IS NULL;
UPDATE modules SET wbs_code = '12.1', updated_at = NOW() WHERE code = 'OFFER_CANDIDATES'  AND deleted_at IS NULL;
UPDATE modules SET wbs_code = '12.2', updated_at = NOW() WHERE code = 'OFFER_ANALYTICS'   AND deleted_at IS NULL;
UPDATE modules SET wbs_code = '12.3', updated_at = NOW() WHERE code = 'OFFER_SETTINGS'    AND deleted_at IS NULL;

COMMIT;
