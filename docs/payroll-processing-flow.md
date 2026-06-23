# Payroll Processing — How It Works

A plain-English walkthrough of how a payroll run goes from "create" to "money paid."
Source code lives in `src/modules/payroll`.

---

## The big picture

A payroll run moves through **4 statuses**, in order:

```text
   DRAFT  ───►  PROCESSING  ───►  COMPLETED  ───►  LOCKED
  (build)       (calculate)      (review)        (final)
```

And there are **6 actions** an admin takes along the way:

```text
  1. Create  →  2. Prepare  →  3. Validate  →  4. Process  →  5. Lock  →  6. Disburse
```

Think of it like cooking a meal:
1. **Create** = decide which month you're cooking for
2. **Prepare** = gather all ingredients (employees, attendance, salaries)
3. **Validate** = check nothing is missing before you start
4. **Process** = actually cook (do all the salary math)
5. **Lock** = plate it, no more changes allowed
6. **Disburse** = serve it (mark salaries as paid)

---

## Step 1 — Create the run

**What the admin does:** Picks a month and year (e.g. "June 2026").

**What the system does:**
- Checks there isn't already a run for that month — one run per month, per company.
- Works out the pay period (1st to last day of the month).
- Sets a starting guess for working days (just the number of days in the month).
- Saves the run with status = **DRAFT**.

> At this point the run is just an empty shell. No employees, no numbers yet.

---

## Step 2 — Prepare the run

**What the admin does:** Clicks "Prepare."

**What the system does — for every eligible employee:**
1. Pulls their **attendance** for the month (present days, absent days).
2. Pulls their **leave** for the month (paid leave, unpaid leave).
3. Calculates **Loss of Pay (LOP) days** = absent days + unpaid leave days.
4. Checks the employee has an **active salary structure**:
   - ✅ Has one → mark the employee **PENDING** (ready to process), save a snapshot of their salary.
   - ❌ None → mark the employee **ERROR** ("No active salary structure assigned").
5. If an employee has no attendance data, it still proceeds but adds a **warning**.

> After this step you have one row ("item") per employee, each marked PENDING or ERROR.
> This step is safe to re-run — it just refreshes everything.

---

## Step 3 — Validate (optional check)

**What the admin does:** Opens the validation screen before processing.

**What the system tells them:**
- ✅ **Can process?** Yes, only if there's at least one PENDING employee and **zero** ERROR employees.
- ⚠️ **Heads-up (advisory only):** Lists employees whose attendance is still waiting for approval. This is a warning, not a hard block — companies that don't use attendance approval aren't stuck.

> This step never changes anything. It just answers "are we ready?"

---

## Step 4 — Process (the actual calculation)

**What the admin does:** Clicks "Process."

**What the system does:**
- Flips the run to **PROCESSING** (and blocks anyone from processing it twice at once).
- Runs the salary math for **each employee** (see below).
- Adds up everyone's totals into run-level totals (rollup).
- Flips the run to **COMPLETED** and records who processed it and when.

### How one employee's salary is calculated

```text
  Start with their salary structure (earnings + deductions)
        │
        ▼
  Apply LOP factor  ──►  if they had unpaid days, earnings shrink proportionally
        │                 factor = (working days − LOP days) / working days
        ▼
  Add bonus (if any adjustment was added)
        │
        ▼
  Subtract deductions (from salary structure + loan EMI if any)
        │
        ▼
  Subtract PF (Provident Fund), IF applicable:
        • Skipped if PF is disabled for the company
        • Skipped if this employee is marked "PF not applicable"
        • PF base = the "Basic" component (or a per-employee override)
        • Capped at ₹15,000 by default (the legal ceiling)
        • Employee's PF comes out of salary; employer's PF is tracked separately
        │
        ▼
  net = gross − total deductions
        │
        ▼
  Apply any manual DEDUCTION adjustment (subtract from net)
        │
        ▼
  Add approved REIMBURSEMENTS on top of net
        │
        ▼
  Freeze the final numbers on the employee's row, mark them PROCESSED
```

**If the employee has no salary structure:** they're marked **ERROR**, all their numbers
are zeroed out, and any reimbursements held for them are released. The rest of the batch
keeps going — one bad employee never breaks the whole run.

> This whole step is safe to re-run until the run is Locked. You can also re-process
> a single employee (e.g. after fixing their attendance) without redoing everyone.

---

## Step 5 — Lock the run

**What the admin does:** Clicks "Lock" once the numbers look right.

**What the system does:**
- Only allows locking if the run is COMPLETED **and** every employee is processed (no pending, no errors).
- Marks the consumed reimbursements as **paid**.
- Flips the run to **LOCKED** — now it's frozen, no more edits.
- Generates and stores **payslip PDFs** for everyone. (If one PDF fails, it's skipped quietly so a single glitch can't leave the run half-locked.)

> LOCKED is the point of no return. The run can no longer be changed or deleted.

---

## Step 6 — Disburse (mark as paid)

**What the admin does:** Records that salaries have actually been paid out (e.g. after the bank transfer).

**What the system does:**
- Only allows this if the run is LOCKED.
- Marks the processed employees as **PAID** — either everyone, or a chosen subset.
- Saves a payment reference (e.g. bank transaction ID).
- The run is flagged **fully disbursed** only once *every* processed employee is paid.

---

## Statuses at a glance

| Thing | Possible values | Meaning |
|-------|-----------------|---------|
| **Run** | DRAFT → PROCESSING → COMPLETED → LOCKED | Where the whole run is in its lifecycle |
| **Employee item** | PENDING / PROCESSED / ERROR | Whether one employee is ready, done, or blocked |
| **Payout** | PENDING / PAID | Whether one employee's salary has been paid out |

---

## Important things to remember

- **Re-running is safe.** Prepare and Process can be run again and again — they refresh in place. This stays true right up until you Lock.
- **One bad employee won't break the run.** A missing salary structure marks just that person as ERROR; everyone else still processes.
- **Reimbursements are added *after* the salary math**, directly on top of net pay.
- **PF rules:** a per-employee override beats the company-wide setting; the default cap is ₹15,000.
- **Lock is final.** After locking, the run is read-only — you can only disburse.
- **Disburse can be partial.** Pay some employees now, others later; "fully disbursed" only when all are paid.

---

## Where this lives in the code

| File | What it handles |
|------|-----------------|
| `services/payroll-run.service.ts` | Create, list, get, delete, audit trail |
| `services/payroll-preparation.service.ts` | Prepare and Validate |
| `services/payroll-processing.service.ts` | Process, reprocess, lock, disburse |
| `services/payroll-calculation.service.ts` | The salary math engine (LOP, PF) |
| `services/pf-config.service.ts` | PF configuration |
| `controllers/payroll-run.controller.ts` | The API endpoints |
| `enums/payroll.enum.ts` | The statuses and other enums |
