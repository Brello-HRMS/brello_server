-- =====================================================================
--  Letter Management — rearrange the module tree under Organization.
--
--  Follow-up to 2026-07-05-letter-management-module-tree-fix.sql. That
--  migration fixed the pre-existing "HR Letters" tree (standalone
--  top-level module, wbs 9) to point at the real Letter Management pages.
--  However, every one of those pages lives under the `/organisation/*`
--  URL prefix — the same convention used by Departments, Designations,
--  Policies, Payroll, Leave, and Profile, all of which are children of
--  the "Organization" module (wbs 3), not standalone top-level items.
--
--  This migration:
--    1. Reparents the 5 letter modules (Issued Letters, Templates,
--       Categories, Signatories, Settings) from the standalone "HR
--       Letters" module to be children of "Organization" (wbs 3.8-3.12),
--       matching their actual route nesting.
--    2. Archives the now-empty standalone "HR Letters" parent
--       (LETTER_MANAGEMENT) and disables its access/plan grants, since
--       it no longer has any children and is redundant now that
--       Organization is the grouping context.
--    3. Archives the pre-existing "Offer Template" module
--       (OFFER_TEMPLATES, wbs 3.6) and disables its access/plan grants —
--       this was the old org-side letter-templates page's module code;
--       its route (/organisation/letter-templates) no longer exists
--       after the letter management rebuild removed it. This was meant
--       to happen in 2026-07-05-letter-management-rebuild.sql's step 3
--       but that migration was never fully run against this environment.
--
--  Usage:
--    1. Edit the SET search_path line below to match your environment.
--    2. Confirm the hardcoded module_id lookups below (by `code`) match
--       your environment before running — this migration looks modules
--       up by code (portable), not hardcoded UUIDs.
--    3. Run:  psql "<conn-string>" -f docs/migrations/2026-07-05-letter-management-module-tree-rearrange.sql
--
--  NOT safe to blindly re-run against a DIFFERENT environment without
--  reviewing first — it assumes an "Organization" module with code
--  ORGANISATION already exists (true for every environment that ran the
--  base module seed), and that LETTER_MANAGEMENT/OFFER_TEMPLATES exist
--  with the codes/relationships described above.
-- =====================================================================

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello_v3, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

BEGIN;

DO $$
DECLARE
  v_org_module_id uuid;
BEGIN
  SELECT id INTO v_org_module_id FROM modules WHERE code = 'ORGANISATION' LIMIT 1;
  IF v_org_module_id IS NULL THEN
    RAISE EXCEPTION 'ORGANISATION module not found — cannot reparent.';
  END IF;

  -- ── 1. Reparent the 5 letter modules under Organization ──────────────────
  UPDATE modules SET parent_id = v_org_module_id, wbs_code = '3.8', updated_at = NOW() WHERE code = 'LETTER_ISSUED';
  UPDATE modules SET parent_id = v_org_module_id, wbs_code = '3.9', updated_at = NOW() WHERE code = 'LETTER_TEMPLATES';
  UPDATE modules SET parent_id = v_org_module_id, wbs_code = '3.10', updated_at = NOW() WHERE code = 'LETTER_CATEGORIES';
  UPDATE modules SET parent_id = v_org_module_id, wbs_code = '3.11', updated_at = NOW() WHERE code = 'LETTER_SIGNATORIES';
  UPDATE modules SET parent_id = v_org_module_id, wbs_code = '3.12', updated_at = NOW() WHERE code = 'LETTER_SETTINGS';
END $$;

-- ── 2. Retire the now-empty standalone "HR Letters" parent (LETTER_MANAGEMENT) ──
UPDATE modules SET status = 'ARCHIVED', deleted_at = NOW(), updated_at = NOW() WHERE code = 'LETTER_MANAGEMENT';
UPDATE module_access SET access_flag = FALSE, updated_at = NOW()
WHERE module_id = (SELECT id FROM modules WHERE code = 'LETTER_MANAGEMENT');
UPDATE plan_module SET enabled = FALSE, updated_at = NOW()
WHERE module_id = (SELECT id FROM modules WHERE code = 'LETTER_MANAGEMENT');
UPDATE plan_module_action SET enabled = FALSE, updated_at = NOW()
WHERE module_id = (SELECT id FROM modules WHERE code = 'LETTER_MANAGEMENT');

-- ── 3. Retire the dead "Offer Template" (OFFER_TEMPLATES) entry ─────────────
UPDATE modules SET status = 'ARCHIVED', deleted_at = NOW(), updated_at = NOW() WHERE code = 'OFFER_TEMPLATES';
UPDATE module_access SET access_flag = FALSE, updated_at = NOW()
WHERE module_id = (SELECT id FROM modules WHERE code = 'OFFER_TEMPLATES');
UPDATE plan_module SET enabled = FALSE, updated_at = NOW()
WHERE module_id = (SELECT id FROM modules WHERE code = 'OFFER_TEMPLATES');
UPDATE plan_module_action SET enabled = FALSE, updated_at = NOW()
WHERE module_id = (SELECT id FROM modules WHERE code = 'OFFER_TEMPLATES');

COMMIT;
