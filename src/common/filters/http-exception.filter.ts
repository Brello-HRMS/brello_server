import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * HTTP Exception Filter
 *
 * Global exception filter that catches all HTTP exceptions and formats
 * them into a consistent response structure.
 *
 * Design Pattern: Interceptor Pattern
 * - Intercepts exceptions and transforms them into standardized responses
 *
 * Response Format:
 * {
 *   statusCode: number,
 *   timestamp: string,
 *   path: string,
 *   message: string | string[],
 *   errorCode: string
 * }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorCode = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'object' && 'message' in exceptionResponse
          ? (exceptionResponse.message as string | string[])
          : exception.message;
      errorCode =
        typeof exceptionResponse === 'object' && 'error' in exceptionResponse
          ? (exceptionResponse.error as string)
          : HttpStatus[status];
    } else if (exception.name === 'QueryFailedError') {
      // Handle TypeORM/Postgres errors
      const dbError = exception as any;
      switch (dbError.code) {
        case '23505': // Unique Violation
          status = HttpStatus.CONFLICT;
          message = 'A record with this value already exists.';
          errorCode = 'UNIQUE_VIOLATION';
          break;
        case '23502': // Not Null Violation
          status = HttpStatus.BAD_REQUEST;
          message = `Requirement missing: ${dbError.column} cannot be null.`;
          errorCode = 'NOT_NULL_VIOLATION';
          break;
        case '22P02': // Invalid Text Representation / Enum
          status = HttpStatus.BAD_REQUEST;
          message = 'Invalid input format for one or more fields. Check enum values.';
          errorCode = 'INVALID_INPUT_FORMAT';
          break;
        case '23503': // Foreign Key Violation
          status = HttpStatus.BAD_REQUEST;
          message = 'Related record not found.';
          errorCode = 'FOREIGN_KEY_VIOLATION';
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = 'Database operation failed.';
          errorCode = 'DATABASE_ERROR';
      }
    }

    // Log the error for debugging
    this.logger.error(
      `HTTP ${status} Error: ${JSON.stringify(message)} - Path: ${request.url}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Send standardized error response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      errorCode,
    });
  }
}
