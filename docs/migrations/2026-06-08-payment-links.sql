-- =====================================================================
--  Razorpay Payment Links — backend-generated hosted payment links
--
--  Adds payment-link support to the existing `payment` table so order +
--  link creation happen fully on the backend (frontend just opens short_url):
--    - razorpay_order_id        → made NULLable (link payments have no order
--                                  we created; Razorpay generates its own)
--    - razorpay_payment_link_id → plink_xxx id of the hosted link
--    - short_url                → hosted payment page URL
--
--  Dev auto-syncs from the entity; run this only where synchronize is disabled.
--
--  Usage:
--    1. Set the schema in the SET search_path line below to match your env.
--    2. Run:  psql "<conn-string>" -f docs/migrations/2026-06-08-payment-links.sql
--
--  Safe to re-run.
-- =====================================================================

-- ▼▼▼ EDIT THIS to match your environment's schema ▼▼▼
SET search_path TO brello, public;
-- ▲▲▲ ─────────────────────────────────────────── ▲▲▲

ALTER TABLE payment
  ALTER COLUMN razorpay_order_id DROP NOT NULL;

ALTER TABLE payment
  ADD COLUMN IF NOT EXISTS razorpay_payment_link_id varchar(100);

ALTER TABLE payment
  ADD COLUMN IF NOT EXISTS short_url varchar(512);

CREATE INDEX IF NOT EXISTS idx_payment_razorpay_payment_link_id
  ON payment (razorpay_payment_link_id);
