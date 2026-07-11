-- =====================================================================
--  Backfill module icons.
--
--  Most modules/sub-modules in the ADMIN app tree were seeded or created
--  via the admin UI with icon = NULL, so they render as the default
--  Circle icon in the sidebar. This assigns a fitting icon (from
--  src/features/sidebar/utils/iconMapper.ts's iconMap, which was
--  extended alongside this migration) to every module that didn't
--  already have one.
--
--  Also corrects OFFER_MANAGEMENT, which shipped with icon = NULL
--  despite the original seed (seed-offer-management.ts) intending
--  'Handshake'.
--
--  Usage:
--    1. Edit the SET search_path line below to match your environment.
--    2. Run:  psql "<conn-string>" -f docs/migrations/2026-07-11-module-icon-backfill.sql
--
--  Safe to re-run (idempotent — updates by code, not position).
-- =====================================================================

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello_v3, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

BEGIN;

-- Top-level modules
UPDATE modules SET icon = 'CalendarClock', updated_at = NOW() WHERE code = 'ATTENDANCE' AND deleted_at IS NULL;
UPDATE modules SET icon = 'Users',         updated_at = NOW() WHERE code = 'EMP' AND deleted_at IS NULL;
UPDATE modules SET icon = 'HandCoins',     updated_at = NOW() WHERE code = 'PRL' AND deleted_at IS NULL;
UPDATE modules SET icon = 'KeyRound',      updated_at = NOW() WHERE code = 'ACCESS' AND deleted_at IS NULL;
UPDATE modules SET icon = 'CreditCard',    updated_at = NOW() WHERE code = 'BILLING' AND deleted_at IS NULL;
UPDATE modules SET icon = 'ScrollText',    updated_at = NOW() WHERE code = 'LETTER_MANAGEMENT' AND deleted_at IS NULL;
UPDATE modules SET icon = 'LifeBuoy',      updated_at = NOW() WHERE code = 'SUPPORT' AND deleted_at IS NULL;
UPDATE modules SET icon = 'History',       updated_at = NOW() WHERE code = 'AUDIT_LOG' AND deleted_at IS NULL;
UPDATE modules SET icon = 'Handshake',     updated_at = NOW() WHERE code = 'OFFER_MANAGEMENT' AND deleted_at IS NULL;

-- Organization sub-modules
UPDATE modules SET icon = 'CalendarOff', updated_at = NOW() WHERE code = 'LEAVE_SETUP' AND deleted_at IS NULL;
UPDATE modules SET icon = 'Network',     updated_at = NOW() WHERE code = 'ORG_DEPARTMENTS' AND deleted_at IS NULL;
UPDATE modules SET icon = 'Tags',        updated_at = NOW() WHERE code = 'ORG_DESIGNATIONS' AND deleted_at IS NULL;
UPDATE modules SET icon = 'FileText',    updated_at = NOW() WHERE code = 'ORG_POLICIES' AND deleted_at IS NULL;
UPDATE modules SET icon = 'Wallet',      updated_at = NOW() WHERE code = 'ORG_PAYROLL' AND deleted_at IS NULL;
UPDATE modules SET icon = 'Building2',   updated_at = NOW() WHERE code = 'ORG_PROFILE' AND deleted_at IS NULL;

-- Attendance sub-modules
UPDATE modules SET icon = 'CalendarDays', updated_at = NOW() WHERE code = 'LEAVE_HOLIDAYS' AND deleted_at IS NULL;
UPDATE modules SET icon = 'Scale',        updated_at = NOW() WHERE code = 'LEAVE_BALANCE' AND deleted_at IS NULL;
UPDATE modules SET icon = 'CalendarPlus', updated_at = NOW() WHERE code = 'LEAVE_REQUESTS' AND deleted_at IS NULL;
UPDATE modules SET icon = 'CalendarCheck', updated_at = NOW() WHERE code = 'ATTENDANCE_DAILY' AND deleted_at IS NULL;
UPDATE modules SET icon = 'Settings',     updated_at = NOW() WHERE code = 'ATTENDANCE_SETUP' AND deleted_at IS NULL;

-- Employee sub-modules
UPDATE modules SET icon = 'Contact', updated_at = NOW() WHERE code = 'EMP_DIRECTORY' AND deleted_at IS NULL;
UPDATE modules SET icon = 'UserCog', updated_at = NOW() WHERE code = 'EMP_PROFILE_ADMIN' AND deleted_at IS NULL;

-- Payroll sub-modules
UPDATE modules SET icon = 'Receipt', updated_at = NOW() WHERE code = 'PAYROLL_OVERVIEW' AND deleted_at IS NULL;

-- Access sub-modules
UPDATE modules SET icon = 'ShieldCheck', updated_at = NOW() WHERE code = 'ACCESS_ROLES' AND deleted_at IS NULL;
UPDATE modules SET icon = 'Users',       updated_at = NOW() WHERE code = 'ACCESS_USERS' AND deleted_at IS NULL;
UPDATE modules SET icon = 'Fingerprint', updated_at = NOW() WHERE code = 'ACCESS_PERMISSIONS' AND deleted_at IS NULL;

-- Billing sub-modules
UPDATE modules SET icon = 'Layers',           updated_at = NOW() WHERE code = 'BILLING_PLAN' AND deleted_at IS NULL;
UPDATE modules SET icon = 'ReceiptText',      updated_at = NOW() WHERE code = 'BILLING_INVOICE' AND deleted_at IS NULL;
UPDATE modules SET icon = 'CircleDollarSign', updated_at = NOW() WHERE code = 'BILLING_PAYMENT' AND deleted_at IS NULL;

-- HR Letters sub-modules
UPDATE modules SET icon = 'Mails',     updated_at = NOW() WHERE code = 'LETTER_ISSUED' AND deleted_at IS NULL;
UPDATE modules SET icon = 'FileStack', updated_at = NOW() WHERE code = 'LETTER_TEMPLATES' AND deleted_at IS NULL;

-- Support sub-modules
UPDATE modules SET icon = 'MessageSquare', updated_at = NOW() WHERE code = 'SUPPORT_FEEDBACK' AND deleted_at IS NULL;
UPDATE modules SET icon = 'Flag',          updated_at = NOW() WHERE code = 'SUPPORT_REPORT' AND deleted_at IS NULL;

-- Client & Project sub-modules
UPDATE modules SET icon = 'Timer', updated_at = NOW() WHERE code = 'PROJECT_TIMESHEET' AND deleted_at IS NULL;

COMMIT;
