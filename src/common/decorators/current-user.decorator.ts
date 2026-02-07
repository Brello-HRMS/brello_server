import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Current User Decorator
 * 
 * Custom parameter decorator to extract the current authenticated user
 * from the request object. Used in controllers to access user information
 * without manually extracting from request.
 * 
 * Design Pattern: Decorator Pattern
 * - Adds functionality to extract user from request context
 * 
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: JwtPayload) {
 *   return user;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
    (data: string | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user;

        // If a specific property is requested, return that property
        // Otherwise return the entire user object
        return data ? user?.[data] : user;
    },
);
