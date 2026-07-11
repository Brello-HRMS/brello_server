/**
 * Signed `state` payload carried through the Google OAuth round-trip.
 *
 * The consent flow leaves and re-enters our app via a browser redirect that
 * carries NO auth header, so the organization/user context that initiated the
 * connection is embedded here and signed (JWT) to prevent tampering/CSRF.
 */
export interface OAuthStatePayload {
  organizationId: string;
  enterpriseId: string;
  userId: string;
  /** Random nonce so two connect attempts never produce an identical state. */
  nonce: string;
}

/**
 * Normalized result of exchanging an OAuth authorization code for tokens plus
 * the connected account's identity (from the OpenID id_token).
 */
export interface GoogleTokenResult {
  email: string;
  googleSub: string;
  displayName: string | null;
  refreshToken: string;
  scope: string | null;
  expiryDate: Date | null;
}
