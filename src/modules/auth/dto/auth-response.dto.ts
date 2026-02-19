import { Exclude, Expose, Type } from 'class-transformer';

/** Summary of an available app returned on login/switch-app */
export class AvailableAppDto {
    @Expose() id: string;
    @Expose() name: string;
    @Expose() priority: number;
}

/**
 * Auth Response DTO — returned on login & switch-app
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
    expires_in: number;

    /** The app the JWT is currently scoped to */
    @Expose()
    defaultAppId: string;

    /** All apps the user has at least one role in */
    @Expose()
    @Type(() => AvailableAppDto)
    availableApps: AvailableAppDto[];
}

/**
 * Refresh Token Response DTO
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

/**
 * Switch App Response DTO
 */
@Exclude()
export class SwitchAppResponseDto {
    @Expose()
    access_token: string;

    @Expose()
    appId: string;

    @Expose()
    expires_in: number;
}
