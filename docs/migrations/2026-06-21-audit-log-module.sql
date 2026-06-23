-- =====================================================================
--  Audit Log module (AUDIT_LOG, wbs 14)
--
--  Adds a top-level "Audit Logs" entry to the admin app so org admins
--  can access /admin/audit-logs in the sidebar and via RequireAccess.
--
--  Access strategy: granted to every role that already has ACCESS view
--  (roles/permissions management) — i.e., privileged org admins only.
--
--  Usage:
--    1. Edit the SET search_path line below to match your environment.
--    2. Run:  psql "<conn-string>" -f docs/migrations/2026-06-21-audit-log-module.sql
--
--  Safe to re-run (uses INSERT ... ON CONFLICT DO NOTHING / DO UPDATE).
-- =====================================================================

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello_v3, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

DO $$
DECLARE
  v_admin_app_id  uuid;
  v_module_id     uuid;
  v_view_action   uuid;
  v_role          RECORD;
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

  -- ── 2. Upsert the AUDIT_LOG module (wbs 14, top-level) ──────────────────────
  SELECT id INTO v_module_id
  FROM modules
  WHERE app_id = v_admin_app_id AND code = 'AUDIT_LOG' AND deleted_at IS NULL
  LIMIT 1;

  IF v_module_id IS NULL THEN
    INSERT INTO modules
      (name, code, app_id, wbs_code, parent_id, type, icon, path,
       status, enterprise_id, organization_id, created_at, updated_at)
    VALUES
      ('Audit Logs', 'AUDIT_LOG', v_admin_app_id, '14', NULL,
       'mod', 'ScrollText', '/admin/audit-logs',
       'ACTIVE', SYS_ENT, SYS_ORG, NOW(), NOW())
    RETURNING id INTO v_module_id;
    RAISE NOTICE 'Created AUDIT_LOG module: %', v_module_id;
  ELSE
    RAISE NOTICE 'AUDIT_LOG module already exists: %', v_module_id;
  END IF;

  -- ── 3. Ensure the "view" action exists ─────────────────────────────────────
  SELECT id INTO v_view_action
  FROM actions
  WHERE LOWER(name) = 'view' AND deleted_at IS NULL
  LIMIT 1;

  IF v_view_action IS NULL THEN
    INSERT INTO actions (name, status, enterprise_id, organization_id, created_at, updated_at)
    VALUES ('view', 'ACTIVE', SYS_ENT, SYS_ORG, NOW(), NOW())
    RETURNING id INTO v_view_action;
  END IF;

  -- ── 4. Grant view to all roles that have ACCESS view ───────────────────────
  --  ACCESS module covers roles/permissions management — only privileged admins.
  FOR v_role IN
    SELECT DISTINCT ma.role_id
    FROM module_access ma
    JOIN modules m ON m.id = ma.module_id
    JOIN actions a ON a.id = ma.action_id
    WHERE m.code = 'ACCESS'
      AND LOWER(a.name) = 'view'
      AND ma.access_flag = TRUE
  LOOP
    INSERT INTO module_access (role_id, module_id, action_id, access_flag, created_at, updated_at)
    VALUES (v_role.role_id, v_module_id, v_view_action, TRUE, NOW(), NOW())
    ON CONFLICT (role_id, module_id, action_id) DO UPDATE
      SET access_flag = TRUE, updated_at = NOW();
  END LOOP;

  RAISE NOTICE 'Done — AUDIT_LOG (wbs 14) seeded and access granted to ACCESS-level roles';
END $$;
