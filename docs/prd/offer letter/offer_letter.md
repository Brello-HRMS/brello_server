Below is how I would structure the **entire Offer Management module** for Brello. This isn't just an Offer Letter module—it's a complete Offer Lifecycle Management system that bridges Recruitment and HRMS.

---

# Brello HRMS

# Product Requirements & Technical Design Specification

# Offer Management Module

**Version:** V1.0 (Production Ready)

---

# Module Overview

Offer Management enables HR teams to create, negotiate, send, track, and finalize employment offers for candidates before they become employees.

The module provides a secure external candidate portal, version-controlled offer letters, policy attachments, digital signatures, offer lifecycle tracking, and seamless synchronization into the Employee module.

It bridges the gap between Recruitment and Employee Management.

---

# Objectives

The module should enable HR to:

- Create professional offer letters
- Send offers directly from organization email
- Manage multiple offer versions
- Track candidate responses
- Attach company policies
- Allow secure online acceptance/rejection
- Convert accepted candidates into employees
- Maintain complete audit history
- Eliminate manual paperwork

---

# Module Structure

```text
Offer Management
│
├── Candidates
├── Offers
├── Offer Templates
├── Timeline
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

Offer Sent (Version 1)

↓

Viewed

↓

Accepted
Rejected
Request Changes

↓

Offer Version 2

↓

Accepted

↓

Ready for Employee Sync

↓

Employee Synced
```

---

# Main Modules

---

# 1. Candidates

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
- Sync Employee

---

# Candidate Status

```text
No Offer

↓

Draft

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

Draft

↓

Published

↓

Archived

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

---

# Offer Creation Wizard

Five-step wizard.

```text
Candidate

↓

Offer Details

↓

Compensation

↓

Policies

↓

Preview & Send
```

---

# Step 1

Candidate

Select existing candidate.

Auto-fills

- Name
- Email
- Mobile

---

# Step 2

Offer Details

Fields

- Position
- Department
- Designation
- Employment Type
- Joining Date
- Reporting Manager
- Work Mode
- Work Location
- Shift
- Office Address
- Probation
- Notice Period

---

# Step 3

Compensation

Integrated with Payroll.

Select

Salary Structure

↓

Components

↓

CTC

↓

Monthly

↓

Annual

Avoids manual calculations.

---

# Step 4

Policies

Dropdown

Select policies already created in Policies module.

Example

✓ Leave Policy

✓ Attendance Policy

✓ Work From Home

✓ IT Security

✓ Code of Conduct

Selected policy PDFs automatically become email attachments.

---

# Step 5

Preview

Displays

- Offer Letter
- Salary
- Benefits
- Policies
- Digital Signature

Exactly how candidate will see it.

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

# Offer Versioning

One of the biggest features.

Example

```text
Offer OFF-145

V1

↓

Candidate requests changes

↓

V2

↓

Candidate accepts
```

Every version stores

- Version Number
- Created By
- Created Date
- Changed Fields
- Reason
- PDF Snapshot
- Candidate Response

---

# One Active Version Rule

Only one version may remain active.

Example

```text
V1

↓

Superseded

↓

V2

↓

