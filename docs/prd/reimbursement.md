# Tech PRD — Reimbursement Management System (Webapp)

## Module: Payroll → Reimbursements

---

## Overview

Frontend implementation for reimbursement management. Two views:
- **Admin View**: All company reimbursements, approve/reject/mark-paid via right drawer
- **Employee View**: Own reimbursements, add/edit/delete pending requests

---

## Tech Stack

- React 19 + Vite, TanStack React Table, React Query, React Hook Form + Zod
- Existing: DataTable, Dialog (position=right), Input, Select, DatePicker, Button, PageHeader
- Styling: SCSS modules using variables from `_variables.scss`

---

## Pages

### Admin: /payroll/reimbursements
- PageHeader: "All Reimbursements" + Export button
- ListControls with search (employee name/ID) + date range filter
- DataTable with columns: Employee, Title, Date Range, Deductions, Status, Paid (toggle), Action (edit icon)
- Clicking edit opens right-side Dialog: "Edit Reimbursement Request"
  - Shows employee info at top
  - Title (read-only display), Description (read-only)
  - Expense Date + Amount
  - Attachments list (PDF/image preview + download)
  - Status Management: Request Status dropdown (Approved/Rejected/Pending)
  - Rejection Reason (textarea, shown only if Rejected)
  - Mark as Paid toggle
  - Cancel / Save buttons

### Employee: /payroll/reimbursements/me
- Two states:
  1. Empty state: illustration + "No Reimbursements Added Yet" + Add button
  2. List state: DataTable with columns: Title, Amount, Date, Attachments, Status, Action (3-dot menu)
- Add Reimbursement button (top right)
- Add/Edit Modal: Title*, Description, Date*, Amount*, Attachments* (upload)

---

## Feature Structure

```
src/features/reimbursement/
├── api/
│   └── reimbursementApi.ts
├── types/
│   └── reimbursementTypes.ts
├── hooks/
│   ├── useReimbursement.ts        # Employee hooks
│   └── useAdminReimbursement.ts   # Admin hooks
├── columns/
│   ├── adminReimbursementColumns.tsx
│   └── employeeReimbursementColumns.tsx
├── components/
│   ├── AddReimbursementModal/
│   │   ├── AddReimbursementModal.tsx
│   │   └── AddReimbursementModal.module.scss
│   └── EditReimbursementDrawer/
│       ├── EditReimbursementDrawer.tsx
│       └── EditReimbursementDrawer.module.scss
└── validation/
    └── reimbursementSchema.ts
```

---

## Component Patterns

- All API calls use `apiClient` from `lib/axios` (auto-injects Bearer token)
- Hooks use `useQuery` + `useMutation` from `@tanstack/react-query`
- Forms use `react-hook-form` + `zodResolver`
- Toast notifications via `react-toastify`
- Table columns follow `ColumnDef<T>[]` pattern (TanStack Table)
- Dialog position="right" for drawers (Admin edit panel)
- Dialog position="center" for modals (Add/Edit reimbursement)
- Status badges use inline styles with color variables
- Amount formatted with ₹ prefix using `formatINR` from numberUtils
- File upload uses existing document upload flow (uploadDocumentUrl → uploadDocumentData)

---

## Status Display

| Status   | Style                        |
|----------|------------------------------|
| Approved | green text + green bg badge  |
| Pending  | orange text + orange bg      |
| Rejected | red text + red bg            |

---

## Routes

| Path                            | Component                    | Role     |
|---------------------------------|------------------------------|----------|
| /payroll/reimbursements         | ReimbursementPage            | Admin    |
| /payroll/reimbursements/me      | EmployeeReimbursementPage    | Employee |
