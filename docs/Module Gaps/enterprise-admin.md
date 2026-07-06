# Module: Enterprise Admin

## 1. Purpose & Current Usage

- There is no functioning module here to describe. `brello_server/src/modules/enterprise-admin/` contains **zero source files** — no entities, no DTOs, no services, no controllers, no repositories, no `*.module.ts`. It is purely an empty directory skeleton:
  - `enterprise-admin/billing/` — empty
  - `enterprise-admin/dashboard/` — empty
  - `enterprise-admin/guards/` — empty
  - `enterprise-admin/organization/` — empty
  - `enterprise-admin/rbac/` — empty, with two further empty subfolders `rbac/controllers/` and `rbac/services/`
- Verified via `find brello_server/src/modules/enterprise-admin -type f` (returns nothing) and `find ... -mindepth 1` (returns only the 7 empty directories listed above, last touched May 26 21:32–21:39, no files ever added since).
- Not registered anywhere: `brello_server/src/app.module.ts` imports 27 other feature modules (lines 5–39) but has no `EnterpriseAdminModule` import at all. A repo-wide `grep -rn "enterprise-admin\|EnterpriseAdmin" brello_server/src` returns no matches outside the empty folder paths themselves.
- Webapp check: `grep -rn "enterprise-admin\|enterpriseAdmin\|EnterpriseAdmin" brello_webapp/src` returns zero hits. No frontend page, API client, or route references this module in any form.
- Conclusion: this is 100% dead scaffolding — a directory structure sketched out (folder names imply intent: a billing view, an admin dashboard, guards, an organization view, and RBAC controllers/services) but never implemented, never wired into the Nest module graph, and never consumed by any client. It does not run, is not compiled into anything (Nest would simply never load it since it's not imported), and poses zero runtime risk — but it is pure clutter in the module tree.

## 2. Intended / Ideal Usage

- Judging only by folder names (`billing`, `dashboard`, `guards`, `organization`, `rbac/controllers`, `rbac/services`), this looks like it was meant to be a **cross-tenant, platform-operator-facing admin surface** — likely the same conceptual space that `platform` and `organization` now occupy, built independently and abandoned before any code landed.
- Compare to what actually exists today:
  - **`platform` module** (`brello_server/src/modules/platform/platform.module.ts`) is the real platform-operator surface: `PlatformDepartmentController`/`PlatformDesignationController` under `/platform-admin/*` routes, guarded by `PlatformAdminGuard` + `JwtAuthGuard` (`platform/controllers/platform-department.controller.ts:20-22`), operating on the shared `Department`/`Designation` entities (owned by the `departments`/`designations` modules) to manage org-agnostic defaults. This is confirmed live and in use per prior audit (Platform Admin Feature: Industry Types, Departments, Designations CRUD).
  - **`organization` module** (`organization/organization.module.ts`) is the per-tenant surface: `OrganizationController` + `OrganizationProfileController`, backed by `Organization`/`OrganizationProfile` entities, `OrganizationService`/`OrganizationProfileService`, wired into `EnterpriseModule`, `DocumentModule`, `IndustryTypeModule`, `AuthModule`, `PlanModule` — this is where a single tenant's own profile/settings/setup lives.
  - **`enterprise-admin`** has none of this. If it had been built out, its `billing/`, `dashboard/`, `rbac/` folders suggest it may have been intended as a superset/parent umbrella for platform-wide billing oversight and RBAC administration — functionality that instead ended up split across the `billing` module (own top-level module, registered `app.module.ts:34`) and the `rbac` module (own top-level module, `app.module.ts:71`/imported as `RbacModule`). In other words, whatever this module was meant to consolidate has already been implemented elsewhere, under different module names, making `enterprise-admin` fully redundant even in concept.
- There is no PRD, README, or design doc referencing `enterprise-admin` anywhere in the repo (`grep -rln "enterprise-admin" --include="*.md" .` returns nothing), so there's no documented "intended usage" to reconcile against — only the folder names themselves as a fossil of original intent.

## 3. Cross-Module Connections

- **Depends on:** nothing — there is no code to import anything.
- **Depends on this module:** nothing — confirmed via repo-wide grep across both `brello_server` and `brello_webapp`; not imported by `app.module.ts` or any other module, not called by the webapp.
- **Missing/expected connections:** none applicable — there's no implementation to connect. The only "expected" thing is a decision: either delete the empty scaffold or actually build the (apparently already-superseded) functionality its folder names imply.

## 4. Gaps

### Structural
- **The entire module is unimplemented scaffolding with unclear, likely-redundant intent.** `enterprise-admin/{billing,dashboard,guards,organization,rbac}` exist as empty directories with no `.module.ts` binding them together and no registration in `app.module.ts:5-39`; meanwhile equivalent responsibilities (billing → `billing` module, RBAC → `rbac` module, platform-level admin CRUD → `platform` module, org profile → `organization` module) are already fully implemented as separate top-level modules. This matters because it creates ambiguity for any developer navigating `src/modules/` — five empty folders sitting next to four working modules that appear to cover the same ground, with no doc explaining the relationship.

### Coding
- **No content to review** — zero lines of TypeScript exist in this module, so there are no bugs, dead code paths, inconsistent patterns, or missing validation to report beyond the module's non-existence itself.

### Technical
- **No test coverage, no observability, no security surface** — none of these concerns apply since nothing executes. The only "technical" issue is that an empty, unregistered module directory sits in the source tree indefinitely with no build-time or lint-time signal calling it out as stale.

## 5. Top 3 Priorities

1. **Delete `brello_server/src/modules/enterprise-admin/` entirely**, or replace it with a short `README.md`/decision record if the folder names represent a real future plan — right now it's indistinguishable from abandoned scaffolding and actively misleads anyone assuming it's a working module.
2. **If the intent behind `billing`/`dashboard`/`rbac`/`organization` subfolders is still valid, reconcile it explicitly against the already-live `platform`, `organization`, `billing`, and `rbac` top-level modules** before writing any code here, since those modules already appear to cover the same conceptual ground — building this out without that reconciliation would create real duplication (unlike today's zero-cost duplication of empty folders).
3. **Lower priority given zero blast radius:** add a lint/CI check (or just a one-time repo hygiene pass) that flags module directories under `src/modules/` with no corresponding entry in `app.module.ts`, so a future "started but abandoned" module like this doesn't sit undetected for months (folders date to May 26, over a month stale as of today).
