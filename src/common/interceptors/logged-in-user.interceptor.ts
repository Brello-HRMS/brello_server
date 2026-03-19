import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { LoggedInUser } from '../../modules/auth/interfaces/logged-in-user.interface';

/**
 * LoggedInUser Interceptor
 *
 * This interceptor runs after the AuthGuard but before the controller.
 * it extracts the user payload from request.user (set by Passport)
 * and attaches a standardized loggedInUser object to the request.
 */
@Injectable()
export class LoggedInUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.user) {
      const user = request.user;
      
      // Construct the standardized loggedInUser object
      const loggedInUser: LoggedInUser = {
        userId: user.userId,
        enterpriseId: user.enterpriseId,
        organizationId: user.organizationId,
        appId: user.appId,
        isPlatformAdmin: !!user.isPlatformAdmin,
      };

      // Attach it to the request object
      request.loggedInUser = loggedInUser;
    }

    return next.handle();
  }
}
