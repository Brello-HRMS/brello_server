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
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Extract message from exception response
    const message =
      typeof exceptionResponse === 'object' && 'message' in exceptionResponse
        ? exceptionResponse.message
        : exception.message;

    // Log the error for debugging
    this.logger.error(
      `HTTP ${status} Error: ${JSON.stringify(message)} - Path: ${request.url}`,
      exception.stack,
    );

    // Send standardized error response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      errorCode:
        typeof exceptionResponse === 'object' && 'error' in exceptionResponse
          ? exceptionResponse.error
          : HttpStatus[status],
    });
  }
}
