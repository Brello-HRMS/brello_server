# Error & Exception Handling — Brello Server

> **Purpose:** This document explains how the Brello Server handles errors and exceptions today, walks through every layer of the NestJS pipeline where errors are caught, and recommends production-grade improvements.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [NestJS Exception Pipeline (Request Lifecycle)](#2-nestjs-exception-pipeline-request-lifecycle)
3. [Layer-by-Layer Breakdown](#3-layer-by-layer-breakdown)
   - 3.1 [Validation Layer — `ValidationPipe` + DTOs](#31-validation-layer--validationpipe--dtos)
   - 3.2 [Authentication Layer — Guards & Strategies](#32-authentication-layer--guards--strategies)
   - 3.3 [Authorization Layer — `AccessGuard`](#33-authorization-layer--accessguard)
   - 3.4 [Service / Business Logic Layer](#34-service--business-logic-layer)
   - 3.5 [Global Exception Filter — `HttpExceptionFilter`](#35-global-exception-filter--httpexceptionfilter)
   - 3.6 [Global Response Interceptor — `TransformInterceptor`](#36-global-response-interceptor--transforminterceptor)
4. [Current Error Response Formats](#4-current-error-response-formats)
5. [Built-in NestJS HTTP Exceptions Used](#5-built-in-nestjs-http-exceptions-used)
6. [What Is Missing for Production](#6-what-is-missing-for-production)
7. [Production Best Practices & Recommendations](#7-production-best-practices--recommendations)
   - 7.1 [Catch ALL Exceptions (Not Just HttpException)](#71-catch-all-exceptions-not-just-httpexception)
   - 7.2 [Custom Business Exception Classes](#72-custom-business-exception-classes)
   - 7.3 [Request-Scoped Correlation IDs](#73-request-scoped-correlation-ids)
   - 7.4 [Structured Logging](#74-structured-logging)
   - 7.5 [Sensitive Data Sanitization](#75-sensitive-data-sanitization)
   - 7.6 [Global Database / TypeORM Error Handling](#76-global-database--typeorm-error-handling)
   - 7.7 [Rate Limiting & Throttling Errors](#77-rate-limiting--throttling-errors)
   - 7.8 [Health Checks & Graceful Shutdown](#78-health-checks--graceful-shutdown)
   - 7.9 [Error Monitoring & Alerting](#79-error-monitoring--alerting)
   - 7.10 [Standardized Error Code Catalog](#710-standardized-error-code-catalog)
8. [Recommended Production Exception Filter (Full Code)](#8-recommended-production-exception-filter-full-code)
9. [Summary Checklist](#9-summary-checklist)

---

## 1. High-Level Overview

The Brello Server is a **NestJS** application (v11) using **TypeORM** with PostgreSQL, **Passport JWT** for authentication, and **class-validator** for DTO validation.

Error handling follows NestJS conventions:

```
Request → Middleware → Guards → Interceptors (before) → Pipes → Controller → Service → Interceptors (after) → Exception Filters → Response
```

| Component | File | Role in Error Handling |
|---|---|---|
| `ValidationPipe` | `main.ts` (global) | Rejects malformed payloads with 400 |
| `JwtAuthGuard` | `guards/jwt-auth.guard.ts` | Rejects unauthenticated requests with 401 |
| `JwtRefreshAuthGuard` | `guards/jwt-refresh-auth.guard.ts` | Rejects invalid refresh tokens with 401 |
| `AccessGuard` | `core/guards/access.guard.ts` | Rejects unauthorized RBAC requests with 403 |
| Service layer | `*.service.ts` | Throws typed `HttpException` subclasses |
| `HttpExceptionFilter` | `common/filters/http-exception.filter.ts` | Catches `HttpException` → standardized JSON |
| `TransformInterceptor` | `common/interceptors/transform.interceptor.ts` | Wraps **successful** responses in `{ success, data, timestamp }` |

---

## 2. NestJS Exception Pipeline (Request Lifecycle)

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                        Incoming HTTP Request                       │
  └──────────────────────────────────┬──────────────────────────────────┘
                                     │
                                     ▼
                       ┌─────────────────────────────┐
                       │   Global Middleware (CORS)   │
                       └──────────────┬──────────────┘
                                      │
                                      ▼
                       ┌─────────────────────────────┐
                       │     Guards (Auth / RBAC)     │ ← 401 / 403 thrown here
                       └──────────────┬──────────────┘
                                      │
                                      ▼
                       ┌─────────────────────────────┐
                       │   Interceptors (PRE-handle)  │ ← TransformInterceptor starts
                       └──────────────┬──────────────┘
                                      │
                                      ▼
                       ┌─────────────────────────────┐
                       │    Pipes (ValidationPipe)    │ ← 400 thrown here (DTO invalid)
                       └──────────────┬──────────────┘
                                      │
                                      ▼
                       ┌─────────────────────────────┐
                       │    Controller → Service      │ ← Business exceptions thrown here
                       └──────────────┬──────────────┘
                                      │
                                      ▼
                       ┌─────────────────────────────┐
                       │  Interceptors (POST-handle)  │ ← TransformInterceptor wraps data
                       └──────────────┬──────────────┘
                                      │
                                      ▼
                       ┌─────────────────────────────┐
                       │  Exception Filter (Global)   │ ← HttpExceptionFilter catches errors
                       └──────────────┬──────────────┘
                                      │
                                      ▼
                       ┌─────────────────────────────┐
                       │      HTTP Response Sent      │
                       └─────────────────────────────┘
```

**Key point:** If any layer throws an exception, execution jumps directly to the **Exception Filter**. The interceptor post-handling is skipped.

---

## 3. Layer-by-Layer Breakdown

### 3.1 Validation Layer — `ValidationPipe` + DTOs

**Registered in:** `main.ts` (globally)

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,           // Strip unknown properties
    transform: true,           // Auto-transform payloads to DTO instances
    forbidNonWhitelisted: true, // Reject unknown properties with 400
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

**How it works:**
- Every incoming request body is validated against the relevant DTO class.
- DTOs use `class-validator` decorators: `@IsEmail`, `@IsNotEmpty`, `@Length`, `@Matches`, `@IsUUID`, etc.
- If validation fails, NestJS automatically throws a `BadRequestException` with an array of human-readable messages.

**Example DTO — `CreateUserDto`:**
```typescript
@IsEmail({}, { message: 'Email must be a valid email address' })
@IsNotEmpty({ message: 'Email is required' })
email: string;

@Length(8, 100, { message: 'Password must be at least 8 characters long' })
@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
  message: 'Password must contain uppercase, lowercase, number, and special character',
})
password: string;
```

**Resulting error response (auto-generated by NestJS + caught by filter):**
```json
{
  "statusCode": 400,
  "timestamp": "2026-02-25T17:30:00.000Z",
  "path": "/api/v1/users",
  "message": [
    "Email must be a valid email address",
    "Password must be at least 8 characters long"
  ],
  "error": "Bad Request"
}
```

**Controller param validation** is also handled via `ParseUUIDPipe`:
```typescript
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) { ... }
```
This throws `BadRequestException` if the `:id` is not a valid UUID.

---

### 3.2 Authentication Layer — Guards & Strategies

| Guard | Strategy | Error Scenario |
|---|---|---|
| `JwtAuthGuard` | `JwtStrategy` (`passport-jwt`) | Missing/expired/malformed Bearer token → `401 Unauthorized` |
| `JwtRefreshAuthGuard` | `JwtRefreshStrategy` | Invalid refresh token → `401 Unauthorized` |

**JWT Strategy (`jwt.strategy.ts`)** — throws custom `UnauthorizedException` when payload is incomplete:

```typescript
async validate(payload: JwtPayload): Promise<JwtPayload> {
  if (!payload.userId || !payload.sessionId) {
    throw new UnauthorizedException('Invalid token payload');
  }
  if (!payload.appId || !payload.organizationId) {
    throw new UnauthorizedException('Token missing app or organization context');
  }
  return payload;
}
```

**How Passport integrates:** If the JWT is invalid/expired, Passport itself throws `UnauthorizedException` **before** your `validate()` method is even called. Your custom logic in `validate()` handles business-level validations on the decoded payload.

---

### 3.3 Authorization Layer — `AccessGuard`

**File:** `core/guards/access.guard.ts`

This guard enforces fine-grained RBAC permissions using `PermissionResolverService`:

```typescript
if (!user?.userId || !user?.organizationId || !user?.appId) {
  throw new ForbiddenException('Authentication context is missing.');
}

if (!allowed) {
  throw new ForbiddenException(
    `You do not have permission to perform [${actionName}] on this resource.`
  );
}
```

**Errors thrown:** `403 Forbidden` — always.

---

### 3.4 Service / Business Logic Layer

This is the **primary layer** where application-specific exceptions are thrown. Every service follows a consistent pattern:

#### Exception Types Used Across All Services

| Exception Class | HTTP Status | Used When |
|---|---|---|
| `NotFoundException` | 404 | Entity not found by ID/email |
| `ConflictException` | 409 | Duplicate unique constraint (email, domain, phone, role assignment) |
| `UnauthorizedException` | 401 | Invalid credentials, expired sessions, wrong passwords |
| `ForbiddenException` | 403 | No active roles, no access to app |
| `BadRequestException` | 400 | Invalid/expired OTP, max attempts exceeded |

#### Patterns Observed

**Pattern 1 — Guard clause with throw:**
```typescript
// UserService, EnterpriseService, OrganizationService, RoleService, AppService
async findOne(id: string): Promise<Entity> {
  const entity = await this.repository.findById(id);
  if (!entity) {
    throw new NotFoundException(`Entity with ID '${id}' not found`);
  }
  return entity;
}
```

**Pattern 2 — Uniqueness check before create/update:**
```typescript
// UserService (email + phone), EnterpriseService (domain), AppService (name)
const exists = await this.repository.emailExists(email);
if (exists) {
  throw new ConflictException(`User with email '${email}' already exists`);
}
```

**Pattern 3 — Cascading validation (verify parent exists):**
```typescript
// UserService → validates Enterprise + Organization exist
// OrganizationService → validates Enterprise exists
await this.enterpriseService.findOne(dto.enterprise_id);  // throws 404 if missing
```

**Pattern 4 — Multi-step auth validation:**
```typescript
// AuthService.login()
if (!user) throw new UnauthorizedException('Invalid email or password');
if (user.status !== Status.ACTIVE) throw new UnauthorizedException('Account is inactive.');
if (!isPasswordValid) throw new UnauthorizedException('Invalid email or password');
if (!userRoleMaps.length) throw new ForbiddenException('No active roles assigned.');
```

**Pattern 5 — Silent fail for security:**
```typescript
// AuthService.forgotPassword() — does NOT reveal if email exists
if (!user) {
  this.logger.warn(`Forgot password attempt for non-existent email`);
  return; // Silent — no exception thrown
}
```

---

### 3.5 Global Exception Filter — `HttpExceptionFilter`

**File:** `common/filters/http-exception.filter.ts`  
**Registered in:** `main.ts` via `app.useGlobalFilters(new HttpExceptionFilter())`

```typescript
@Catch(HttpException)  // ⚠ Only catches HttpException and subclasses
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message = typeof exceptionResponse === 'object' && 'message' in exceptionResponse
      ? exceptionResponse.message
      : exception.message;

    // Log the error
    this.logger.error(
      `HTTP ${status} Error: ${JSON.stringify(message)} - Path: ${request.url}`,
      exception.stack,
    );

    // Send standardized response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error: typeof exceptionResponse === 'object' && 'error' in exceptionResponse
        ? exceptionResponse.error
        : HttpStatus[status],
    });
  }
}
```

**What it does well:**
- ✅ Consistent response format for all HTTP exceptions
- ✅ Logs errors with stack traces
- ✅ Extracts messages from both string and object exception responses

**⚠ Critical gap:** It uses `@Catch(HttpException)` — meaning **non-HTTP exceptions** (e.g., `TypeError`, `QueryFailedError` from TypeORM, unhandled promise rejections) will **NOT** be caught by this filter. They'll fall back to NestJS's default handler, which returns a generic `500 Internal Server Error` without your custom format.

---

### 3.6 Global Response Interceptor — `TransformInterceptor`

**File:** `common/interceptors/transform.interceptor.ts`  
**Registered in:** `main.ts` via `app.useGlobalInterceptors(new TransformInterceptor())`

```typescript
intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
  return next.handle().pipe(
    map((data) => ({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })),
  );
}
```

**Key:** This only wraps **successful** responses. If an exception is thrown, the interceptor's `map()` is never reached — the exception filter handles it instead.

---

## 4. Current Error Response Formats

### Success Response (via `TransformInterceptor`)
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-02-25T17:30:00.000Z"
}
```

### Error Response (via `HttpExceptionFilter`)
```json
{
  "statusCode": 400,
  "timestamp": "2026-02-25T17:30:00.000Z",
  "path": "/api/v1/users",
  "message": "Email must be a valid email address",
  "error": "Bad Request"
}
```

### Validation Error Response (array of messages)
```json
{
  "statusCode": 400,
  "timestamp": "2026-02-25T17:30:00.000Z",
  "path": "/api/v1/users",
  "message": [
    "First name is required",
    "Email must be a valid email address",
    "Password must be at least 8 characters long"
  ],
  "error": "Bad Request"
}
```

**⚠ Inconsistency:** Error responses include `{ statusCode, error }` but success responses use `{ success, data }`. The `success` field is missing from errors, and `statusCode` / `error` fields are missing from successes. Frontend consumers need to handle two different shapes.

---

## 5. Built-in NestJS HTTP Exceptions Used

| Exception | Status | Where Used |
|---|---|---|
| `BadRequestException` | 400 | `AuthService` (OTP invalid/expired), auto from `ValidationPipe` |
| `UnauthorizedException` | 401 | `AuthService` (login, password, session), `JwtStrategy`, `JwtRefreshStrategy` |
| `ForbiddenException` | 403 | `AuthService` (no roles), `AccessGuard` (RBAC) |
| `NotFoundException` | 404 | All CRUD services (`findOne`, `update`, `remove`) |
| `ConflictException` | 409 | `UserService`, `EnterpriseService`, `AppService`, `UserRoleMapService` |

**Not used but available:** `InternalServerErrorException` (500), `NotImplementedException` (501), `BadGatewayException` (502), `ServiceUnavailableException` (503), `GatewayTimeoutException` (504), `HttpException` (custom status).

---

## 6. What Is Missing for Production

| # | Gap | Risk Level | Description |
|---|---|---|---|
| 1 | **No catch-all filter** | 🔴 Critical | `@Catch(HttpException)` misses `TypeError`, `QueryFailedError`, etc. Unhandled errors leak raw stack traces. |
| 2 | **No TypeORM error mapping** | 🔴 Critical | Database constraint violations (unique, FK) surface as raw 500 errors instead of meaningful 409/400. |
| 3 | **No correlation / request ID** | 🟡 High | Cannot trace a user-facing error to server logs. Debugging in production is nearly impossible. |
| 4 | **No structured logging** | 🟡 High | `Logger` writes text. Production needs JSON logs for log aggregation (ELK, Datadog, CloudWatch). |
| 5 | **No sensitive data filtering** | 🟡 High | Stack traces and internal details could leak to the client in non-HTTP errors. |
| 6 | **No standardized error codes** | 🟡 Medium | Frontend relies on string messages for error identification, which is fragile. |
| 7 | **No rate limiting / throttle errors** | 🟡 Medium | No `429 Too Many Requests` protection. |
| 8 | **Inconsistent response envelope** | 🟢 Low | Success = `{ success, data }`, Error = `{ statusCode, error }`. Should be unified. |
| 9 | **No global unhandled rejection handler** | 🟡 High | Unhandled promise rejections can crash the process. |
| 10 | **No health check / readiness probe** | 🟢 Low | No endpoint for load balancers to know if app is healthy. |

---

## 7. Production Best Practices & Recommendations

### 7.1 Catch ALL Exceptions (Not Just HttpException)

The single most important change. Replace `@Catch(HttpException)` with `@Catch()` to catch **everything**:

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'An unexpected error occurred';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      // Known HTTP exceptions — use their status + message
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      message = typeof exResponse === 'object' && 'message' in exResponse
        ? (exResponse as any).message
        : exception.message;
      error = typeof exResponse === 'object' && 'error' in exResponse
        ? (exResponse as any).error
        : HttpStatus[status];
    } else if (exception instanceof QueryFailedError) {
      // TypeORM database errors → map to appropriate status
      // (see section 7.6)
    } else {
      // Unknown errors — NEVER expose internals to client
      this.logger.error('Unhandled exception', (exception as Error)?.stack);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error,
    });
  }
}
```

---

### 7.2 Custom Business Exception Classes

Instead of relying solely on NestJS's generic exceptions, create domain-specific exceptions for clearer semantics and error codes:

```typescript
// src/common/exceptions/business.exception.ts
export class BusinessException extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ errorCode, message, statusCode: status }, status);
  }
}

// Usage:
throw new BusinessException('AUTH_OTP_EXPIRED', 'OTP has expired', HttpStatus.BAD_REQUEST);
throw new BusinessException('USER_DUPLICATE_EMAIL', 'Email already exists', HttpStatus.CONFLICT);
```

This allows the frontend to switch on `errorCode` instead of parsing message strings.

---

### 7.3 Request-Scoped Correlation IDs

Add a middleware to stamp every request with a unique ID, then include it in logs and error responses:

```typescript
// src/common/middleware/correlation-id.middleware.ts
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    req['correlationId'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
```

Then include it in your error response:
```json
{
  "success": false,
  "statusCode": 500,
  "correlationId": "d4e5f6a7-b8c9-1234-5678-9abcdef01234",
  "message": "An unexpected error occurred",
  "error": "Internal Server Error"
}
```

A user can send you the `correlationId` → you grep your logs → instant context.

---

### 7.4 Structured Logging

Replace `Logger` text output with structured JSON for production. Use a library like **winston** or **pino**:

```typescript
// Example with @nestjs/pino
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            correlationId: req.correlationId,
          }),
        },
      },
    }),
  ],
})
```

**Why it matters:** Log aggregation platforms (ELK, Datadog, CloudWatch) parse JSON logs automatically. Text logs require custom parsing rules.

---

### 7.5 Sensitive Data Sanitization

**Current risk:** If a `TypeError` is thrown inside a service, the default NestJS handler sends the raw error message (and potentially stack trace) to the client.

**Recommendation:**
- In production, NEVER send `exception.stack` or raw error messages for non-HTTP exceptions.
- Sanitize known sensitive fields from logs (passwords, tokens, OTPs).

```typescript
// In your exception filter:
if (process.env.NODE_ENV === 'production' && !(exception instanceof HttpException)) {
  message = 'An internal server error occurred. Please try again later.';
  // Log the real error privately
  this.logger.error(`[${correlationId}] ${(exception as Error).message}`, (exception as Error).stack);
}
```

---

### 7.6 Global Database / TypeORM Error Handling

TypeORM throws `QueryFailedError` when database constraints are violated. Currently, these are **not caught** by the `HttpExceptionFilter` (because they're not `HttpException` subclasses).

**Map common PostgreSQL error codes:**

```typescript
import { QueryFailedError } from 'typeorm';

