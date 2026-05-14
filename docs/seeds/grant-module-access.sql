-- =====================================================================
--  Grant a module's actions to a user (idempotent).
--
--  What it does:
--    1. Ensures the AppModule exists in the user's app (creates if missing).
--    2. Ensures every Action code listed below exists.
--    3. Inserts ModuleAccess rows for every active role the user has in
--       that app — one per (role × module × action).
--    4. Enables the module + actions in the org's active subscription plan
--       (so the plan-level AND in PermissionResolverService doesn't strip
--       them back out).
--
--  Usage:
--    1. Set the schema in the SET search_path line below to match your
--       environment (dev: brello_dev, prod: brello).
--    2. Edit the configuration block in the DO body (email, module, actions).
--    3. Run:  psql "<conn-string>" -f docs/seeds/grant-module-access.sql
--
--  Examples:
--    - Leave Management         → code='LEAVE_MGMT', actions=view,create,update,approve,delete
--    - Attendance Configuration → code='ATTENDANCE_CONFIG', actions=view,create,update,delete
--    - Payroll                  → code='PAYROLL', actions=view,create,update,export
--
--  Safe to re-run. All inserts use ON CONFLICT … DO UPDATE.
-- =====================================================================

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello_dev, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

DO $$
DECLARE
    -- ▼▼▼ CONFIGURE THIS BLOCK ▼▼▼
    v_email           text   := 'b10@admin.com';
    v_module_code     text   := 'ATTENDANCE';
    v_module_name     text   := 'Attendance';
    v_action_codes    text[] := ARRAY['view', 'create', 'update', 'approve', 'delete'];
    -- ▲▲▲ ──────────────────── ▲▲▲

    v_user_id         uuid;
    v_org_id          uuid;
    v_enterprise_id   uuid;
    v_app_id          uuid;
    v_module_id       uuid;
    v_plan_id         uuid;
    v_action_code     text;
    v_action_id       uuid;
    v_role_id         uuid;
    v_role_count      int := 0;
    v_max_wbs         int;
    v_next_wbs        text;
