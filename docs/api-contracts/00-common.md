# Common Conventions

> Applies to all API endpoints.

---

## Base URL

```
http://localhost:8000/api/v1
```

All endpoints are prefixed with `/api/v1`.

---

## Response Format

### ✅ Success Response

All successful responses are wrapped by the `TransformInterceptor`:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

### ❌ Error Response

All errors are formatted by the `HttpExceptionFilter`:

```json
{
  "statusCode": 400,
  "timestamp": "2026-02-24T10:00:00.000Z",
  "path": "/api/v1/users",
  "message": "Validation failed",
  "errorCode": "Bad Request"
}
```

Validation errors return an array of messages:

```json
{
  "statusCode": 400,
  "timestamp": "2026-02-24T10:00:00.000Z",
  "path": "/api/v1/users",
  "message": [
    "First name is required",
    "Email must be a valid email address"
  ],
  "errorCode": "Bad Request"
}
```

---

## Authentication

Protected endpoints require a **Bearer JWT token** in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

The refresh endpoint requires the **refresh token** as a Bearer token instead.

---

## Error Codes Reference

| HTTP Status | Code | Meaning |
|---|---|---|
| `200` | OK | Request succeeded |
| `201` | Created | Resource created successfully |
| `204` | No Content | Request succeeded, no body returned |
| `400` | Bad Request | Validation failed or invalid input |
| `401` | Unauthorized | Missing/invalid/expired token or wrong credentials |
| `403` | Forbidden | Authenticated but lacking permissions |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Duplicate resource (e.g., email already exists) |
| `500` | Internal Server Error | Unexpected server error |

---

## UUID Validation

All `:id` path parameters are validated as UUID v4. Providing a non-UUID string returns:

```json
{
  "statusCode": 400,
  "message": "Validation failed (uuid is expected)",
  "errorCode": "Bad Request"
}
```

---

## JWT Token Lifecycle

```
┌──────────┐     POST /auth/login      ┌────────────────────┐
│  Client   │ ──────────────────────▶  │   access_token     │ (15 min)
│           │                          │   refresh_token     │ (7 days)
│           │ ◀──────────────────────  │   defaultAppId     │
│           │                          │   availableApps     │
└──────────┘                           └────────────────────┘
     │
     │ (access_token expires)
     │
     │     POST /auth/refresh           ┌────────────────────┐
     │ ──────────────────────────────▶  │   new access_token │
     │ (send refresh_token as Bearer)   │   new refresh_token│ (rotation)
     │ ◀──────────────────────────────  └────────────────────┘
     │
     │ (switch application)
     │
     │     POST /auth/switch-app        ┌────────────────────┐
     │ ──────────────────────────────▶  │   new access_token │ (scoped to new app)
     │ (send access_token + appId)      └────────────────────┘
     │ ◀──────────────────────────────
     │
     │     POST /auth/logout
     │ ──────────────────────────────▶  (session invalidated)
     └──────────────────────────────────
```
