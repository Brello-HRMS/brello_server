# PRD — Letter Module (v1)

**Author:** PM + Engineering Lead
**Status:** Draft
**Last Updated:** 2026-07-05

---

## 1. Overview

Admins need to issue official employee letters — offer/appointment, confirmation, experience, relieving, promotion, increment — and employees need to retrieve their own copies on demand. Today this happens outside Brello entirely: HR hand-drafts each letter in Word, retyping employee details from memory or by cross-referencing other screens, and emails a PDF to the employee (or doesn't, until asked).

This PRD defines a **Letter Module**: admins design reusable letter templates once, then generate a specific letter for an existing employee by picking employee + template. The system resolves as many fields as possible from real employee/organization/payroll data, the admin fills in whatever's missing, and the result is a permanent, numbered PDF the employee can view/download from their own "My Letters" page at any time.

The module is designed as one standalone unit that will **also house candidate-facing offer letters later** (a separate, larger submodule — see §14) — not just letters for existing employees. This PRD scopes v1 to the employee-letters half only.

---

## 2. Problem Statement

### Current State
- No letter generation exists in Brello today for real use. A template-CRUD prototype exists (`hr-template` module + `features/letters` UI) but it only manages template *content* — there is no way to generate a letter for a real employee, no PDF pipeline tied to real data, no employee-facing download page, and its "variables" are just regex-extracted placeholder names substituted with hardcoded sample values for preview, never real employee data. It is being retired and rebuilt (see §13).
- Employees have no self-service way to retrieve an experience/relieving/appointment letter — they email HR and wait, often under time pressure (a loan or visa application deadline).
- Nothing prevents copy-paste/retyping errors on what are legally significant documents (wrong CTC figure, wrong designation, wrong date of joining).
- There's no record of what was issued to whom, when, or under what template version — no letter numbering, no audit trail.

### Why Now
Competitors (Zoho People, Keka, Darwinbox, greytHR) all ship this as a baseline feature; its absence is a recurring gap in competitive evaluations. This is a competitive-parity driver, not a single blocked deal — which shapes v1 scope deliberately toward the smallest thing that is *actually useful*, not the fullest possible feature set (see §4).

---

## 3. Goals

1. **Accurate letters, no manual retyping.** Resolve employee/org/payroll fields from real records; the admin only ever fills gaps, never retypes what the system already knows.
2. **Employee self-service.** Employees can view/download any letter ever issued to them, with correct per-employee access control, without asking HR.
3. **Low admin effort, consistent output.** Generating a letter for one employee from an existing template takes under a minute and always looks the same for a given letter type.
4. **Immutable record.** A letter, once generated, never changes — not if the template is edited later, not if the employee's salary changes later. It is a frozen snapshot with a permanent letter number.

---

## 4. Non-Goals (v1)

Deliberately excluded because none are required to hit the goals above, and each is a clean, separable v2 addition once real usage tells us it's wanted:

- Bulk generation (same letter for many employees at once).
- Approval / maker-checker workflow before a letter is finalized.
- Real e-signature integration (DocuSign/Adobe Sign) — v1 uses an uploaded signature image only.
- A freeform/generic block designer (arbitrary tables, images anywhere, rich inline formatting) — v1 uses a fixed content shape (§6).
- Letter revision/reissue (superseding an already-issued letter).
- Multi-language templates.
- Scheduled/automatic generation (e.g. auto-issue on a probation-end date).
- Usage analytics dashboards.
- Candidate-facing offer letters — reserved as a submodule boundary only (§14), built later.

---

## 5. Who Uses This

| Role | Capability |
|---|---|
| Org Admin / authorized HR user | Manage categories, templates, signatories; generate letters for any employee in their org; view/download any generated letter. |
| Employee (any) | View/download only their own generated letters. No creation/edit access. |
| Platform Admin | Manage system-wide (cross-org) starter categories/templates, same shape as org-level ones. |

---

## 6. Scope decision: fixed content model, not a generic designer

Rather than a generic block-based canvas (arbitrary blocks, drag-and-drop, freeform tables/images), a `LetterTemplate` in v1 is a **fixed sequence of purpose-built pieces**. Real HR letters are structurally uniform — a heading, a few paragraphs, occasionally a bulleted list of terms, occasionally a salary table, a signature — so a generic layout engine buys demo flexibility without buying accuracy or speed, the two things that actually matter (Goals 1 and 3). A fixed model is also small enough to build and verify cleanly:

1. **Org header** *(automatic, not configurable per template)* — logo + name + address from `OrganizationProfile`, rendered on every letter with zero admin effort.
2. **Heading** — one line, may contain `{{variables}}`.
3. **Paragraphs** — ordered list of plain-text paragraphs, each may contain `{{variables}}`.
4. **Bullet list** *(optional, zero or more)* — ordered line items, may contain `{{variables}}`. Used for "terms of employment"-style content.
5. **Salary breakdown table** *(optional, single on/off toggle — not a generic table)* — when enabled, auto-renders a two-column table (Component | Amount) sourced directly from the employee's active salary components, plus a bold total (CTC) row. The admin never types a salary figure by hand; this is the single highest-value, lowest-effort piece of the module because it structurally cannot be typo'd.
6. **Signature** *(optional, single)* — one selected `Signatory` (name + designation + uploaded image), rendered as image + name/title.

No standalone image block, no generic/arbitrary table, no drag-and-drop, no rich inline formatting (bold/italic/color). All of that is v2 material if the fixed model proves too rigid in practice.

---

## 7. Module shape

One standalone parent module, `letter-management`, with submodules (the existing empty scaffold directories become real):

- **`templates/`** *(v1, shared)* — `LetterCategory` + `LetterTemplate`, org-level. Deliberately resolver-agnostic: a template only knows `{{variable}}` placeholders + a `variables: string[]` list, with no idea whether values come from an employee or a future candidate. This is what lets the same template infrastructure serve both generation submodules without change.
- **`signatories/`** *(v1, shared)* — `Signatory` (name, designation, signature image), usable by employee letters now and offer letters later.
- **`settings/`** *(v1, shared)* — `LetterSettings`, org-level letter-numbering config.
- **`shared/`** *(v1)* — `LetterPdfBuilderService` (renders a resolved letter into a PDF, agnostic to where the data came from) and `LetterVariableResolverService` (employee-data resolver). A future `OfferCandidateVariableResolverService` produces the same flat `Record<string,string>` shape, so the same PDF builder serves both submodules.
- **`employee-letters/`** *(v1, fully built)* — generation for existing employees; this PRD's scope.
- **`offer-letters/`** *(boundary reserved, built in v2)* — candidate-facing offer letters. Not implemented beyond the folder + module stub in v1. Needs things employee-letters doesn't: a pre-hire candidate record (no `User` exists yet), a public token-based portal to view/accept/reject, revision history, and status tracking (draft/sent/accepted/rejected/expired) — matching the `WizardLayout`/`RevisionDialog`/`ActivityTimeline`/`OfferStatusBadge` component names already scaffolded on the frontend, and the `OFFER_LETTER`/`OFFER_TEMPLATES`/`OFFER_DRAFTS` module codes already reserved in the frontend `ModuleCode` enum.

---

## 8. Data Model

All entities extend `BaseEntity` (`id, enterprise_id, organization_id, status, code, description, created_at, updated_at, modified_by, modified_at, deleted_by, deleted_at`).

**`LetterCategory`** (table `letter_categories`) — `name`, `is_system`, `is_deleted`, `sort_order`.

**`LetterTemplate`** (table `letter_templates`) — `category_id → LetterCategory`, `name`, `is_system`, `is_deleted`, `is_active`, `version` (int, incremented on every content edit), `heading` (text, nullable), `paragraphs` (jsonb `string[]`), `bullet_list` (jsonb `string[]`, nullable), `include_salary_table` (bool, default false), `signatory_id → Signatory` (nullable), `variables` (jsonb `string[]`, auto-extracted from `heading`+`paragraphs`+`bullet_list` via `/\{\{(\w+)\}\}/g`).

**`Signatory`** (table `letter_signatories`) — `name`, `designation`, `signature_document_id → Document` (nullable until uploaded), `is_default`, `is_deleted`.

**`LetterSettings`** (table `letter_settings`, one row per org) — `letter_number_prefix` (defaults to org code), `last_sequence` (int, default 0), `sequence_type` (to allow employee-letters and offer-letters to share or separate sequences without a later migration).

**`EmployeeLetter`** (table `employee_letters`) — the generated/frozen record:
- `employee_id → User`
- `template_id → LetterTemplate`, `template_version` (int snapshot)
- `letter_number` (varchar, unique per org — e.g. `BRLO-2026-000123`)
- `variable_values` (jsonb — resolved + manually-overridden key→value map used)
- `resolved_heading`, `resolved_paragraphs` (jsonb `string[]`), `resolved_bullet_list` (jsonb `string[]`) — frozen post-substitution content; this, not the live template, is what was actually rendered
- `salary_snapshot` (jsonb, nullable — component rows + total, frozen at generation time so a later salary revision never alters an issued letter)
- `signatory_id → Signatory` (nullable)
- `pdf_document_id → Document`
- `generated_by → User`, `generated_at`

Relationships: `LetterCategory 1—* LetterTemplate`, `LetterTemplate 1—* EmployeeLetter`, `User 1—* EmployeeLetter`, `Signatory 1—* EmployeeLetter`, `Document 1—1 EmployeeLetter.pdf_document_id`, `Document 1—1 Signatory.signature_document_id`.

---

## 9. Variable Catalog & Resolver

`LetterVariableResolverService.resolve(employeeId, organizationId)` returns a flat `Record<string, string | null>`:

| Key | Source |
|---|---|
| `employee_name`, `employee_code` | `User.fullName`, `UserProfile.employee_id` |
| `doj`, `dob` | `UserProfile.joining_date`, `.dob` |
| `designation`, `department` | `User.designation.title`, `User.department.name` |
| `reporting_manager` | `User.reports_to.fullName` |
| `employment_type`, `work_location` | `UserProfile.employment_type`, `.work_location` |
| `email`, `phone` | `User.email` / `.phone` |
| `pan` | `UserGovInfo.pan` |
| `ctc` | active `EmployeeSalary.ctc` (latest `effective_from`, `is_active = true`) |
| `organization_name`, `organization_address`, `organization_website`, `organization_registration_no` | `OrganizationProfile` fields |
| `today_date` | generation-time date |
| `signatory_name`, `signatory_designation` | selected `Signatory` |

Individual salary components (basic, HRA, etc.) are **not** exposed as text variables — they only appear via the salary-table piece, resolved directly from `EmployeeSalaryComponent[]`, so a figure that's already structured data never gets manually retyped.

`GET /letter-management/variables/catalog` exposes the key/label list for the template editor's "insert variable" control. Keys with no data for a given employee resolve to `null` — the generation UI flags these as required manual input before a letter can be generated.

---

## 10. PDF Generation

`LetterPdfBuilderService.build(employeeLetter): Promise<Buffer>`, using **PDFKit** (already a dependency, already used for payslips/invoices — `payslip-pdf.service.ts`), not Puppeteer/headless-Chrome, which is unsafe on the current Vercel serverless deployment (binary size, cold starts, memory/timeout limits):

1. Org header (logo + name/address), drawn once.
2. Heading, then each paragraph.
3. Bullet list via PDFKit's built-in `doc.list(...)`.
4. Salary table (if enabled): fixed two-column loop + bold total row — not a generic grid engine.
5. Signature image + name/title (if a signatory was selected).

Storage follows the existing pattern exactly: render to `Buffer` → `StorageService.uploadFile()` → persist as a `Document` (new `FolderType.LETTER_DOCUMENT`) → `EmployeeLetter.pdf_document_id`. Key: `letters/{organizationId}/{employeeId}/{employeeLetterId}.pdf`. Downloads only re-presign via `generatePresignedDownloadUrl()`; the PDF is never re-rendered.

---

## 11. Letter Numbering

Inside the same transaction that creates `EmployeeLetter`: lock the org's `LetterSettings` row (`SELECT ... FOR UPDATE`), increment `last_sequence`, format `"{prefix}-{year}-{sequence, zero-padded to 6}"`.

---

## 12. API Contracts

All under `/letter-management/`. Admin routes: `JwtAuthGuard + AccessGuard` + `@RequirePermission('LETTERS', 'view'|'create'|'update'|'delete')` (new RBAC module code `LETTERS`, registered the same way `OFFER_TEMPLATES` was). Employee routes: bare `JwtAuthGuard`, scoped to `user.userId`.

**Categories** — `GET/POST/PATCH/DELETE /categories`

**Templates** — `GET /templates` (`?category_id=`), `GET/PATCH/DELETE /templates/:id`, `POST /templates`

**Variable catalog** — `GET /variables/catalog`

**Signatories** — `GET/POST/PATCH/DELETE /signatories` (multipart signature image upload, reusing the presigned-upload flow already used for org logo uploads)

**Generate (admin)**
- `POST /employee-letters/resolve` — `{employee_id, template_id}` → `{values, missingKeys[]}` (not persisted)
- `POST /employee-letters` — `{employee_id, template_id, overrides, signatory_id?}` → re-resolves server-side, merges overrides only for missing keys, snapshots salary if enabled, renders PDF, assigns letter number, persists, notifies employee, returns record + signed URL
- `GET /employee-letters` (`?employee_id=&template_id=`) — admin list
- `GET /employee-letters/:id` — admin detail
- `GET /employee-letters/:id/download` — presigned URL

**Employee self-service**
- `GET /my-letters` — current user's own letters only
- `GET /my-letters/:id/download` — 403 if `employee_id !== current user`

---

## 13. Frontend Requirements

New feature `src/features/letter-management/` (`api/`, `hooks/`, `components/`, `columns/`, `types/`, `validation/` — matching the existing `department`/`payroll` feature layout).

### Admin routes (`ModuleCode.LETTERS` gated)

| Route | Page | Key CTAs |
|---|---|---|
| `/organisation/letters` | `LetterCategoriesPage` — category list + template gallery | "+ New Category", "+ New Template", per-card "Edit"/"Duplicate"/"Delete" (blocked for `is_system`) |
| `/organisation/letters/templates/:id` | `LetterTemplateEditorPage` — plain form (heading, ordered paragraphs, bullet list, salary-table toggle, signatory picker, insert-variable, live preview) | "Add Paragraph"/"Add Bullet", "Move up/down"/"Remove" per item, "Insert Variable", "Preview" toggle, "Save Draft", "Publish", "Back" |
| `/organisation/letters/signatories` | `SignatoriesPage` | "+ Add Signatory" (name, designation, image upload), row "Edit"/"Delete"/"Set as default" |
| `/organisation/letters/generate` | `GenerateLetterPage` — 3-step wizard | Step 1 employee select → Step 2 template select → Step 3 review resolved + fill missing fields + pick signatory + preview → "Generate Letter" → "Download PDF"/"Done" |
| `/organisation/letters/generated` | `GeneratedLettersPage` — data table (employee, template/category, letter number, date, generated by) | Row "View", "Download"; filter by employee/template |

### Employee self-service route (no module gate, `reimbursement/me`-style)

| Route | Page | Key CTAs |
|---|---|---|
| `/letters/me` | `MyLettersPage` — list (template, category, date, letter number) | Row "View", "Download" |

Sidebar entries ("Letters" admin, "My Letters" employee) are backend-driven (`GET /menu`) and added via the same migration that registers the `LETTERS` module code.

---

## 14. Offer Letters for New Candidates (v2, reserved boundary only)

Confirmed direction: candidate-facing offer letters are a real, planned part of this Letter Module, but built **after** v1, not alongside it — the two flows differ enough (no `User` record pre-hire, public unauthenticated access, accept/reject, revisions, status tracking) that bundling them into v1 would work against the goal of a small, cleanly-buildable release. v1 only reserves the `offer-letters/` submodule folder and shares `templates`/`signatories`/`shared` infrastructure with it; the candidate portal itself is a future PRD.

---

## 15. Notifications & Audit Logging

- On successful generation: `NotificationService.send(...)` (fire-and-forget, matching the existing `auto-checkout.service.ts` convention) to the employee, in-app + email. New `NotificationEventType.LETTER_GENERATED` enum value, respecting user notification preferences.
- Audit logging via the existing `AuditLog` decorator: template/category CRUD → `AuditLogModule.LETTER_MANAGEMENT` (already reserved); signatory CRUD → `LETTER_SIGNATORY` (already reserved); letter generation → new `EMPLOYEE_LETTER` value (`OFFER_LETTER` is reserved for §14 and doesn't fit this).

---

## 16. Migration & Legacy Cleanup

One idempotent SQL file `docs/migrations/<date>-letter-management-module.sql` (`IF NOT EXISTS`/`ON CONFLICT`, matching `2026-06-19-letter-templates-module.sql`):
- Registers the `LETTERS` RBAC module + actions, sidebar entries for `/organisation/letters/*` and `/letters/me`.
- Seeds starter categories/templates (Offer, Appointment, Confirmation, Experience, Relieving, Promotion, Increment) in the new fixed-shape format.
- Drops the old `letter_categories`/`letter_templates` tables and recreates under the new schema (confirm no real customer data needs preserving before running against a live environment).

Retire the existing prototype in the same effort:
- Backend: remove `HrTemplateModule` from `app.module.ts`, delete `src/modules/hr-template/`, replace the `platform-letter-*` controllers/services in `src/modules/platform/` with equivalents against the new entities.
- Frontend: delete `src/features/letters/`, `src/pages/letters/OrgLetterTemplatesPage.tsx`, `src/pages/platform/PlatformLettersPage.tsx`; remove the old routes; add the new ones (§13).

---

## 17. Verification Plan

- Unit test `LetterVariableResolverService` against a seeded employee (known fields resolve; fields with no data return `null`).
- Unit test `LetterPdfBuilderService` produces a valid, non-empty PDF for a template exercising every piece (heading, paragraphs, bullet list, salary table, signature).
- Manual end-to-end: create a category + template with a heading, paragraphs (with variables), a bullet list, salary breakdown enabled, and a signatory → run Generate Letter against a seeded employee → confirm auto-resolved fields, fill any missing field, generate → confirm the PDF renders the org header, correct salary figures, and signature image → confirm the employee sees and can download it from `/letters/me` → confirm a different employee gets a 403 on the first employee's download URL.
- Confirm the migration SQL is idempotent (run twice) and that a later salary revision does **not** alter an already-generated letter's PDF or `salary_snapshot`.

---

## 18. Open Questions

- Should `letter_number` sequences be shared across employee-letters and offer-letters (once built) or fully separate per submodule? `LetterSettings.sequence_type` is included now specifically to keep this decision reversible without a schema change later.
- Does any current customer have real data in the existing `letter_categories`/`letter_templates` tables that must be preserved rather than dropped during the rebuild migration?

---

## 19. Success Metrics (Post-Launch)

- % of employee letters issued through the module vs. outside it (target: majority within one quarter of launch).
- Median time from "admin opens Generate Letter" to "PDF downloaded" (target: under 60 seconds).
- Number of employee self-service downloads via `/letters/me` (proxy for reduced HR-ticket volume on letter requests).
- Zero incidents of an already-issued letter's content changing after the fact.