Active
```

Candidate always accesses only the latest version.

Previous versions remain visible only to HR.

---

# Version Comparison

HR can compare

Salary

Joining Date

Benefits

Policies

Highlight changed values.

---

# Email Delivery

One click.

Workflow

Generate PDF

↓

Attach Policies

↓

Generate Secure Token

↓

Send Email

↓

Timeline

↓

Audit

---

Email contains

- Congratulations message
- Offer Summary
- Download PDF
- Policy Attachments
- Review Offer button

---

# Digital Signature

Offer PDF includes

Company Signature

↓

Digitally Signed

↓

Timestamp

↓

Organization

Future-ready for

- DSC
- Adobe Sign
- DocuSign

---

# External Candidate Portal

No login required.

Secure token-based access.

Displays

Company

Offer Summary

Salary

Benefits

Policies

Offer Letter

Attachments

Expiry Countdown

Buttons

Accept

Request Changes

Reject

---

# Portal Security

Secure random token

HTTPS only

Single active token

Previous tokens invalidated

Link expires automatically

No authentication required

Read-only data

---

# Candidate Decisions

Accept

↓

Confirmation

↓

Status Accepted

---

Reject

↓

Reason

↓

Optional Comment

↓

Rejected

---

Request Changes

↓

Expected Salary

Joining Date

Benefits

Comments

↓

Negotiation Requested

---

# Offer Expiry

Organization configurable.

Default

7 Days

Countdown visible to candidate.

Expired offers become read-only.

Status changes automatically.

---

# Reminder Emails

Default

Day 3

↓

Reminder

↓

Day 6

↓

Final Reminder

↓

Expired

Stops after acceptance.

---

# Offer Withdrawal

HR may withdraw offer before acceptance.

Workflow

Withdraw

↓

Reason

↓

Notify Candidate

↓

Portal Disabled

↓

Timeline Updated

Cannot withdraw

Accepted

Rejected

Expired

---

# Resend Offer

Creates

New Secure Token

↓

Invalidates Previous Token

↓

Resends Email

Offer Number remains same.

Version remains same.

---

# Timeline

Every activity recorded.

Example

Candidate Created

↓

Offer Draft

↓

Offer Sent

↓

Viewed

↓

Reminder Sent

↓

Requested Changes

↓

Offer V2 Sent

↓

Viewed

↓

Accepted

↓

Employee Synced

---

# Sync to Employee

After acceptance

Button

```text
Sync to Employee
```

Workflow

Validate

↓

Duplicate Check

↓

Preview

↓

Create Employee

↓

Mark Candidate Synced

---

# Sync Validation

Must verify

Department

Designation

Reporting Manager

Salary Structure

Shift

Joining Date

Work Location

Employment Type

Company

Missing fields block synchronization.

---

# Duplicate Detection

Checks

Email

Phone

Government ID (Future)

If employee exists

Open Existing

Merge (Future)

Cancel

Never duplicate employees.

---

# Employee Creation

Auto-create

Employee

↓

Generate Employee Code

↓

Copy Offer Details

↓

Link Candidate

↓

Mark Offer Synced

---

# Analytics Dashboard

Displays

Offers Sent

Accepted

Rejected

Expired

Negotiation Rate

Acceptance Rate

Average Acceptance Time

Pending Sync

Recruiter Performance

Top Reject Reasons

---

# Settings

Organization-level configuration

Offer Prefix

Offer Expiry

Reminder Schedule

Default Template

Default Policies

Default Signatory

Organization Email

Enable Digital Signature

Allow Download

Enable Request Changes

Auto Welcome Email

Auto Sync (Future)

---

# Permissions

- Offers View
- Offers Create
- Offers Edit Draft
- Offers Send
- Offers Withdraw
- Offers Resend
- Offers Sync Employee
- Manage Templates
- Manage Settings
- View Analytics

---

# Notifications

HR

- Offer Viewed
- Offer Accepted
- Offer Rejected
- Request Changes
- Offer Expired
- Employee Synced

Candidate

- Offer Sent
- Reminder
- Offer Updated
- Offer Withdrawn
- Offer Expired
- Acceptance Confirmation

---

# Audit Logs

Every action recorded

- Draft Created
- Offer Updated
- Offer Sent
- Reminder Sent
- Offer Viewed
- Offer Accepted
- Offer Rejected
- Change Requested
- Offer Withdrawn
- Offer Expired
- Employee Synced

---

# Integrations

### Recruitment Module

- Candidate Details
- Job Information

### Payroll Module

- Salary Structure
- Compensation Components

### Policies Module

- Policy Selection
- PDF Attachments

### Employee Module

- Employee Creation
- Employee Linking

### Document Module

- Offer PDF Storage
- Policy Storage

### Notification Module

- Email Delivery
- In-App Notifications

### Audit Module

- Event Logging

---

# Production Business Rules

- Offer Number generated only on first send.
- Only one active version exists per offer.
- Previous versions are automatically superseded.
- Offer links expire based on organization settings (default 7 days).
- Every resend generates a new secure token and invalidates previous tokens.
- Accepted offers cannot be edited or withdrawn.
- Withdrawn or expired offers cannot be accepted.
- Every offer version creates an immutable PDF snapshot.
- Candidate can only access the latest active version.
- Policies are attached dynamically from the Policies module at send time.
- Digital signature is embedded during PDF generation.
- Employee synchronization is only allowed after acceptance.
- Duplicate employee detection is mandatory before synchronization.
- All business events generate audit records.
- All generated documents remain immutable and permanently traceable.

---

## Recommended PRD Chapters

I recommend documenting this module with the same production depth as Letter Management:

1. **Introduction & Architecture**
2. **Offer Lifecycle & Business Rules**
3. **Offer Templates**
4. **Candidate Management**
5. **Offer Creation Wizard**
6. **Versioning & Negotiation**
7. **Email Delivery & Notifications**
8. **External Candidate Portal**
9. **Employee Synchronization**
10. **REST API Contracts**
11. **Database Schema**
12. **Frontend UX & User Flows**
13. **Security, Audit & Compliance**
14. **Testing & Production Readiness**

This structure keeps the specification modular, implementation-ready, and consistent with the engineering standard you've established for the Letter Management module.
