import { Exclude, Expose } from 'class-transformer';

/**
 * Auth Response DTO
 * 
 * Data Transfer Object for authentication responses.
 * Contains access token, refresh token, and user information.
 * 
 * Design Pattern: DTO Pattern
 * - Standardizes authentication response structure
 * - Provides type safety for API consumers
 */
@Exclude()
export class AuthResponseDto {
    @Expose()
    access_token: string;

    @Expose()
    refresh_token: string;

    @Expose()
    user: {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        enterprise_id: string;
        organization_id: string;
    };

    @Expose()
    expires_in: number; // Access token expiration in seconds
}

/**
 * Refresh Token Response DTO
 * 
 * Response for token refresh endpoint.
 */
@Exclude()
export class RefreshTokenResponseDto {
    @Expose()
    access_token: string;

    @Expose()
    refresh_token: string;

    @Expose()
    expires_in: number;
}
