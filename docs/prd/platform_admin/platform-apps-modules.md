# PRD — Platform Apps & Modules

**Status:** Complete (2026-05-28)  
**Area:** Platform Admin  
**Routes:** `/platform/apps`, `/platform/modules`

---

## Overview

Platform admins define the multi-app architecture — what apps exist (e.g., HRMS, CRM, LMS) and what modules exist within each app. Modules form a two-level tree (MOD → SUBMOD) that drives sidebar navigation and RBAC permission assignment.

---

## Apps

### What it does

- Platform admins create and manage application definitions (`App` entity).
- Each app has a `name`, optional `description`, optional `icon`, and a `priority` (lower = shown first on login).
- Apps are scoped to an enterprise+organization and serve as the container for roles and modules.

### Frontend

**Route:** `/platform/apps` → `PlatformAppsPage`

**Sidebar entry:** "Apps" under the "App & Modules" L1 item (`Boxes` icon)

**Feature files:** `brello_webapp/src/features/platform/apps/`

| File | Purpose |
|------|---------|
| `types.ts` | `PlatformApp`, `AppsResponse`, `CreateAppRequest`, `UpdateAppRequest` |
| `api.ts` | CRUD calls against `GET/POST/PATCH/DELETE /api/v1/apps` |
| `hooks.ts` | `useAppsList`, `useCreateApp`, `useUpdateApp`, `useDeleteApp` |

**Page pattern:**
- `DataTable` with columns: Name, Description, Icon, Priority, Status, Actions
- `TableActions` (pencil + trash) per row
- Single `AppFormModal` instance at bottom (not inside conditional branches — avoids Framer Motion freeze)
- `WarningModal` for delete
- Client-side search, paginated

**Form fields:**

| Field | Type | Notes |
|-------|------|-------|
| Name | text (required) | Must be globally unique |
| Description | text (required) | Short description |
| Icon | text (optional) | Lucide icon name |
| Priority | number (optional) | Default 999, lower = higher priority |

### Backend

- **Entity:** `src/modules/app/entities/app.entity.ts`
- **Controller:** `/api/v1/apps` — guarded by `JwtAuthGuard` + `PlatformAdminGuard`
- **Uniqueness:** `name` has a unique DB index; `409 Conflict` on duplicate

---

## Modules

### What it does

- Platform admins define the module tree for each app.
- Modules are used for sidebar navigation and RBAC permission assignment.
- Two levels only: MOD (top-level) and SUBMOD (child of a MOD).
- WBS codes provide ordering and hierarchy display.

### Frontend

**Route:** `/platform/modules` → `PlatformModulesPage`

**Sidebar entry:** "Modules" under the "App & Modules" L1 item

**Feature files:** `brello_webapp/src/features/platform/appModules/`

| File | Purpose |
|------|---------|
| `types.ts` | `AppModule`, `ModuleTreeNode`, `ModuleType` enum (`MOD='mod'`, `SUBMOD='submod'`) |
| `api.ts` | CRUD calls against `GET/POST/PATCH/DELETE /api/v1/app-modules` |
| `hooks.ts` | `useModulesByApp`, `useCreateModule`, `useUpdateModule`, `useDeleteModule` |
| `ModuleFormModal.tsx` | RHF drawer — all module fields + WBS auto-computation |

**Page design — App pill tabs + tree table:**

- **App selector:** Horizontal pill buttons at the top; clicking a pill loads that app's modules. No dropdown needed.
- **Tree table:** Custom expand/collapse table (not DataTable — DataTable doesn't support tree rows).
  - MOD rows: height 52px, white background, bold module name + child count badge, chevron button to expand/collapse
  - SUBMOD rows: height 46px, subtle primary tint background, indented with CSS tree connector lines
  - Connector lines: `position: absolute; top: 0; bottom: 0` on a div inside a `position: relative` `<td>` — adjacent rows visually merge into a continuous vertical line; last child uses `bottom: 50%` for an L-shape
- **Actions per MOD row:** GitBranch icon button (add sub-module), edit, delete
- **Actions per SUBMOD row:** edit, delete

**WBS auto-computation (`computeNextWbs`):**

Client-side function in `ModuleFormModal.tsx`. Called on modal open (create mode) and on parent module change:
- Root module: `max(existing root wbs numbers) + 1`
- Sub-module: `parent.wbs_code + '.' + (max(sibling last segment numbers) + 1)`

Computed value is editable. Uniqueness is validated client-side against all existing modules in the form's `validate` callback.

**Form fields:**

| Field | Type | Notes |
|-------|------|-------|
| Name | text (required) | Display name |
| Code | text (required) | All-caps, unique per app (e.g., LEAVE_MGMT) |
| WBS Code | text (required) | Auto-computed, editable, unique validated |
| Parent Module | select (create only) | Hidden in edit mode; changes WBS auto-computation |
| Icon | text (optional) | Lucide icon name |
| Path | text (optional) | Navigation path (e.g., /leave/balance) |

> Parent Module is shown only in create mode — changing parentage after creation is not supported via the UI.

**Delete confirmation:**
- MOD: warns that all sub-modules will also be removed
- SUBMOD: standard delete warning

### Backend

- **Entity:** `src/modules/app-module/entities/app-module.entity.ts` — table name `modules`
- **Controller:** `/api/v1/app-modules` — guarded by `JwtAuthGuard`
- **Uniqueness:** `(app_id, code)` composite unique index; `(app_id, wbs_code)` index
- **Soft delete:** `status = 'DELETED'` — physical rows remain

---

## Sidebar Entry

`brello_webapp/src/features/sidebar/Sidebar.tsx` — `PLATFORM_ADMIN_MENU`:

```
App & Modules  (Boxes icon)
  ├── Apps     → /platform/apps
  └── Modules  → /platform/modules
```

Added after the existing Plans entry.

---

## Key Design Decisions

1. **Separate pages for Apps and Modules** — keeping them separate avoids a complex combined view where selecting an app and editing it would conflict with module editing UX.
2. **Pill tabs for app selection on Modules page** — cleaner than a dropdown for a small number of apps (typically 1–5). Auto-selects the first app on load.
3. **Custom tree table, not DataTable** — TanStack Table's `DataTable` component uses `getCoreRowModel` and `getPaginationRowModel` but not `getExpandedRowModel`. Tree expansion requires a custom table with manual expand/collapse state.
4. **WBS auto-computation is client-side** — avoids a round-trip to the server and gives instant feedback. The user can always override the computed value.
5. **`featureInput` in RHF form state** — `PlanFormModal` stores the feature tag input inside React Hook Form (`setValue/useWatch`) rather than `useState`, to avoid the `react-hooks/set-state-in-effect` lint rule when resetting on modal open.
