-- =====================================================================
--  Letter Templates module — adds OFFER_TEMPLATES under Organisation
--  and seeds the 9 standard HR system letter categories.
--
--  Adds the "Letter Templates" sub-module (OFFER_TEMPLATES, wbs 11.7)
--  as a child of the ORGANISATION module so org admins can access
--  /organisation/letter-templates in the sidebar and via RequireAccess.
--
--  System letter categories seeded (all under document_type = 'hr_letter'):
--    1. Offer Letter
--    2. Confirmation Letter
--    3. Transfer Letter
--    4. Probation Extension Letter
--    5. Promotion Letter
--    6. Salary Increment Letter
--    7. Experience Letter
--    8. Relieving Letter
--    9. Proof of Employment
--
--  Usage:
--    1. Set the schema in the SET search_path line below to match your env.
--    2. Run:  psql "<conn-string>" -f docs/migrations/2026-06-19-letter-templates-module.sql
--
--  Safe to re-run (uses INSERT ... ON CONFLICT DO NOTHING / DO UPDATE).
-- =====================================================================

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello_dev, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

DO $$
DECLARE
  v_admin_app_id  uuid;
  v_org_module_id uuid;
  v_module_id     uuid;
  v_view_action   uuid;
  v_role          RECORD;
  v_cat           RECORD;
  SYS_ENT         CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
  SYS_ORG         CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- ── 1. Find the Admin app ───────────────────────────────────────────────────
  SELECT id INTO v_admin_app_id
  FROM app
  WHERE LOWER(name) LIKE '%admin%' AND status = 'ACTIVE'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_admin_app_id IS NULL THEN
    RAISE EXCEPTION 'Admin app not found';
  END IF;

  -- ── 2. Find the ORGANISATION parent module ──────────────────────────────────
  SELECT id INTO v_org_module_id
  FROM modules
  WHERE app_id = v_admin_app_id AND code = 'ORGANISATION' AND deleted_at IS NULL
  LIMIT 1;

  IF v_org_module_id IS NULL THEN
    RAISE EXCEPTION 'ORGANISATION module not found in admin app';
  END IF;

  -- ── 3. Upsert the OFFER_TEMPLATES child module (wbs 11.7) ───────────────────
  SELECT id INTO v_module_id
  FROM modules
  WHERE app_id = v_admin_app_id AND code = 'OFFER_TEMPLATES' AND deleted_at IS NULL
  LIMIT 1;

  IF v_module_id IS NULL THEN
    INSERT INTO modules
      (name, code, app_id, wbs_code, parent_id, type, icon, path,
       status, enterprise_id, organization_id, created_at, updated_at)
    VALUES
      ('Letter Templates', 'OFFER_TEMPLATES', v_admin_app_id, '11.7', v_org_module_id,
       'mod', 'LayoutTemplate', '/organisation/letter-templates',
       'ACTIVE', SYS_ENT, SYS_ORG, NOW(), NOW())
    RETURNING id INTO v_module_id;
    RAISE NOTICE 'Created OFFER_TEMPLATES module: %', v_module_id;
  ELSE
    RAISE NOTICE 'OFFER_TEMPLATES module already exists: %', v_module_id;
  END IF;

  -- ── 4. Ensure the "view" action exists ─────────────────────────────────────
  SELECT id INTO v_view_action
  FROM actions
  WHERE LOWER(name) = 'view' AND deleted_at IS NULL
  LIMIT 1;

  IF v_view_action IS NULL THEN
    INSERT INTO actions (name, status, enterprise_id, organization_id, created_at, updated_at)
    VALUES ('view', 'ACTIVE', SYS_ENT, SYS_ORG, NOW(), NOW())
    RETURNING id INTO v_view_action;
  END IF;

  -- ── 5. Grant view access to all roles that have ORGANISATION view ───────────
  FOR v_role IN
    SELECT DISTINCT ma.role_id
    FROM module_access ma
    JOIN modules m ON m.id = ma.module_id
    JOIN actions a ON a.id = ma.action_id
    WHERE m.code = 'ORGANISATION'
      AND LOWER(a.name) = 'view'
      AND ma.access_flag = TRUE
  LOOP
    INSERT INTO module_access (role_id, module_id, action_id, access_flag, created_at, updated_at)
    VALUES (v_role.role_id, v_module_id, v_view_action, TRUE, NOW(), NOW())
    ON CONFLICT (role_id, module_id, action_id) DO UPDATE
      SET access_flag = TRUE, updated_at = NOW();
  END LOOP;

  RAISE NOTICE 'Done — OFFER_TEMPLATES (wbs 11.7) ready under ORGANISATION';
END $$;

-- ── 6. Seed system letter categories ─────────────────────────────────────────
--
--  These are read-only to orgs (is_system = true, organization_id = null).
--  Orgs can create templates inside them but cannot edit/delete the categories.
--  All 9 standard HR letter types under document_type = 'hr_letter'.
--
--  Keyed on (name, document_type, is_system=true, is_deleted=false) to be
--  safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_cat RECORD;
BEGIN
  FOR v_cat IN
    SELECT name, description, sort_order
    FROM (VALUES
      ('Offer Letter',               'Issued to candidates who have been selected for a position.',       1),
      ('Confirmation Letter',        'Issued after successful completion of the probation period.',       2),
      ('Transfer Letter',            'Notifies an employee of a department or location transfer.',        3),
      ('Probation Extension Letter', 'Extends the probation period for an employee.',                     4),
      ('Promotion Letter',           'Formally communicates an employee''s promotion and new role.',      5),
      ('Salary Increment Letter',    'Notifies an employee of a salary revision.',                       6),
      ('Experience Letter',          'Certifies the duration and nature of an employee''s service.',     7),
      ('Relieving Letter',           'Confirms acceptance of an employee''s resignation.',               8),
      ('Proof of Employment',        'Certifies that an individual is or was employed by the company.',  9)
    ) AS t(name, description, sort_order)
  LOOP
    INSERT INTO letter_categories
      (name, description, document_type, is_system, is_deleted, status, enterprise_id, organization_id, created_at, updated_at)
    VALUES
      (v_cat.name, v_cat.description, 'hr_letter', TRUE, FALSE, 'ACTIVE',
       '00000000-0000-0000-0000-000000000000',
       NULL,
       NOW(), NOW())
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Seeded 9 system HR letter categories';
END $$;