// Inside your catch-all filter:
if (exception instanceof QueryFailedError) {
  const pgError = exception as any;
  
  switch (pgError.code) {
    case '23505': // unique_violation
      status = HttpStatus.CONFLICT;
      message = 'A record with the given value already exists.';
      error = 'Conflict';
      break;
    case '23503': // foreign_key_violation
      status = HttpStatus.BAD_REQUEST;
      message = 'Referenced record does not exist.';
      error = 'Bad Request';
      break;
    case '23502': // not_null_violation
      status = HttpStatus.BAD_REQUEST;
      message = 'A required field is missing.';
      error = 'Bad Request';
      break;
    default:
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'A database error occurred.';
      error = 'Internal Server Error';
  }
}
```

**Common PostgreSQL error codes to handle:**

| PG Code | Name | Suggested HTTP Status |
|---|---|---|
| `23505` | `unique_violation` | 409 Conflict |
| `23503` | `foreign_key_violation` | 400 Bad Request |
| `23502` | `not_null_violation` | 400 Bad Request |
| `23514` | `check_violation` | 400 Bad Request |
| `22P02` | `invalid_text_representation` | 400 Bad Request |
| `42703` | `undefined_column` | 500 Internal Server Error |
| `42P01` | `undefined_table` | 500 Internal Server Error |

---

### 7.7 Rate Limiting & Throttling Errors

Install `@nestjs/throttler` to protect against brute-force attacks and API abuse:

```bash
npm install @nestjs/throttler
```

```typescript
// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,   // 60 seconds
      limit: 100,   // 100 requests per minute
    }]),
  ],
  providers: [{
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  }],
})
```

This automatically returns `429 Too Many Requests` when the limit is exceeded.

**Targeted rate limiting** for auth endpoints:
```typescript
@Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
@Post('login')
login(@Body() loginDto: LoginDto) { ... }
```

---

### 7.8 Health Checks & Graceful Shutdown

```bash
npm install @nestjs/terminus
```

```typescript
// src/modules/health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }
}
```

**Graceful shutdown** in `main.ts`:
```typescript
app.enableShutdownHooks();

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
```

---

### 7.9 Error Monitoring & Alerting

Integrate an error tracking service like **Sentry**, **Datadog**, or **New Relic**:

```bash
npm install @sentry/nestjs @sentry/profiling-node
```

```typescript
// In your exception filter:
import * as Sentry from '@sentry/nestjs';

