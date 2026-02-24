# Brello HRMS — Architecture Guide

> **Last updated:** February 2026
> A comprehensive guide for new developers joining the team.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Module Layering Pattern](#module-layering-pattern)
5. [Multi-Tenancy Model](#multi-tenancy-model)
6. [Multi-App Architecture](#multi-app-architecture)
7. [Database Connection](#database-connection)
8. [Configuration System (YAML Properties)](#configuration-system-yaml-properties)
9. [Authentication System](#authentication-system)
10. [RBAC (Role-Based Access Control)](#rbac-role-based-access-control)
11. [Plan & Subscription System](#plan--subscription-system)
12. [Global Middleware Stack](#global-middleware-stack)
13. [API Endpoints](#api-endpoints)
14. [Getting Started (New Developer Setup)](#getting-started-new-developer-setup)
15. [Key Design Patterns](#key-design-patterns)
16. [Important Conventions](#important-conventions)

---

## Overview

**Brello Server** is a **multi-tenant, multi-app HRMS (Human Resource Management System)** backend built with **NestJS v11**. It provides authentication, role-based access control, subscription plan management, and a modular feature architecture that supports multiple applications (HRMS, CRM, LMS, etc.) under a single platform.

The project follows a **modular monolith** architecture — each business domain is encapsulated in its own NestJS module with clear boundaries and dependencies.

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **NestJS** | v11 | Backend framework |
| **TypeScript** | v5.7+ | Language (ES2023 target) |
| **TypeORM** | v0.3 | ORM / Database access |
| **PostgreSQL** | v14+ | Primary database |
| **Passport.js** | v0.7 | Authentication strategies |
| **JWT** (`@nestjs/jwt`) | v11 | Access & refresh tokens |
| **bcrypt** | v6 | Password hashing |
| **class-validator** | v0.14 | DTO validation |
| **class-transformer** | v0.5 | DTO transformation |
| **js-yaml** | — | YAML config file loading |
| **Node.js** | v24+ | Runtime (**required**) |

---

## Project Structure

```
brello_server/
├── src/
│   ├── main.ts                          ← App bootstrap, global pipes/filters/interceptors
│   ├── app.module.ts                    ← Root module — wires everything together
│   ├── app.service.ts
│   │
│   ├── config/
│   │   └── database.config.ts           ← TypeORM DB connection factory (reads from YAML)
│   │
│   ├── common/                          ← Shared utilities (cross-cutting concerns)
│   │   ├── entities/
│   │   │   └── base.entity.ts           ← Abstract base entity (id, status, timestamps, audit)
│   │   ├── enums/
│   │   │   ├── status.enum.ts           ← ACTIVE, INACTIVE, DELETED, PENDING, ARCHIVED
│   │   │   └── otp-purpose.enum.ts      ← LOGIN, RESET_PASSWORD, VERIFY_EMAIL, etc.
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts← @CurrentUser() param decorator
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts ← Global error response formatting
│   │   └── interceptors/
│   │       └── transform.interceptor.ts ← Global success response wrapping
│   │
│   ├── core/                            ← Framework-level infrastructure
│   │   ├── db/postgres/
│   │   │   └── postgres.db.service.ts   ← Alternative TypeORM config (YAML-based factory)
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts        ← Validates Bearer JWT token
│   │   │   ├── access.guard.ts          ← RBAC permission enforcement
│   │   │   └── require-permission.decorator.ts ← @RequirePermission() metadata
│   │   └── properties/
│   │       ├── properties.module.ts     ← Loads YAML config globally
│   │       ├── properties.yaml.ts       ← YAML file reader
│   │       ├── dev.properties.yaml      ← Development config (DB, JWT, ports, etc.)
│   │       └── sample.properties.yaml   ← Template for new environments
│   │
│   └── modules/                         ← Feature modules (business logic)
│       ├── enterprise/                  ← Top-level tenant
│       ├── organization/                ← Second-level tenant (under Enterprise)
│       ├── user/                        ← User management
│       ├── auth/                        ← Authentication (JWT, sessions, OTP, passwords)
│       ├── app/                         ← Multi-app registry (HRMS, CRM, LMS, etc.)
│       ├── rbac/                        ← Role-Based Access Control engine
│       └── plan/                        ← Subscription plans & feature gating
│
├── .env.example                         ← Legacy reference (config now uses YAML)
├── nest-cli.json                        ← NestJS CLI config (asset copying for YAML)
├── tsconfig.json                        ← TypeScript compiler options
└── package.json                         ← Dependencies & scripts
```

---

## Module Layering Pattern

Every feature module follows a consistent **Controller → Service → Repository → Entity** layered pattern:

```
modules/<feature>/
├── <feature>.module.ts        ← NestJS module declaration (imports, providers, exports)
├── controllers/               ← HTTP route handlers (thin — delegates to service)
├── services/                  ← Business logic (validation, orchestration)
├── repositories/              ← Data access layer (TypeORM queries)
├── entities/                  ← TypeORM entity definitions (@Entity)
├── dto/                       ← Request/response DTOs with class-validator decorators
├── interfaces/                ← TypeScript interfaces/types
├── guards/                    ← Module-specific route guards
├── strategies/                ← Passport authentication strategies (auth module only)
└── tasks/                     ← Scheduled/cron tasks (auth module only)
```

### Key principle

- **Controllers** should be thin — only handle HTTP concerns (status codes, decorators).
- **Services** contain all business logic, validations, and orchestration.
- **Repositories** abstract TypeORM queries — services never directly use `Repository<Entity>`.
- **Entities** define the database schema and relationships.

---

## Multi-Tenancy Model

The system has a **3-level tenant hierarchy**:

```
Enterprise (top-level tenant / company)
  └── Organization (business unit / branch within an enterprise)
       └── User (belongs to both Enterprise and Organization)
```

### BaseEntity

Most entities extend `BaseEntity` (`src/common/entities/base.entity.ts`) which provides:

| Field | Type | Purpose |
|---|---|---|
| `id` | UUID v4 | Primary key (auto-generated) |
| `enterprise_id` | UUID | Multi-tenant: which enterprise owns this record |
| `organization_id` | UUID | Multi-tenant: which organization owns this record |
| `status` | Enum | Lifecycle management: `ACTIVE`, `INACTIVE`, `DELETED`, `PENDING`, `ARCHIVED` |
| `code` | varchar(50) | Human-readable code / alternative identifier |
| `description` | text | Free-text description |
| `created_at` | timestamp | Auto-set by TypeORM |
| `updated_at` | timestamp | Auto-updated by TypeORM |
| `modified_by` | UUID | Audit trail: who last modified |

> **Note:** The system uses **soft deletion** (setting `status = 'DELETED'`) — records are never physically removed from the database.

---

## Multi-App Architecture

The platform supports **multiple applications** (e.g., HRMS, CRM, LMS) under one umbrella:

- **`App` entity** — Registers each application with a `name` and `priority`.
- **Roles are scoped per app** — A `Role` belongs to exactly one `App`.
- **JWT tokens are app-scoped** — The JWT payload includes `appId` alongside `organizationId` and `enterpriseId`.
- **Users can switch apps** at runtime via `POST /api/v1/auth/switch-app`, receiving a new JWT scoped to the target app.

### How default app is chosen at login

1. If a user has a `last_access_app_id` and still has active roles in that app → use it.
2. Otherwise → use the app with the lowest `priority` number (highest priority).

---

## Database Connection

### PostgreSQL via TypeORM

The database connection is configured in `src/config/database.config.ts` as a factory function that receives `ConfigService` (loaded from YAML properties):

```typescript
// src/config/database.config.ts
export const databaseConfigFactory = (config: ConfigService): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: config.get<string>('db.postgres.HOST', 'localhost'),
    port: config.get<number>('db.postgres.PORT', 5432),
    username: config.get<string>('db.postgres.DB_USER', 'postgres'),
    password: config.get<string>('db.postgres.DB_PASSWORD'),
    database: config.get<string>('db.postgres.DB_NAME', 'brello'),
    schema: config.get<string>('db.postgres.DB_SCHEMA', 'brello'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: config.get<string>('brello.environment') === 'dev',
    logging: config.get<string>('brello.environment') === 'dev',
    // ...
});
```

### Wired in `app.module.ts`

```typescript
TypeOrmModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: databaseConfigFactory,
})
```

### Entity auto-discovery

TypeORM discovers all entities using the glob pattern `**/*.entity{.ts,.js}`. Any file named `*.entity.ts` anywhere under `src/` is auto-registered.

### Schema

The project uses a custom PostgreSQL **schema** named `brello`. This schema must exist in the database before the app starts. See [Getting Started](#getting-started-new-developer-setup).

### Synchronize mode

- `synchronize: true` is enabled **only when `brello.environment` is `'dev'`** — TypeORM will auto-create/update tables.
- **⚠️ Never enable synchronize in production** — it can cause data loss.

---

## Configuration System (YAML Properties)

All application configuration is managed through **YAML property files**, not `.env` files.

### Files

| File | Purpose |
|---|---|
| `src/core/properties/dev.properties.yaml` | **Development config** — contains all settings for local development |
| `src/core/properties/sample.properties.yaml` | **Template** — copy this to create new environment configs |

### Structure

```yaml
http:
  port: 8000                    # Server port
  apiPrefix: 'api/v1'           # Global API prefix

brello:
  environment: 'dev'            # dev | uat | prod

auth:
  JWT_SECRET: <secret>          # Access token signing secret
  JWT_REFRESH_SECRET: <secret>  # Refresh token signing secret
  JWT_ACCESS_EXPIRATION: '15m'  # Access token TTL
  JWT_REFRESH_EXPIRATION: '7d'  # Refresh token TTL
  ENC_KEY: <key>                # Encryption key
  IV: <iv>                      # Initialization vector

session:
  expirationDays: 7             # Session TTL in days

otp:
  expirationMinutes: 10         # OTP validity period
  maxAttempts: 5                # Max failed OTP attempts

db:
  postgres:
    HOST: 'localhost'
    PORT: 5432
    DB_USER: 'postgres'
    DB_PASSWORD: '<password>'
    DB_NAME: 'brello_dev'
    DB_SCHEMA: 'brello'

smtp:
  host: 'smtp.gmail.com'
  port: 587
  secure: false
  user: '<email>'
  password: '<password>'
  from: 'noreply@brello.com'
```

### How it works

1. `PropertiesModule` (global) loads the YAML file via `js-yaml` and registers it into NestJS `ConfigModule`.
2. All services, guards, and strategies access config via `ConfigService.get('path.to.key')`.
3. The YAML file is copied to `dist/` during build via `nest-cli.json` asset configuration.

### Accessing config in code

```typescript
// Inject ConfigService
constructor(private readonly config: ConfigService) {}

// Read values
const dbHost = this.config.get<string>('db.postgres.HOST');
const jwtSecret = this.config.get<string>('auth.JWT_SECRET');
const port = this.config.get<number>('http.port');
```

---

## Authentication System

Located in `src/modules/auth/`.

### Features

| Feature | Implementation |
|---|---|
| **Login** | Email/password → validates → resolves available apps → creates session → JWT tokens |
| **Access Token** | Short-lived (15m), contains `userId, sessionId, orgId, enterpriseId, appId` |
| **Refresh Token** | Long-lived (7d), separate Passport strategy (`jwt-refresh`) |
| **Token Rotation** | On refresh, old token is invalidated and new one is issued |
| **Session Management** | `Session` entity tracks active sessions with expiration |
| **Switch App** | `POST /auth/switch-app` — issues new JWT scoped to a different app |
| **Password Update** | Requires current password, invalidates all sessions |
| **Forgot Password** | OTP-based flow: generate OTP → verify OTP → reset password |
| **OTP Cleanup** | Cron job runs hourly to purge expired OTPs |
| **Session Cleanup** | Cron job runs daily at midnight to purge expired sessions |

### JWT Payload Structure

```typescript
interface JwtPayload {
    userId: string;           // maps to users.id
    sessionId: string;        // for session management
    organizationId: string;   // which org the user is acting within
    enterpriseId: string;     // which enterprise they belong to
    appId: string;            // which app is currently active
    refreshToken?: string;    // only in refresh tokens
}
```

> **Security note:** No roles are stored in the JWT. Roles are resolved at runtime by `PermissionResolverService` using `userId + organizationId + appId`.

### Guards

```typescript
// Protect a route with JWT authentication
@UseGuards(JwtAuthGuard)

// Protect with JWT + RBAC permission check
@UseGuards(JwtAuthGuard, AccessGuard)
@RequirePermission('LEAVE_MGMT', 'create')

// Access the current user
@CurrentUser() user: JwtPayload
```

---

## RBAC (Role-Based Access Control)

Located in `src/modules/rbac/`. This is the core permission engine.

### Entity Relationships

```
App
 └── Role (belongs to one App)
      └── UserRoleMap (user × role × organization)
      └── ModuleAccess (role × module × action = access_flag)

App
 └── AppModule (hierarchical via WBS codes: 1, 1.1, 1.1.1)
      └── children (self-referencing parent/child tree)

Action (global: view, create, update, delete, approve, export)
```

### Permission Resolution Flow (`PermissionResolverService`)

```
Input: userId, organizationId, appId
                │
                ▼
┌─ Step 1: Fetch active role IDs for user×org×app
│
├─ Step 2: OR-aggregate role-based module_access entries
│           (if ANY role grants access → granted)
│
├─ Step 3: Fetch active subscription plan for the organization
│
├─ Step 4: AND-restrict against plan_module + plan_module_action
│           (plan must ALSO allow it)
│
├─ Step 5: WBS hierarchy propagation
│           (child access ⟹ parent gets 'view')
│
└─ Step 6: Strip modules with no effective actions
                │
                ▼
Output: PermissionResult { permissions, modules, planId }
```

### Formula

```
effective_access = role_grants_access AND plan_allows_action
```

---

## Plan & Subscription System

Located in `src/modules/plan/`. Controls feature gating at the organizational level.

| Entity | Purpose |
|---|---|
| `Plan` | Subscription tiers (Free, Starter, Professional, Enterprise) with pricing |
| `OrganizationSubscription` | Tracks which plan an org subscribes to (active/expired/trial/cancelled) |
| `PlanModule` | Which modules are enabled per plan |
| `PlanModuleAction` | Fine-grained: which actions per module per plan |

**Example:** The "Free" plan might enable the Leave module with `view` action only, while the "Enterprise" plan enables all modules with all actions.

---

## Global Middleware Stack

Applied in `main.ts` before any route handler executes:

| Order | Middleware | Purpose |
|---|---|---|
| 1 | **CORS** | `origin: true, credentials: true` |
| 2 | **ValidationPipe** | Whitelist DTOs, transform types, forbid unknown properties |
| 3 | **HttpExceptionFilter** | Standardize error responses: `{statusCode, timestamp, path, message, error}` |
| 4 | **TransformInterceptor** | Wrap success responses: `{success: true, data, timestamp}` |
| 5 | **Global Prefix** | All routes prefixed with `api/v1` |

### Standardized Response Formats

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

**Error:**
```json
{
  "statusCode": 400,
  "timestamp": "2026-02-24T10:00:00.000Z",
  "path": "/api/v1/users",
  "message": "Validation failed",
  "error": "Bad Request"
}
```

---

## API Endpoints

### Auth (`/api/v1/auth`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/login` | ✗ | Login with email/password |
| POST | `/switch-app` | JWT | Switch active application |
| POST | `/logout` | JWT | Invalidate session |
| POST | `/refresh` | Refresh JWT | Get new access token |
| POST | `/update-password` | JWT | Change password |
| POST | `/forgot-password` | ✗ | Send password reset OTP |
| POST | `/verify-otp` | ✗ | Verify OTP & set new password |

### Enterprise (`/api/v1/enterprises`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Create enterprise |
| GET | `/` | List all enterprises |
| GET | `/:id` | Get enterprise by ID |
| PATCH | `/:id` | Update enterprise |
| DELETE | `/:id` | Delete enterprise |

### Organization (`/api/v1/organizations`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Create organization |
| GET | `/` | List all organizations |
| GET | `/:id` | Get organization by ID |
| GET | `/enterprise/:enterpriseId` | Get orgs by enterprise |
| PATCH | `/:id` | Update organization |
| DELETE | `/:id` | Delete organization |

### User (`/api/v1/users`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Create user |
| GET | `/` | List all users |
| GET | `/:id` | Get user by ID |
| PATCH | `/:id` | Update user |
| DELETE | `/:id` | Delete user |

### Menu (`/api/v1/menu`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | JWT | Get RBAC-resolved menu tree for current user |

---

## Getting Started (New Developer Setup)

### Prerequisites

- **Node.js v24+** (use `nvm use 24`)
- **PostgreSQL v14+** running locally
- **npm** (comes with Node.js)

### Step 1: Clone & Install

```bash
git clone <repo-url>
cd brello_server
nvm use 24
npm install
```

### Step 2: Configure Properties

Copy the sample properties file and fill in your local values:

```bash
cp src/core/properties/sample.properties.yaml src/core/properties/dev.properties.yaml
```

Edit `dev.properties.yaml` with your local PostgreSQL credentials, secrets, etc.

### Step 3: Create PostgreSQL Database & Schema

```sql
-- Connect to PostgreSQL and run:
CREATE DATABASE brello_dev;
\c brello_dev
CREATE SCHEMA IF NOT EXISTS brello;
```

### Step 4: Run

```bash
npm run start:dev
```

The app will:
- Start on **port 8000** (configurable in `dev.properties.yaml`)
- Auto-sync database tables (in dev mode)
- Log SQL queries (in dev mode)
- Be available at `http://localhost:8000/api/v1/`

### Available Scripts

| Script | Command | Purpose |
|---|---|---|
| Dev server | `npm run start:dev` | Watch mode with hot reload |
| Production build | `npm run build` | Compile to `dist/` |
| Production start | `npm run start:prod` | Run compiled JS |
| Lint | `npm run lint` | ESLint + Prettier |
| Format | `npm run format` | Auto-format code |
| Unit tests | `npm run test` | Run Jest tests |
| E2E tests | `npm run test:e2e` | Run end-to-end tests |

---

## Key Design Patterns

| Pattern | Where Used |
|---|---|
| **Module Pattern** | Every feature is a self-contained NestJS module |
| **Repository Pattern** | Data access abstracted from business logic |
| **Strategy Pattern** | Passport JWT strategies (access + refresh) |
| **Factory Pattern** | Database config factory |
| **Decorator Pattern** | `@CurrentUser()`, `@RequirePermission()` |
| **Interceptor Pattern** | Global response transformation, exception filtering |
| **Guard Pattern** | `JwtAuthGuard`, `AccessGuard` for route protection |
| **Template Method** | `BaseEntity` — abstract class inherited by all entities |

---

## Important Conventions

1. **All IDs are UUID v4** — never use auto-increment integers.
2. **Soft deletion only** — set `status = 'DELETED'`, never physically delete records.
3. **No `.env` files for config** — everything goes in YAML property files.
4. **Entities** must be named `*.entity.ts` for TypeORM auto-discovery.
5. **DTOs** must use `class-validator` decorators for input validation.
6. **Controllers should be thin** — delegate all logic to services.
7. **Never store roles/permissions in JWT** — resolve at runtime via `PermissionResolverService`.
8. **Never enable `synchronize: true` in production** — use migrations instead.
9. **Use `@UseGuards(JwtAuthGuard, AccessGuard)` + `@RequirePermission()`** to protect routes with RBAC.
10. **Keep secrets out of git** — `dev.properties.yaml` should be in `.gitignore` (use `sample.properties.yaml` as the committed template).
