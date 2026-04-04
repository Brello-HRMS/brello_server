/**
 * Geo Fence Interface
 *
 * Defines the shape of geo-fencing configuration for attendance rules.
 * Used for location-based check-in validation.
 */
export interface GeoFenceConfig {
  office_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}
