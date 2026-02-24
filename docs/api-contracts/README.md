# Brello HRMS — API Contracts

> **Base URL:** `http://localhost:8000/api/v1`
> **Content-Type:** `application/json`

---

## Overview

This folder contains the API contract documentation for the Brello HRMS backend, split by domain module.

| File | Module | Endpoints |
|---|---|---|
| [00-common.md](./00-common.md) | Common conventions | Response format, authentication, error codes |
| [01-auth.md](./01-auth.md) | Auth | Login, Switch App, Refresh, Logout, Passwords, OTP |
| [02-enterprise.md](./02-enterprise.md) | Enterprise | CRUD for top-level tenants |
| [03-organization.md](./03-organization.md) | Organization | CRUD + filter by enterprise |
| [04-user.md](./04-user.md) | User | CRUD for system users |
| [05-menu.md](./05-menu.md) | Menu (RBAC) | Permission-resolved module tree |
| [06-app.md](./06-app.md) | App | CRUD for application definitions |
| [07-role-and-user-role-map.md](./07-role-and-user-role-map.md) | Role & UserRoleMap | Role CRUD + user-role assignments |

## Postman Collection

Import the Postman collection from [`../postman/Brello_HRMS_API.postman_collection.json`](../postman/Brello_HRMS_API.postman_collection.json) for ready-to-use API requests with auto-saved variables.

## Getting Started

See [`../collection-usage/GETTING_STARTED.md`](../collection-usage/GETTING_STARTED.md) for a step-by-step walkthrough of the entire API flow starting from an empty database.
