import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { LoggedInUser as LoggedInUserInterface } from '../../modules/auth/interfaces/logged-in-user.interface';

/**
 * LoggedInUser Decorator
 *
 * Custom parameter decorator to extract the standardized loggedInUser object
 * from the request. This object is populated by the LoggedInUserInterceptor.
 *
 * @example
 * ```typescript
 * @Get()
 * @UseGuards(JwtAuthGuard)
 * findAll(@LoggedInUser() user: LoggedInUser) {
 *   return this.service.findAll(user.organizationId);
 * }
 * ```
 */
export const LoggedInUser = createParamDecorator(
  (data: keyof LoggedInUserInterface | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const loggedInUser = request.loggedInUser;

    return data ? loggedInUser?.[data] : loggedInUser;
  },
);
