const SENSITIVE_KEYS = [
  'password',
  'password_hash',
  'otp',
  'otp_hash',
  'access_token',
  'refresh_token',
  'refresh_token_hash',
  'secret',
  'token',
  'api_key',
  'account_number',
];

/**
 * Strips sensitive fields from an object before writing to the audit log.
 * Replaces matching values with "[REDACTED]" instead of removing them
 * so the field's presence is still visible in the diff.
 */
export function sanitizeForAudit(
  obj: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (!obj || typeof obj !== 'object') return obj;

  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s)) ? '[REDACTED]' : v,
    ]),
  );
}
