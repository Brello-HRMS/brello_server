/**
 * JWT Payload Interface
 * 
 * Defines the structure of the JWT token payload.
 * This interface ensures type safety when working with JWT tokens.
 * 
 * Design Pattern: Interface Segregation Principle
 * - Defines a focused contract for JWT payload
 * - Used by both JWT generation and validation
 * 
 * Payload Contents:
 * - userId: Identifies the authenticated user
 * - sessionId: Links token to a specific session
 * - refreshToken: Included in refresh token payload only
 */
export interface JwtPayload {
    /**
     * User's unique identifier
     */
    userId: string;

    /**
     * Session's unique identifier
     * Used to validate and manage sessions
     */
    sessionId: string;

    /**
     * Refresh token identifier (only in refresh token payload)
     * Used for token rotation
     */
    refreshToken?: string;

    /**
     * Issued at timestamp (standard JWT claim)
     */
    iat?: number;

    /**
     * Expiration timestamp (standard JWT claim)
     */
    exp?: number;
}