catch(exception: unknown, host: ArgumentsHost) {
  if (!(exception instanceof HttpException) || exception.getStatus() >= 500) {
    Sentry.captureException(exception, {
      extra: {
        path: request.url,
        method: request.method,
        correlationId: request['correlationId'],
        userId: request.user?.userId,
      },
    });
  }
  // ... rest of error handling
}
```

---

### 7.10 Standardized Error Code Catalog

Define a central catalog so the frontend can programmatically handle errors:

```typescript
// src/common/constants/error-codes.ts
export const ErrorCodes = {
  // Authentication (AUTH_xxx)
  AUTH_INVALID_CREDENTIALS: 'AUTH_001',
  AUTH_ACCOUNT_INACTIVE: 'AUTH_002',
  AUTH_SESSION_EXPIRED: 'AUTH_003',
  AUTH_INVALID_REFRESH_TOKEN: 'AUTH_004',
  AUTH_OTP_EXPIRED: 'AUTH_005',
  AUTH_OTP_MAX_ATTEMPTS: 'AUTH_006',
  AUTH_OTP_INVALID: 'AUTH_007',

  // Authorization (AUTHZ_xxx)
  AUTHZ_NO_ROLES: 'AUTHZ_001',
  AUTHZ_NO_APP_ACCESS: 'AUTHZ_002',
  AUTHZ_PERMISSION_DENIED: 'AUTHZ_003',

  // Resource (RES_xxx)
  RES_NOT_FOUND: 'RES_001',
  RES_ALREADY_EXISTS: 'RES_002',

  // Validation (VAL_xxx)
  VAL_INVALID_INPUT: 'VAL_001',
  VAL_INVALID_UUID: 'VAL_002',

  // System (SYS_xxx)
  SYS_INTERNAL_ERROR: 'SYS_001',
  SYS_DATABASE_ERROR: 'SYS_002',
  SYS_RATE_LIMITED: 'SYS_003',
} as const;
```

Include the code in every error response:
```json
{
  "success": false,
  "statusCode": 401,
  "errorCode": "AUTH_001",
  "correlationId": "abc-123",
  "message": "Invalid email or password",
  "error": "Unauthorized",
  "timestamp": "2026-02-25T17:30:00.000Z",
  "path": "/api/v1/auth/login"
}
```

---

## 8. Recommended Production Exception Filter (Full Code)

Here's a complete, production-ready exception filter incorporating all the recommendations above:

```typescript
// src/common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { QueryFailedError } from 'typeorm';

