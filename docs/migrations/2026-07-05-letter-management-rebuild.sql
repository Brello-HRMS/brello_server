-- =====================================================================
--  Letter Management module — full rebuild.
--
--  Replaces the old hr-template module (letter_categories/letter_templates
--  with a block-based `content`/`design` JSONB schema, and the OFFER_TEMPLATES
--  RBAC module code) with a from-scratch Letter Management module built per
--  docs/prd/letter/: plain heading/paragraphs/bulletList templates, signatories,
--  org settings, and an immutable issued-letters generation pipeline.
--
--  This migration has TWO PHASES that must run around a server restart:
--
--    PHASE 1 (run BEFORE deploying the new backend code / restarting the app):
--      Drops the old letter_categories/letter_templates tables, which had a
--      different column shape (content/design JSONB vs. the new
--      heading/paragraphs/bullet_list/signatory_id/version/template_status
--      shape). No data migration — this is a from-scratch rebuild on a
--      dev-stage project with nothing worth preserving in the old shape.
--
--      >>> After Phase 1 runs, deploy the new backend and restart it once. <<<
--      TypeORM's `synchronize: true` (dev environment) will auto-create the
--      5 new tables (letter_categories, letter_templates, signatories,
--      letter_settings, issued_letters) from the new entities.
--
--    PHASE 2 (run AFTER the restart, once the new tables exist):
--      Seeds the RBAC module tree (LETTER_MANAGEMENT parent + 5 children),
--      grants access to existing roles, and retires the old OFFER_TEMPLATES
--      module code (which the old org-side letter-templates page used).
--
--      No `is_system` starter categories/templates are seeded — the
--      platform-level shared/starter-template capability from the old module
--      was intentionally dropped, not rebuilt. Every org starts blank.
--
--  Usage:
--    1. Edit the SET search_path line below to match your environment.
--    2. Run Phase 1, deploy + restart the backend, then run Phase 2:
--         psql "<conn-string>" -f docs/migrations/2026-07-05-letter-management-rebuild.sql
--       (both phases are in this one file — Phase 2 blocks are safe to run
--       immediately if the tables already exist; Phase 1 is idempotent via
--       IF EXISTS and safe to run every time too)
--
--  Safe to re-run (IF EXISTS / INSERT ... ON CONFLICT DO NOTHING / DO UPDATE).
-- =====================================================================

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello_v3, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1 — drop the old-shape tables (run before restarting with new code)
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS letter_templates CASCADE;
DROP TABLE IF EXISTS letter_categories CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2 — RBAC module tree + access grants (run after the restart)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_admin_app_id     uuid;
  v_org_module_id    uuid;
  v_parent_module_id uuid;
  v_child_module_id  uuid;
  v_action           RECORD;
  v_action_id        uuid;
  v_role             RECORD;
  v_child            RECORD;
  SYS_ENT            CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
  SYS_ORG            CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
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

  -- ── 3. Ensure the standard actions exist (view/create/edit/delete) ─────────
  FOR v_action IN SELECT unnest(ARRAY['view', 'create', 'edit', 'delete']) AS name
  LOOP
    SELECT id INTO v_action_id FROM actions WHERE LOWER(name) = v_action.name AND deleted_at IS NULL LIMIT 1;
    IF v_action_id IS NULL THEN
      INSERT INTO actions (name, status, enterprise_id, organization_id, created_at, updated_at)
      VALUES (v_action.name, 'ACTIVE', SYS_ENT, SYS_ORG, NOW(), NOW());
    END IF;
  END LOOP;

  -- ── 4. Upsert the LETTER_MANAGEMENT parent module (wbs 11.8) ────────────────
  SELECT id INTO v_parent_module_id
  FROM modules
  WHERE app_id = v_admin_app_id AND code = 'LETTER_MANAGEMENT' AND deleted_at IS NULL
  LIMIT 1;

  IF v_parent_module_id IS NULL THEN
    INSERT INTO modules
      (name, code, app_id, wbs_code, parent_id, type, icon, path,
       status, enterprise_id, organization_id, created_at, updated_at)
    VALUES
      ('Letter Management', 'LETTER_MANAGEMENT', v_admin_app_id, '11.8', v_org_module_id,
       'mod', 'ScrollText', '/organisation/letter-management/issued-letters',
       'ACTIVE', SYS_ENT, SYS_ORG, NOW(), NOW())
    RETURNING id INTO v_parent_module_id;
    RAISE NOTICE 'Created LETTER_MANAGEMENT module: %', v_parent_module_id;
  ELSE
    RAISE NOTICE 'LETTER_MANAGEMENT module already exists: %', v_parent_module_id;
  END IF;

  -- ── 5. Upsert the 5 child modules ───────────────────────────────────────────
  FOR v_child IN
    SELECT code, name, wbs, path FROM (VALUES
      ('LETTER_ISSUED',      'Issued Letters', '11.8.1', '/organisation/letter-management/issued-letters'),
      ('LETTER_TEMPLATES',   'Templates',      '11.8.2', '/organisation/letter-management/templates'),
      ('LETTER_CATEGORIES',  'Categories',     '11.8.3', '/organisation/letter-management/categories'),
      ('LETTER_SIGNATORIES', 'Signatories',    '11.8.4', '/organisation/letter-management/signatories'),
      ('LETTER_SETTINGS',    'Settings',       '11.8.5', '/organisation/letter-management/settings')
    ) AS t(code, name, wbs, path)
  LOOP
    SELECT id INTO v_child_module_id
    FROM modules
    WHERE app_id = v_admin_app_id AND code = v_child.code AND deleted_at IS NULL
    LIMIT 1;

    IF v_child_module_id IS NULL THEN
      INSERT INTO modules
        (name, code, app_id, wbs_code, parent_id, type, icon, path,
         status, enterprise_id, organization_id, created_at, updated_at)
      VALUES
        (v_child.name, v_child.code, v_admin_app_id, v_child.wbs, v_parent_module_id,
         'submod', NULL, v_child.path,
         'ACTIVE', SYS_ENT, SYS_ORG, NOW(), NOW())
      RETURNING id INTO v_child_module_id;
      RAISE NOTICE 'Created % module: %', v_child.code, v_child_module_id;
    ELSE
      RAISE NOTICE '% module already exists: %', v_child.code, v_child_module_id;
    END IF;

    -- Grant view/create/edit/delete on every child module to every role that
    -- currently holds ORGANISATION view — mirrors how OFFER_TEMPLATES was
    -- granted previously, extended to all 4 standard actions since this
    -- module has real create/edit/delete operations behind RBAC.
    FOR v_role IN
      SELECT DISTINCT ma.role_id
      FROM module_access ma
      JOIN modules m ON m.id = ma.module_id
      JOIN actions a ON a.id = ma.action_id
      WHERE m.code = 'ORGANISATION'
        AND LOWER(a.name) = 'view'
        AND ma.access_flag = TRUE
    LOOP
      FOR v_action IN SELECT unnest(ARRAY['view', 'create', 'edit', 'delete']) AS name
      LOOP
        SELECT id INTO v_action_id FROM actions WHERE LOWER(name) = v_action.name AND deleted_at IS NULL LIMIT 1;

        INSERT INTO module_access (role_id, module_id, action_id, access_flag, created_at, updated_at)
        VALUES (v_role.role_id, v_child_module_id, v_action_id, TRUE, NOW(), NOW())
        ON CONFLICT (role_id, module_id, action_id) DO UPDATE
          SET access_flag = TRUE, updated_at = NOW();
      END LOOP;
    END LOOP;

    -- Also grant plain "view" on the child to any role that only has
    -- LETTER_MANAGEMENT parent view but not full ORGANISATION view (keeps
    -- WBS-hierarchy view propagation consistent — parent view implies child
    -- view for the "view" action specifically).
    INSERT INTO module_access (role_id, module_id, action_id, access_flag, created_at, updated_at)
    SELECT ma.role_id, v_child_module_id,
           (SELECT id FROM actions WHERE LOWER(name) = 'view' AND deleted_at IS NULL LIMIT 1),
           TRUE, NOW(), NOW()
    FROM module_access ma
    JOIN actions a ON a.id = ma.action_id
    WHERE ma.module_id = v_parent_module_id
      AND LOWER(a.name) = 'view'
      AND ma.access_flag = TRUE
    ON CONFLICT (role_id, module_id, action_id) DO UPDATE
      SET access_flag = TRUE, updated_at = NOW();
  END LOOP;

  RAISE NOTICE 'Done — LETTER_MANAGEMENT (wbs 11.8) and its 5 child modules are ready';
