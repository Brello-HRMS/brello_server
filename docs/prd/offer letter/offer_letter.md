Below is how the **entire Offer Management module** is structured for Brello. This isn't just an Offer Letter module—it's a complete Offer Lifecycle Management system that bridges Recruitment and HRMS.

---

# Brello HRMS

# Product Requirements & Technical Design Specification

# Offer Management Module

**Version:** V1.5 (Production Ready)

---

# Module Overview

Offer Management enables HR teams to create, negotiate, send, track, and finalize employment offers for candidates before they become employees.

The module provides a secure external candidate portal, version-controlled offer letters, policy attachments, digital signatures, offer lifecycle tracking, configurable approval chains, candidate document collection, and seamless synchronization into the Employee module.

It bridges the gap between Recruitment and Employee Management.

---

# Objectives

The module should enable HR to:

- Create professional offer letters
- Send offers directly from organization email
- Manage multiple offer versions
- Route offers through multi-step approval chains
- Track candidate responses and timeline events
- Attach company policies
- Allow secure online acceptance, rejection, or negotiation
- Collect candidate onboarding documents post-acceptance
- Convert accepted candidates into employees
- Maintain complete audit history
- Eliminate manual paperwork

---

# Module Structure

```text
Offer Management
│
├── Candidates (Dashboard/List)
├── Offers (Details/Wizard)
├── Approvals
├── Analytics
└── Settings
```

---

# Offer Lifecycle

```text
Candidate Created

↓

Offer Draft

↓

Pending Approval (Optional via Approvals module)

↓

Offer Sent (Version 1)

↓

Viewed

↓

Accepted / Rejected / Request Changes

↓

Offer Version 2 (If changes requested)

↓

Accepted

↓

Candidate Uploads Documents (Post-Acceptance)

↓

Ready for Employee Sync

↓

Employee Synced
```

---

# Main Modules

---

# 1. Candidates / Dashboard

Landing screen.

Displays every candidate who is eligible to receive an offer.

Columns

- Candidate
- Position
- Department
- Recruiter
- Experience
- Offer Status
- Current Version
- Expiry Date
- Actions

Actions

- Create Offer
- Resume Draft
- View Offer
- Resend
- Withdraw
- Extend Expiry
- Sync Employee

---

# Candidate Status

```text
No Offer

↓

Draft

↓

Pending Approval

↓

Sent

↓

Viewed

↓

Accepted

↓

Rejected

↓

Expired

↓

Withdrawn

↓

Synced
```

---

# Candidate Profile

Each candidate contains

Personal Details

Professional Details

Resume

Interview Notes (Future)

Offer History

Timeline

Preboarding Documents (Uploaded post-acceptance)

---

# 2. Offer Templates

Separate from Employment Letter templates.

Supports

- Candidate Variables
- Job Variables
- Salary Variables
- Organization Variables
- Benefits
- Digital Signature
- Validity
- Policy Section

Lifecycle

Draft -> Published -> Archived

Versioning supported.

---

# 3. Offers

Core module.

Contains

Draft Offers

Sent Offers

Accepted

Rejected

Expired

Withdrawn

---

Each Offer contains

- Offer Number
- Version
- Candidate
- Position
- Salary
- Benefits
- Policies
- PDF
- Timeline
- Status
- Brand Identity (Multi-brand support)

---

# Offer Creation Wizard

Five-step wizard.

```text
Candidate -> Offer Details -> Compensation -> Policies -> Preview & Send
```

---

# Step 1: Candidate

Select existing candidate. Auto-fills Name, Email, Mobile.

---

# Step 2: Offer Details

Fields: Position, Department, Designation, Employment Type, Joining Date, Reporting Manager, Work Mode, Work Location, Shift, Office Address, Probation, Notice Period.

---

# Step 3: Compensation

Integrated with Payroll.

Select Salary Structure -> Components -> CTC -> Monthly -> Annual

Avoids manual calculations.

---

# Step 4: Policies

Dropdown to select policies already created in Policies module.

Selected policy PDFs automatically become email attachments.

---

# Step 5: Preview

Displays exactly how candidate will see it (Offer Letter, Salary, Benefits, Policies).

---

# Offer Numbering

Each offer receives

```text
OFF-2026-000145
```

Rules

- Generated only once
- Sequential
- Organization scoped
- Never reused
- Independent from Employee Letters

Version does not change Offer Number.

---

# 4. Approvals Workflow (New in V1.5)

Before an offer is sent, it can be routed through a configurable approval chain.

- Multiple steps (e.g., Step 1: Manager, Step 2: Finance).
- Approvers see a dedicated queue in the `OFFER_APPROVALS` module.
- Approvers can Accept or Reject (with required comments).
- Offer status remains `PENDING_APPROVAL` until all steps clear.
- Notifications are automatically dispatched to the next approver in the chain.

---

# Offer Versioning

One of the biggest features.

Example

```text
Offer OFF-145 (V1) -> Candidate requests changes -> V2 -> Candidate accepts
```

Every version stores

- Version Number
- Created By
- Created Date
- Changed Fields
- Reason
- PDF Snapshot
- Candidate Response

### One Active Version Rule

Only one version may remain active. Candidate always accesses only the latest version. Previous versions remain visible only to HR.

---

# Email Delivery

One click.

Generate PDF -> Attach Policies -> Generate Secure Token -> Send Email -> Timeline -> Audit

Email contains

- Congratulations message
- Offer Summary
- Download PDF
- Policy Attachments
- Review Offer button

---

# External Candidate Portal

No login required. Secure token-based access.

Displays: Company, Offer Summary, Salary, Benefits, Policies, Offer Letter, Attachments, Expiry Countdown.

Buttons: Accept, Request Changes, Reject.

### Post-Acceptance Uploads

Once a candidate accepts the offer, the portal transforms to allow them to upload critical pre-boarding documents (e.g., PAN, Aadhaar) directly to their candidate profile.

---

# Portal Security

Secure random token. HTTPS only. Single active token. Previous tokens invalidated. Link expires automatically. No authentication required. Read-only data.

---

# Offer Expiry & Extension

Organization configurable. Default 7 Days.

Countdown visible to candidate. Expired offers become read-only. Status changes automatically.

HR can manually **Extend Expiry** from 1 to 60 days via the Offer Dashboard, instantly updating the token validity.

---

# Reminder Emails

Default

Day 3 -> Reminder -> Day 6 -> Final Reminder -> Expired

Stops after acceptance. Efficiently batch-processed via the daily Scheduler.

---

# Offer Withdrawal

HR may withdraw offer before acceptance.

Workflow: Withdraw -> Reason -> Notify Candidate -> Portal Disabled -> Timeline Updated

---

# Resend Offer

Creates New Secure Token -> Invalidates Previous Token -> Resends Email

Offer Number remains same. Version remains same.

---

# Timeline & Audit

Every activity recorded.

Example

Candidate Created -> Offer Draft -> Offer Sent -> Viewed -> Reminder Sent -> Requested Changes -> Offer V2 Sent -> Viewed -> Accepted -> Employee Synced

---

# Analytics Dashboard (New in V1.5)

Dedicated dashboard for recruiters and HR heads.

Provides real-time tracking of:
- Offer Funnel (Draft vs. Sent vs. Accepted vs. Rejected)
- Acceptance & Negotiation Rates
- Average Days to Accept
- Time-series sparklines showing offer volume per week.

---

# Sync to Employee

After acceptance.

Button

```text
Sync to Employee
```

Auto-creates employee record from candidate data. Link established between Employee ID and Offer. Status changes to Synced.
