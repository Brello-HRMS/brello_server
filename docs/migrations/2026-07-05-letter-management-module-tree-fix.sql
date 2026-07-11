-- =====================================================================
--  Letter Management — fix the pre-existing "HR Letters" module tree.
--
--  Before the from-scratch Letter Management rebuild, this environment
--  already had a stale, unfinished module tree seeded for an earlier,
--  abandoned "HR Letters" concept (ADMIN app, wbs 9):
--    - Parent: "HR Letters" — code LETTER_MANGEMENT (typo'd)
--    - Child:  "Recruitment" — code LETTER_NEW_HIRE, path /offer-letter/new-hire
--    - Child:  "Employment"  — code HR_EMPLOYMENT_LETTERS, path /hr-letters/employment
--  None of these paths exist in the frontend; they predate this rebuild.
--
--  This migration, run AFTER 2026-07-05-letter-management-rebuild.sql:
--    1. Fixes the parent's code typo (LETTER_MANGEMENT -> LETTER_MANAGEMENT).
--    2. Renames the 2 existing children IN PLACE (same row/id) to the real
--       codes/names/paths the new backend & frontend actually use
--       (LETTER_ISSUED / LETTER_TEMPLATES) — renaming in place means any
--       existing module_access grants on these rows (e.g. to "Organization
--       Owner" or other roles) carry over automatically, no re-granting
--       needed for these two.
--    3. Adds the 3 remaining children (Categories/Signatories/Settings)
--       that never existed before.
--    4. Grants full access on the 3 NEW modules to the "Organization Owner"
--       template role (organization_id IS NULL) — every org's cloned
--       Organization Owner role should be granted the same via whatever
--       role-cloning process runs for existing orgs, or re-run the grant
--       block below scoped to a specific org's role id.
--    5. Enables all 6 letter modules (parent + 5 children) in every ACTIVE
--       plan (skips DELETED plans).
--    6. Adds a single EMPLOYEE-app module ("My Letters" -> /letters/me),
--       since the EMPLOYEE app had zero modules registered in this
--       environment. Grants "view" to every EMPLOYEE-app role named
--       "Employee".
--
--  NOTE: this environment's `module_access`, `plan_module`, and
--  `plan_module_action` tables have NO unique constraint on their natural
--  keys, so this migration uses explicit EXISTS-then-INSERT/UPDATE guards
--  throughout instead of ON CONFLICT (which would error with no matching
--  constraint). Safe to re-run.
--
--  Usage:
--    1. Edit the SET search_path line below to match your environment.
--    2. Run:  psql "<conn-string>" -f docs/migrations/2026-07-05-letter-management-module-tree-fix.sql
-- =====================================================================

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello_v3, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

BEGIN;

-- ── 1-2. Fix parent + rename the 2 existing children in place ──────────────
UPDATE modules SET code = 'LETTER_MANAGEMENT', updated_at = NOW()
WHERE code = 'LETTER_MANGEMENT';

UPDATE modules
SET name = 'Issued Letters', code = 'LETTER_ISSUED',
    path = '/organisation/letter-management/issued-letters', updated_at = NOW()
WHERE code = 'LETTER_NEW_HIRE';

UPDATE modules
SET name = 'Templates', code = 'LETTER_TEMPLATES',
    path = '/organisation/letter-management/templates', updated_at = NOW()
WHERE code = 'HR_EMPLOYMENT_LETTERS';

-- ── 3. Add the 3 remaining children ─────────────────────────────────────────
DO $$
DECLARE
  v_admin_app_id uuid;
  v_parent_id uuid;
  v_existing uuid;
BEGIN
  SELECT id INTO v_admin_app_id FROM app WHERE LOWER(name) = 'admin' AND status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO v_parent_id FROM modules WHERE code = 'LETTER_MANAGEMENT' AND app_id = v_admin_app_id LIMIT 1;

  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'LETTER_MANAGEMENT parent module not found — run 2026-07-05-letter-management-rebuild.sql first, or verify this environment already had the HR Letters tree seeded.';
  END IF;

  SELECT id INTO v_existing FROM modules WHERE code = 'LETTER_CATEGORIES' LIMIT 1;
  IF v_existing IS NULL THEN
    INSERT INTO modules (name, code, app_id, wbs_code, parent_id, type, icon, path, status, enterprise_id, organization_id, created_at, updated_at)
    VALUES ('Categories', 'LETTER_CATEGORIES', v_admin_app_id, '9.3', v_parent_id, 'submod', NULL, '/organisation/letter-management/categories', 'ACTIVE', '00000000-0000-0000-0000-000000000000', NULL, NOW(), NOW());
  END IF;

  SELECT id INTO v_existing FROM modules WHERE code = 'LETTER_SIGNATORIES' LIMIT 1;
  IF v_existing IS NULL THEN
    INSERT INTO modules (name, code, app_id, wbs_code, parent_id, type, icon, path, status, enterprise_id, organization_id, created_at, updated_at)
    VALUES ('Signatories', 'LETTER_SIGNATORIES', v_admin_app_id, '9.4', v_parent_id, 'submod', NULL, '/organisation/letter-management/signatories', 'ACTIVE', '00000000-0000-0000-0000-000000000000', NULL, NOW(), NOW());
  END IF;

  SELECT id INTO v_existing FROM modules WHERE code = 'LETTER_SETTINGS' LIMIT 1;
  IF v_existing IS NULL THEN
    INSERT INTO modules (name, code, app_id, wbs_code, parent_id, type, icon, path, status, enterprise_id, organization_id, created_at, updated_at)
    VALUES ('Settings', 'LETTER_SETTINGS', v_admin_app_id, '9.5', v_parent_id, 'submod', NULL, '/organisation/letter-management/settings', 'ACTIVE', '00000000-0000-0000-0000-000000000000', NULL, NOW(), NOW());
  END IF;
END $$;

-- ── 4. Grant the template "Organization Owner" role full access on the 3 new modules ──
DO $$
DECLARE
  v_role_id uuid;
  v_module_id uuid;
  v_action_id uuid;
BEGIN
  FOR v_role_id IN SELECT id FROM role WHERE organization_id IS NULL AND LOWER(name) LIKE '%organi%owner%'
  LOOP
    FOR v_module_id IN SELECT id FROM modules WHERE code IN ('LETTER_CATEGORIES', 'LETTER_SIGNATORIES', 'LETTER_SETTINGS')
    LOOP
      FOR v_action_id IN SELECT id FROM actions WHERE deleted_at IS NULL
      LOOP
        IF EXISTS (SELECT 1 FROM module_access WHERE role_id = v_role_id AND module_id = v_module_id AND action_id = v_action_id) THEN
          UPDATE module_access SET access_flag = TRUE, updated_at = NOW()
          WHERE role_id = v_role_id AND module_id = v_module_id AND action_id = v_action_id;
        ELSE
          INSERT INTO module_access (role_id, module_id, action_id, access_flag, created_at, updated_at)
          VALUES (v_role_id, v_module_id, v_action_id, TRUE, NOW(), NOW());
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ── 5. Enable all 6 letter modules in every ACTIVE plan ─────────────────────
DO $$
DECLARE
  v_plan_id uuid;
  v_module_id uuid;
  v_action_id uuid;
BEGIN
  FOR v_plan_id IN SELECT id FROM plan WHERE status = 'ACTIVE'
  LOOP
    FOR v_module_id IN
      SELECT id FROM modules WHERE code IN ('LETTER_MANAGEMENT','LETTER_ISSUED','LETTER_TEMPLATES','LETTER_CATEGORIES','LETTER_SIGNATORIES','LETTER_SETTINGS')
    LOOP
      IF EXISTS (SELECT 1 FROM plan_module WHERE plan_id = v_plan_id AND module_id = v_module_id) THEN
        UPDATE plan_module SET enabled = TRUE, updated_at = NOW() WHERE plan_id = v_plan_id AND module_id = v_module_id;
      ELSE
        INSERT INTO plan_module (plan_id, module_id, enabled, status, enterprise_id, organization_id, created_at, updated_at)
        VALUES (v_plan_id, v_module_id, TRUE, 'ACTIVE', '00000000-0000-0000-0000-000000000000', NULL, NOW(), NOW());
      END IF;

      FOR v_action_id IN SELECT id FROM actions WHERE deleted_at IS NULL
      LOOP
        IF EXISTS (SELECT 1 FROM plan_module_action WHERE plan_id = v_plan_id AND module_id = v_module_id AND action_id = v_action_id) THEN
          UPDATE plan_module_action SET enabled = TRUE, updated_at = NOW()
          WHERE plan_id = v_plan_id AND module_id = v_module_id AND action_id = v_action_id;
        ELSE
          INSERT INTO plan_module_action (plan_id, module_id, action_id, enabled, status, enterprise_id, organization_id, created_at, updated_at)
          VALUES (v_plan_id, v_module_id, v_action_id, TRUE, 'ACTIVE', '00000000-0000-0000-0000-000000000000', NULL, NOW(), NOW());
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ── 6. EMPLOYEE app — add "My Letters" + grant to every "Employee" role ─────
DO $$
DECLARE
  v_employee_app_id uuid;
  v_module_id uuid;
  v_view_action uuid;
  v_role_id uuid;
  v_plan_id uuid;
BEGIN
  SELECT id INTO v_employee_app_id FROM app WHERE LOWER(name) = 'employee' AND status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO v_module_id FROM modules WHERE code = 'EMP_LETTERS' AND app_id = v_employee_app_id LIMIT 1;
  IF v_module_id IS NULL THEN
    INSERT INTO modules (name, code, app_id, wbs_code, parent_id, type, icon, path, status, enterprise_id, organization_id, created_at, updated_at)
    VALUES ('My Letters', 'EMP_LETTERS', v_employee_app_id, '1', NULL, 'mod', 'ScrollText', '/letters/me', 'ACTIVE', '00000000-0000-0000-0000-000000000000', NULL, NOW(), NOW())
    RETURNING id INTO v_module_id;
  END IF;

  SELECT id INTO v_view_action FROM actions WHERE LOWER(name) = 'view' AND deleted_at IS NULL LIMIT 1;

  FOR v_role_id IN SELECT id FROM role WHERE app_id = v_employee_app_id AND LOWER(name) = 'employee'
  LOOP
    IF EXISTS (SELECT 1 FROM module_access WHERE role_id = v_role_id AND module_id = v_module_id AND action_id = v_view_action) THEN
      UPDATE module_access SET access_flag = TRUE, updated_at = NOW()
      WHERE role_id = v_role_id AND module_id = v_module_id AND action_id = v_view_action;
    ELSE
      INSERT INTO module_access (role_id, module_id, action_id, access_flag, created_at, updated_at)
      VALUES (v_role_id, v_module_id, v_view_action, TRUE, NOW(), NOW());
    END IF;
  END LOOP;

  FOR v_plan_id IN SELECT id FROM plan WHERE status = 'ACTIVE'
  LOOP
    IF EXISTS (SELECT 1 FROM plan_module WHERE plan_id = v_plan_id AND module_id = v_module_id) THEN
      UPDATE plan_module SET enabled = TRUE, updated_at = NOW() WHERE plan_id = v_plan_id AND module_id = v_module_id;
    ELSE
      INSERT INTO plan_module (plan_id, module_id, enabled, status, enterprise_id, organization_id, created_at, updated_at)
      VALUES (v_plan_id, v_module_id, TRUE, 'ACTIVE', '00000000-0000-0000-0000-000000000000', NULL, NOW(), NOW());
    END IF;
    IF EXISTS (SELECT 1 FROM plan_module_action WHERE plan_id = v_plan_id AND module_id = v_module_id AND action_id = v_view_action) THEN
      UPDATE plan_module_action SET enabled = TRUE, updated_at = NOW()
      WHERE plan_id = v_plan_id AND module_id = v_module_id AND action_id = v_view_action;
    ELSE
      INSERT INTO plan_module_action (plan_id, module_id, action_id, enabled, status, enterprise_id, organization_id, created_at, updated_at)
      VALUES (v_plan_id, v_module_id, v_view_action, TRUE, 'ACTIVE', '00000000-0000-0000-0000-000000000000', NULL, NOW(), NOW());
    END IF;
  END LOOP;
END $$;

COMMIT;