BEGIN
    -- ─── 1. Resolve user ───────────────────────────────────────────────
    SELECT id, organization_id, enterprise_id
      INTO v_user_id, v_org_id, v_enterprise_id
      FROM users
     WHERE email = v_email
       AND status = 'ACTIVE'
     LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User % not found or inactive', v_email;
    END IF;

    -- ─── 2. Resolve app: prefer last_access_app_id, else first active role's app ──
    SELECT u.last_access_app_id
      INTO v_app_id
      FROM users u
     WHERE u.id = v_user_id;

    IF v_app_id IS NULL THEN
        SELECT r.app_id
          INTO v_app_id
          FROM user_role_map urm
          JOIN role r ON r.id = urm.role_id
         WHERE urm.user_id = v_user_id
           AND urm.organization_id = v_org_id
           AND r.status = 'ACTIVE'
         ORDER BY urm.created_at ASC
         LIMIT 1;
    END IF;

    IF v_app_id IS NULL THEN
        RAISE EXCEPTION 'Could not resolve app_id for user % — they have no active roles', v_email;
    END IF;

    RAISE NOTICE 'User: %, Org: %, App: %', v_user_id, v_org_id, v_app_id;

    -- ─── 3. Ensure AppModule with this code exists in the app ─────────
    SELECT id INTO v_module_id
      FROM modules
     WHERE app_id = v_app_id AND code = v_module_code;

    IF v_module_id IS NULL THEN
        -- Pick a free wbs_code: max integer wbs in this app + 1
        SELECT COALESCE(MAX((wbs_code)::int), 0) + 1
          INTO v_max_wbs
          FROM modules
         WHERE app_id = v_app_id
           AND wbs_code ~ '^\d+$';

        v_next_wbs := COALESCE(v_max_wbs::text, '99');

        INSERT INTO modules
            (id, app_id, code, name, wbs_code, type, status,
             organization_id, enterprise_id, modified_by)
        VALUES
            (gen_random_uuid(), v_app_id, v_module_code, v_module_name, v_next_wbs,
             'mod', 'ACTIVE', v_org_id, v_enterprise_id, v_user_id)
        RETURNING id INTO v_module_id;

        RAISE NOTICE 'Created AppModule % (id=%) at wbs_code=%',
            v_module_code, v_module_id, v_next_wbs;
    ELSE
        RAISE NOTICE 'AppModule % already exists (id=%)', v_module_code, v_module_id;
    END IF;

    -- ─── 4. Ensure every Action code exists ────────────────────────────
    FOREACH v_action_code IN ARRAY v_action_codes LOOP
        SELECT id INTO v_action_id
          FROM actions
         WHERE code = v_action_code AND status = 'ACTIVE';

        IF v_action_id IS NULL THEN
            INSERT INTO actions (id, code, name, status, modified_by)
            VALUES (gen_random_uuid(), v_action_code,
                    UPPER(LEFT(v_action_code, 1)) || SUBSTRING(v_action_code FROM 2),
                    'ACTIVE', v_user_id);
            RAISE NOTICE 'Created Action %', v_action_code;
        END IF;
    END LOOP;

    -- ─── 5. Grant access to every active role the user has in this app ──
    FOR v_role_id IN
        SELECT urm.role_id
          FROM user_role_map urm
          JOIN role r ON r.id = urm.role_id
         WHERE urm.user_id = v_user_id
           AND urm.organization_id = v_org_id
           AND r.app_id = v_app_id
           AND r.status = 'ACTIVE'
    LOOP
        v_role_count := v_role_count + 1;

        FOREACH v_action_code IN ARRAY v_action_codes LOOP
            SELECT id INTO v_action_id FROM actions WHERE code = v_action_code;

            INSERT INTO module_access (id, role_id, module_id, action_id, access_flag)
            VALUES (gen_random_uuid(), v_role_id, v_module_id, v_action_id, true)
            ON CONFLICT (role_id, module_id, action_id)
            DO UPDATE SET access_flag = true;
        END LOOP;

        RAISE NOTICE 'Granted %.{%} to role %',
            v_module_code, array_to_string(v_action_codes, ','), v_role_id;
    END LOOP;

    IF v_role_count = 0 THEN
        RAISE EXCEPTION 'User % has no active roles in app % — cannot grant access',
            v_email, v_app_id;
    END IF;

    -- ─── 6. Enable module + actions in the active subscription plan ──
    -- NOTE: SubscriptionStatus is mixed-case in the codebase ('Active', not 'ACTIVE').
    SELECT plan_id INTO v_plan_id
      FROM organization_subscription
     WHERE organization_id = v_org_id
       AND sub_status = 'Active'
     ORDER BY start_date DESC
     LIMIT 1;

    IF v_plan_id IS NOT NULL THEN
        -- PlanModule
        INSERT INTO plan_module
            (id, plan_id, module_id, enabled, status,
             organization_id, enterprise_id, modified_by)
        VALUES
            (gen_random_uuid(), v_plan_id, v_module_id, true, 'ACTIVE',
             v_org_id, v_enterprise_id, v_user_id)
        ON CONFLICT (plan_id, module_id)
        DO UPDATE SET enabled = true;

        -- PlanModuleAction (one per action)
        FOREACH v_action_code IN ARRAY v_action_codes LOOP
            SELECT id INTO v_action_id FROM actions WHERE code = v_action_code;

            INSERT INTO plan_module_action
                (id, plan_id, module_id, action_id, enabled, status,
                 organization_id, enterprise_id, modified_by)
            VALUES
                (gen_random_uuid(), v_plan_id, v_module_id, v_action_id, true, 'ACTIVE',
                 v_org_id, v_enterprise_id, v_user_id)
            ON CONFLICT (plan_id, module_id, action_id)
            DO UPDATE SET enabled = true;
        END LOOP;

        RAISE NOTICE 'Enabled % in plan %', v_module_code, v_plan_id;
    ELSE
        RAISE WARNING 'No active subscription found for organization % — skipped plan-level enablement. PermissionResolver passes everything through when no plan is found, so role-based grants alone will work for now.',
            v_org_id;
    END IF;

    RAISE NOTICE '✅ Done. % role(s) granted % permissions.', v_role_count, v_module_code;
END $$;