interface ErrorResponse {
  success: false;
  statusCode: number;
  errorCode?: string;
  correlationId?: string;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = request['correlationId'] || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'An unexpected error occurred';
    let error = 'Internal Server Error';
    let errorCode: string | undefined;

    // ─── 1. HttpException (NestJS built-in + custom) ───────────────────
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      message =
        typeof exResponse === 'object' && 'message' in exResponse
          ? (exResponse as any).message
          : exception.message;

      error =
        typeof exResponse === 'object' && 'error' in exResponse
          ? (exResponse as any).error
          : HttpStatus[status] || 'Error';

      errorCode =
        typeof exResponse === 'object' && 'errorCode' in exResponse
          ? (exResponse as any).errorCode
          : undefined;
    }

    // ─── 2. TypeORM QueryFailedError ───────────────────────────────────
    else if (exception instanceof QueryFailedError) {
      const pgError = exception as any;
      this.logger.error(
        `[${correlationId}] Database error [${pgError.code}]: ${pgError.message}`,
        pgError.stack,
      );

      switch (pgError.code) {
        case '23505':
          status = HttpStatus.CONFLICT;
          message = 'A record with the given value already exists.';
          error = 'Conflict';
          errorCode = 'SYS_DB_UNIQUE';
          break;
        case '23503':
          status = HttpStatus.BAD_REQUEST;
          message = 'Referenced record does not exist.';
          error = 'Bad Request';
          errorCode = 'SYS_DB_FK';
          break;
        default:
          message = this.isProduction
            ? 'A database error occurred.'
            : pgError.message;
          errorCode = 'SYS_DB_ERROR';
      }
    }

    // ─── 3. Everything else (TypeError, RangeError, etc.) ──────────────
    else {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `[${correlationId}] Unhandled exception: ${err.message}`,
        err.stack,
      );
      message = this.isProduction
        ? 'An internal server error occurred. Please try again later.'
        : err.message;
    }

    // ─── Log the error ─────────────────────────────────────────────────
    if (exception instanceof HttpException) {
      this.logger.error(
        `[${correlationId}] HTTP ${status}: ${JSON.stringify(message)} — ${request.method} ${request.url}`,
        exception.stack,
      );
    }

    // ─── Send response ─────────────────────────────────────────────────
    const errorResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      ...(errorCode && { errorCode }),
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
    };

    response.status(status).json(errorResponse);
  }
}
```

**Register it in `main.ts`:**
```typescript
app.useGlobalFilters(new AllExceptionsFilter());
```

---

## 9. Summary Checklist

| # | Practice | Current Status | Priority |
|---|---|---|---|
| 1 | Catch-all exception filter (`@Catch()`) | ❌ Only `@Catch(HttpException)` | 🔴 P0 |
| 2 | TypeORM / DB error mapping | ❌ Not implemented | 🔴 P0 |
| 3 | Correlation IDs on requests | ❌ Not implemented | 🔴 P0 |
| 4 | Structured JSON logging (pino/winston) | ❌ Text-based `Logger` | 🟡 P1 |
| 5 | Sensitive data sanitization | ❌ Stack traces can leak | 🟡 P1 |
| 6 | Unified response envelope (success + error) | ⚠ Partially done | 🟡 P1 |
| 7 | Error code catalog | ❌ Not implemented | 🟡 P1 |
| 8 | Custom business exception classes | ❌ Using generic NestJS exceptions | 🟢 P2 |
| 9 | Rate limiting (`@nestjs/throttler`) | ❌ Not implemented | 🟡 P1 |
| 10 | Error monitoring (Sentry/Datadog) | ❌ Not implemented | 🟡 P1 |
| 11 | Health check endpoint | ❌ Not implemented | 🟢 P2 |
| 12 | Graceful shutdown hooks | ❌ Not implemented | 🟢 P2 |
| 13 | Unhandled rejection / uncaught exception handlers | ❌ Not implemented | 🟡 P1 |
| 14 | DTO validation with `class-validator` | ✅ Done | ✅ |
| 15 | Global `ValidationPipe` | ✅ Done | ✅ |
| 16 | Auth guards (`JwtAuthGuard`, `JwtRefreshAuthGuard`) | ✅ Done | ✅ |
| 17 | RBAC guard (`AccessGuard`) | ✅ Done | ✅ |
| 18 | Business-level exceptions in services | ✅ Done | ✅ |
| 19 | `TransformInterceptor` for success responses | ✅ Done | ✅ |
| 20 | `ParseUUIDPipe` for param validation | ✅ Done | ✅ |

---

> **Bottom line:** The project has a solid foundation — DTO validation, auth guards, RBAC enforcement, and a consistent exception filter are all in place. The main gap is that the filter only catches `HttpException`, leaving TypeORM errors, runtime errors, and other edge cases unhandled in production. Implementing a catch-all filter with correlation IDs, TypeORM error mapping, and structured logging will make this production-ready.
