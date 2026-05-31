import { SetMetadata } from '@nestjs/common';

export const RESTRICTED_ON_EXPIRY_KEY = 'restricted_on_expiry';

// Marks a controller or route as blocked when the org's subscription is past grace and EXPIRED.
export const RestrictedOnExpiry = () =>
  SetMetadata(RESTRICTED_ON_EXPIRY_KEY, true);
