# PRD: Platform Admin — Plans Management

**Date:** 2026-05-28
**Status:** Shipped
**Scope:** Backend (plan DTO + repository) + Frontend (Platform Plans page)

---

## Problem

Pricing plans existed in the database but could only be created/updated via direct Postman calls. There was no UI for the platform admin to manage plans, and the `Plan` entity was missing several fields that the DTO didn't expose (price per employee annual, annual discount, tier rank, billing cycle). Additionally, plans were always filtered to `ACTIVE` only, meaning inactive plans could never be seen or toggled from the UI.

---

## Solution

### Core Idea

Add a **Plans** L1 page to the platform admin UI that wraps the existing `/plans` endpoints — no new backend routes or tables. The existing `GET /plans` endpoint is already `@Public()`, so plans created here automatically appear on the customer-facing website. Platform admins see all non-deleted plans; public callers see only active ones.

---

## Backend Changes

### DTO (`plan.dto.ts`)

Added the following fields to both `CreatePlanDto` and `UpdatePlanDto` — previously missing, causing `400 Bad Request` with `forbidNonWhitelisted: true` when sent from the frontend:

| Field                       | Type             | Decorator            |
|-----------------------------|------------------|----------------------|
| `price_per_employee_annual` | `number`         | `@IsNumber @Min(0) @IsOptional` |
| `annual_discount_percent`   | `number`         | `@IsNumber @Min(0) @IsOptional` |
| `tier_rank`                 | `number`         | `@IsNumber @Min(0) @IsOptional` |
| `billing_cycle_default`     | `BillingCycle` enum | `@IsEnum @IsOptional` |
| `status`                    | `Status` enum    | `@IsEnum @IsOptional` |

Both enums imported directly: `BillingCycle` from `plan.entity`, `Status` from `common/enums`.

### Repository (`plan.repository.ts`)

`findAll()` previously always filtered to `status = ACTIVE`. Updated signature:

```ts
async findAll(isPlatformAdmin = false): Promise<Plan[]>
```

- `isPlatformAdmin = true` → `where: { status: Not(Status.DELETED) }` (includes INACTIVE)
- `isPlatformAdmin = false` (default, public) → `where: { status: Status.ACTIVE }` (unchanged)

### Service (`plan.service.ts`)

`findAll(user?)` now passes `user?.isPlatformAdmin ?? false` to the repository:

```ts
async findAll(user?: LoggedInUser): Promise<Plan[]> {
  return this.planRepository.findAll(user?.isPlatformAdmin ?? false);
}
```

The controller's `GET /plans` already passes `@LoggedInUser()` — no controller changes needed. The `@Public()` decorator on `GET /plans` means unauthenticated calls still pass through; the `user` will be `undefined`, defaulting to public behaviour.

---

## Frontend

### Feature Files (`brello_webapp/src/features/platform/plans/`)

| File               | Purpose                                            |
|--------------------|----------------------------------------------------|
| `types.ts`         | `Plan` type, `BillingCycle` enum, request types    |
| `api.ts`           | CRUD against `/plans` (`getPlans`, `createPlan`, `updatePlan`, `deletePlan`) |
| `hooks.ts`         | `usePlansList`, `useCreatePlan`, `useUpdatePlan`, `useDeletePlan` |
| `PlanFormModal.tsx`| RHF drawer (position=right) with all plan fields + feature list manager |

### Page (`brello_webapp/src/pages/platform/PlatformPlansPage.tsx`)

- **Card grid layout** — responsive `auto-fill minmax(300px, 1fr)`
- Each card shows: tier badge (color-coded), plan name, monthly/annual price, discount badges, feature checklist, status badge, billing cycle
- Edit (pencil) and Delete (trash) icon buttons on each card
- Search bar filters by plan name (client-side)
- Empty state: `NoDataFound` with "Create Plan" button
- Single `PlanFormModal` + `WarningModal` rendered once at bottom (no `key` prop)

### Form Modal Fields

| Field                     | Input type          | Notes                                     |
|---------------------------|---------------------|-------------------------------------------|
| Name                      | Text input          | Required                                  |
| Monthly Price (₹/emp)     | Number input        | Required                                  |
| Annual Price (₹/emp)      | Number input        | Optional                                  |
| Discount (%)              | Number input        | Optional, 0–100                           |
| Annual Discount (%)       | Number input        | Optional, 0–100                           |
| Tier Rank                 | Number input        | 0=Free, 1=Standard, 2=Premium             |
| Default Billing Cycle     | Select              | `BillingCycle.MONTHLY` / `BillingCycle.ANNUAL` |
| Description               | TextArea            | Optional                                  |
| Features                  | Tag input (Enter)   | Add/remove individual feature strings     |
| Status                    | ToggleButton        | Active / Inactive                         |

### Sidebar & Routing

- `CreditCard` L1 item "Plans" added to `PLATFORM_ADMIN_MENU` (above Setup)
- Route: `/platform/plans` added to `platformAdminLoader` group in `routes/index.tsx`

---

## BillingCycle Enum (Frontend)

```ts
// features/platform/plans/types.ts
export enum BillingCycle {
  MONTHLY = 'Monthly',
  ANNUAL  = 'Annual',
}
```

Matches the backend `BillingCycle` enum in `plan.entity.ts` exactly (same string values).

---

## Data Flow

```
Platform Admin creates plan via /platform/plans page
  → POST /plans (JwtAuthGuard, isPlatformAdmin: true in JWT)
  → Plan saved with is_default = false, status = ACTIVE

Customer website fetches GET /plans (no auth)
  → repository.findAll(isPlatformAdmin=false) → status = ACTIVE only
  → Plans displayed to potential customers

Platform Admin sets plan to INACTIVE via toggle
  → PATCH /plans/:id { status: 'INACTIVE' }
  → Plan hidden from public GET /plans
  → Still visible in platform admin (status != DELETED)
```

---

## Files Changed

| File | Change |
|------|--------|
| `brello_server/src/modules/plan/dto/plan.dto.ts` | Added 5 missing fields to both DTOs |
| `brello_server/src/modules/plan/repositories/plan.repository.ts` | `findAll(isPlatformAdmin)` — conditional status filter |
| `brello_server/src/modules/plan/services/plan.service.ts` | Pass `user?.isPlatformAdmin` to repository |
| `brello_webapp/src/features/platform/plans/types.ts` | `Plan` type, `BillingCycle` enum |
| `brello_webapp/src/features/platform/plans/api.ts` | CRUD helpers |
| `brello_webapp/src/features/platform/plans/hooks.ts` | React Query hooks |
| `brello_webapp/src/features/platform/plans/PlanFormModal.tsx` | Form drawer |
| `brello_webapp/src/pages/platform/PlatformPlansPage.tsx` | Card grid page |
| `brello_webapp/src/pages/platform/PlatformPlansPage.module.scss` | Card styles |
| `brello_webapp/src/features/sidebar/Sidebar.tsx` | Plans L1 item added |
| `brello_webapp/src/routes/index.tsx` | `/platform/plans` route added |