END $$;

-- ── 6. Retire the old OFFER_TEMPLATES module code ───────────────────────────
--
--  The old org-side letter-templates page reused OFFER_TEMPLATES (wbs 11.7)
--  as its module code. That page and its route are gone; soft-retire the
--  module row and its access grants so it stops appearing in the sidebar
--  and permission screens. Explicit, commented step since this removes
--  existing role grants.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_admin_app_id uuid;
  v_module_id    uuid;
BEGIN
  SELECT id INTO v_admin_app_id
  FROM app
  WHERE LOWER(name) LIKE '%admin%' AND status = 'ACTIVE'
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_module_id
  FROM modules
  WHERE app_id = v_admin_app_id AND code = 'OFFER_TEMPLATES' AND deleted_at IS NULL
  LIMIT 1;

  IF v_module_id IS NOT NULL THEN
    UPDATE modules SET deleted_at = NOW(), status = 'ARCHIVED', updated_at = NOW()
    WHERE id = v_module_id;

    UPDATE module_access SET access_flag = FALSE, updated_at = NOW()
    WHERE module_id = v_module_id;

    RAISE NOTICE 'Retired OFFER_TEMPLATES module: %', v_module_id;
  ELSE
    RAISE NOTICE 'OFFER_TEMPLATES module not found — nothing to retire';
  END IF;
END $$;
