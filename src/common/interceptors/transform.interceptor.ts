import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Response Interface
 *
 * Standardized response structure for all API endpoints
 */
export interface Response<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * Transform Interceptor
 *
 * Global interceptor that transforms all successful responses into a
 * consistent format. This ensures API consumers receive predictable
 * response structures.
 *
 * Design Pattern: Interceptor Pattern
 * - Intercepts responses and transforms them into standardized format
 *
 * Response Format:
 * {
 *   success: true,
 *   data: <actual response data>,
 *   message: <optional message>,
 *   timestamp: <ISO timestamp>
 * }
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
