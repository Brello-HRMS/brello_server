# Letter Template Management — PRD

## Context

Platform admins can create letter templates (with the visual block designer), but org admins have no way to create or manage their own. Templates exist in the backend but APIs lack org-scoping, so all orgs see the same pool. This feature:

1. **Fixes** the org-scoping bug in the backend hr-template module
2. **Adds** a "Letter Templates" page under Organisation for org admins to create/manage their own templates
3. **Integrates** template selection into the New Hire offer letter creation flow
4. **Confirms** the Employee letter flow (already has a template step) works correctly post-fix

---

## Backend — brello_server

### Problem
`letter-template` and `letter-category` controllers/services/repositories have zero org-scoping. Every org sees every template. No `organization_id` is set on create.

### Fix Pattern (mirror department/attendance modules)

**Controller** (`letter-template.controller.ts`, `letter-category.controller.ts`):
- Inject `@LoggedInUser() user: LoggedInUserInterface` into every method
- Pass `user` to service

**Service** (`letter-template.service.ts`, `letter-category.service.ts`):
- Accept `user: LoggedInUserInterface` in all methods
- On `create`: set `organization_id = user.organizationId`, `enterprise_id = user.enterpriseId`, `is_system = false`
- On `update/remove`: verify `organization_id` matches (throw `ForbiddenException` for system templates)
- Pass `organizationId` to repository

**Repository** (`letter-template.repository.ts`, `letter-category.repository.ts`):
- `findAll(orgId, categoryId?)`: `WHERE (organization_id = orgId OR is_system = true) AND is_deleted = false`
- `findById(id, orgId?)`: include org check
- `findOneByOrg(id, orgId)`: strict org match (for update/delete guard)

### Files to Change

```
brello_server/src/modules/hr-template/
├── controllers/
│   ├── letter-category.controller.ts   ← add @LoggedInUser()
│   └── letter-template.controller.ts   ← add @LoggedInUser()
├── services/
│   ├── letter-category.service.ts      ← pass user, org-scope create
│   └── letter-template.service.ts      ← pass user, org-scope create, guard system on mutate
├── repositories/
│   ├── letter-category.repository.ts   ← org-scoped queries
│   └── letter-template.repository.ts   ← org-scoped queries + is_system union
```

No new migrations needed — `organization_id` and `enterprise_id` columns already exist on the entity (inherited from `BaseEntity`).

---

## Frontend — brello_webapp

### 1. New Page: OrgLetterTemplatesPage

**Route**: `organisation/letter-templates`  
**File**: `src/pages/letters/OrgLetterTemplatesPage.tsx` + `.module.scss`  
**ModuleCode**: `OFFER_TEMPLATES` (already in enum)  
**Registration**: `adminRoutes.tsx`

**Layout** (mirrors `PlatformLettersPage`):
- Left sidebar: category list per document type, create/edit/delete org categories
- Right: template cards grid for selected category
- System templates: visible with a "System" badge, no edit/delete buttons
- Org templates: full edit/delete + TemplateDesigner
- Reuses: `TemplateDesigner`, `CategoryFormModal`, `TemplateCard` from `src/features/letters/components/`
- Hooks: `useLetterCategories`, `useLetterTemplates` from `src/features/letters/hooks/`

### 2. Update OfferLetterCreatePage

**File**: `src/pages/letters/OfferLetterCreatePage.tsx`

**Change**: Add a `TemplateSelector` panel above the form sections.

```
┌─ Template (optional) ──────────────────────────────────┐
│  [Select a template ▼]                                  │
└────────────────────────────────────────────────────────┘
┌─ Candidate Information ┐  ┌─ Live Preview ─────────────┐
│  ...form fields...     │  │  [template content with    │
└────────────────────────┘  │   substituted variables]   │
┌─ Compensation ─────────┐  │  or fallback text preview  │
│  ...                   │  └────────────────────────────┘
└────────────────────────┘
```

**Template fetch**: `useLetterTemplates` with `document_type = 'hr_letter'` (catch-all) or allow any category across all types.

**Variable substitution** (new util `src/features/letters/utils/substituteVariables.ts`):
```ts
// Maps template {{variables}} to offer letter form fields
const OFFER_VAR_MAP: Record<string, (f: FormState) => string> = {
  candidate_name:  f => f.candidateName,
  employee_name:   f => f.candidateName,
  designation:     f => f.jobTitle,
  job_title:       f => f.jobTitle,
  department:      f => f.department,
  manager_name:    f => f.reportingManager,
  salary_amount:   f => f.annualCTC ? `₹${Number(f.annualCTC).toLocaleString('en-IN')}` : '',
  joining_date:    f => f.dateOfJoining,
  effective_date:  f => f.effectiveDate,
  date:            _ => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
};
```

**Preview logic** (update `useMemo` in OfferLetterCreatePage):
- If template selected → `substituteOfferVariables(template.content, form)` → pass to `LetterPreview`
- If no template → existing `buildPreviewContent(form)` (unchanged fallback)

**Submit**: Include `template_id: selectedTemplate?.id` in `createOffer()` payload.

**API/hook**:
- `offerLetterApi.ts`: add `template_id?: string` to create payload type
- `useCreateOfferLetter`: pass through (no change needed — it spreads the dto)

### 3. EmployeeLetterCreatePage (verify only)

Already has a Step 4 "Choose Template" that calls `useLetterTemplates`. After the backend org-scoping fix, it will automatically show org + system templates. No code change required unless the category lookup is broken.

---

## Verification

1. **Backend**: Hit `GET /api/v1/letter-templates` with an org user token → should return only that org's templates + system templates.
2. **Create template as org admin**: `POST /api/v1/letter-templates` → record should have `organization_id` set, `is_system = false`.
3. **System template protection**: `DELETE /api/v1/letter-templates/{system_id}` → should return 403.
4. **Frontend**: Navigate to `Organisation → Letter Templates` → see category + template UI.
5. **Offer letter**: Create new hire → select template → verify live preview substitutes form values.
6. **Employee letter**: Create letter → step 4 shows templates → select one → preview renders correctly.
