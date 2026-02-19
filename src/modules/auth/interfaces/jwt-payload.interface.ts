/**
 * JWT Payload Interface
 *
 * Defines the structure of the access token JWT payload.
 *
 * Security note: No roles are stored inside the JWT.
 * Roles are resolved at runtime by PermissionResolverService using
 * userId + organizationId + appId as lookup keys.
 */
export interface JwtPayload {
    /** User's unique identifier (maps to users.id) */
    userId: string;

    /** Session identifier for session management & refresh token validation */
    sessionId: string;

    /** Organization the user is acting within */
    organizationId: string;

    /** Enterprise the user belongs to */
    enterpriseId: string;

    /** Currently active application (determines which roles/modules to resolve) */
    appId: string;

    /** Refresh token value — included only in refresh token payload */
    refreshToken?: string;

    /** Issued-at timestamp (standard JWT claim, auto-set) */
    iat?: number;

    /** Expiration timestamp (standard JWT claim, auto-set) */
    exp?: number;
}
