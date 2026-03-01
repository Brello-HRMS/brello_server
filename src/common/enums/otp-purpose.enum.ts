/**
 * OTP Purpose Enum
 *
 * Defines the various purposes for which OTPs can be generated.
 * Each purpose may have different validation rules and expiration times.
 */
export enum OtpPurpose {
  /** OTP for user login (passwordless authentication) */
  LOGIN = 'LOGIN',

  /** OTP for password reset flow */
  RESET_PASSWORD = 'RESET_PASSWORD',

  /** OTP for email verification */
  VERIFY_EMAIL = 'VERIFY_EMAIL',

  /** OTP for phone number verification */
  VERIFY_PHONE = 'VERIFY_PHONE',

  /** OTP for two-factor authentication */
  TWO_FACTOR_AUTH = 'TWO_FACTOR_AUTH',

  /** OTP for Platform Admin initial registration */
  PLATFORM_ADMIN_REGISTER = 'PLATFORM_ADMIN_REGISTER',

  /** OTP for Platform Admin login */
  PLATFORM_ADMIN_LOGIN = 'PLATFORM_ADMIN_LOGIN',
}
