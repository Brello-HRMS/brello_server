import { Exclude, Expose, Type } from 'class-transformer';

/** Summary of an available app returned on login/switch-app */
export class AvailableAppDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() priority: number;
}

/**
 * Auth Response DTO — returned on login & OTP-login
 *
 * Note: `refresh_token` is deliberately excluded from the response body.
 * It is delivered only via a Secure HttpOnly cookie set by the controller.
 */
@Exclude()
export class AuthResponseDto {
  @Expose()
  access_token: string;

  /**
   * Refresh token — used internally to set the HttpOnly cookie.
   * Not serialized in the response body (no @Expose).
   */
  refresh_token: string;

  @Expose()
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    enterprise_id?: string;
    organization_id?: string;
    is_platform_admin?: boolean;
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

  /** Indicates if the user must complete company setup before proceeding */
  @Expose()
  setup_required?: boolean;
}

/**
 * Refresh Token Response DTO
 *
 * Note: `refresh_token` is excluded from the response body.
 * It is delivered only via a Secure HttpOnly cookie.
 */
@Exclude()
export class RefreshTokenResponseDto {
  @Expose()
  access_token: string;

  /**
   * Refresh token — used internally to set the HttpOnly cookie.
   * Not serialized in the response body (no @Expose).
   */
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
