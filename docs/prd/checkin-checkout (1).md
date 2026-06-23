# Product Requirement Document (PRD)

# Module: Attendance Check-In / Check-Out + Office-In / Remote-In

## Product: Brello HRMS

---

# 1. Feature Overview

The Attendance module enables employees to:

* Check in
* Check out
* Track work duration
* Mark attendance automatically
* Work from office or remotely
* View attendance history

The module enables HR/Admins to:

* Monitor daily attendance
* Manage attendance corrections
* Track remote attendance
* Enforce geo-fencing
* Configure attendance rules
* Review attendance analytics
* Audit attendance activities

The system integrates with:

* Shifts
* Attendance rules
* Weekly offs
* Holiday calendars
* Leave management
* Geo-fencing
* Department assignments

---

# 2. Objectives

## Employee Objectives

Employees should be able to:

* Seamlessly check in/out
* Understand attendance status
* See working duration live
* Check in remotely when permitted
* Understand whether attendance is Office-In or Remote-In

---

## HR/Admin Objectives

Admins should be able to:

* View organization attendance in real-time
* Identify late arrivals
* Track half-days and absences
* Monitor remote workforce
* Correct attendance manually
* Audit attendance actions
* Enforce office attendance policies

---

# 3. Attendance Concepts

| Concept            | Description                            |
| ------------------ | -------------------------------------- |
| Check-In           | Employee starts attendance session     |
| Check-Out          | Employee ends attendance session       |
| Attendance Record  | Final attendance summary for a day     |
| Attendance Session | Individual punch session               |
| Office-In          | Attendance from office geo-radius      |
| Remote-In          | Attendance outside office radius       |
| Shift              | Expected work schedule                 |
| Attendance Rule    | Rule engine for attendance calculation |
| Geo-Fencing        | GPS-based office validation            |
| Attendance Status  | Present/Half-Day/Absent etc            |

---

# 4. High-Level Attendance Flow

```text id="vubz4f"
Employee opens dashboard
    ↓
Clicks Check-In
    ↓
System validates:
- Shift assigned
- Weekly off?
- Holiday?
- Leave exists?
- Already checked in?
- Geo-fence validation
    ↓
Determine Attendance Mode:
- Office-In
- Remote-In
- Reject
    ↓
Attendance session starts
    ↓
Live timer runs
    ↓
Employee checks out
    ↓
System calculates:
- Total hours
- Attendance status
- Late arrival
- Half-day
- Overtime
    ↓
Attendance finalized
```

---

# 5. Attendance Modes

Attendance mode determines WHERE employee worked from.

---

## 5.1 Office-In

Employee checked in within approved office radius.

### Example

```text id="3jth9q"
Office Radius:
500m

Employee Distance:
120m

Result:
Office-In
```

---

## 5.2 Remote-In

Employee checked in outside office radius.

### Example

```text id="k6v2n8"
Office Radius:
500m

Employee Distance:
4.3km

Result:
Remote-In
```

---

# 6. Attendance Statuses

Attendance status determines HOW attendance is evaluated.

---

## Status Types

| Status           | Description                   |
| ---------------- | ----------------------------- |
| Present          | Full-day requirement met      |
| Half-Day         | Partial hours worked          |
| Absent           | No attendance                 |
| Late             | Checked in after grace period |
| Weekly Off       | Scheduled off                 |
| Holiday          | Company holiday               |
| On Leave         | Approved leave exists         |
| Missed Checkout  | No checkout found             |
| Overtime         | Extra hours worked            |
| Pending Approval | Waiting for remote approval   |

---

# 7. Attendance Mode vs Status

These are separate concepts.

| Attendance Mode | Attendance Status |
| --------------- | ----------------- |
| Office-In       | Present           |
| Remote-In       | Present           |
| Remote-In       | Half-Day          |
| Office-In       | Late              |

---

# 8. Attendance Rule Engine

Attendance calculations depend on configured rules.

---

# 9. Attendance Rule Configuration

## Rule Examples

| Rule                      | Example                  |
| ------------------------- | ------------------------ |
| Full Day Hours            | 8h                       |
| Half Day Threshold        | 4h                       |
| Late Mark After           | 9:30 AM                  |
| Grace Period              | 15 mins                  |
| Overtime Threshold        | 9h                       |
| Multiple Sessions Allowed | Yes                      |
| Auto Absent After         | No punch till end of day |

---

# 10. Geo-Fencing Configuration

## Geo Settings

| Setting                  | Type    | Description                     |
| ------------------------ | ------- | ------------------------------- |
| Enable Geo-Fencing       | Boolean | Enables location validation     |
| Office Radius            | Number  | Allowed office radius           |
| Allow Remote-In          | Boolean | Allow outside office attendance |
| Require Remote Reason    | Boolean | Mandatory reason                |
| Remote Approval Required | Boolean | HR/Manager approval             |
| Strict Office Attendance | Boolean | Reject all outside punches      |

---

# 11. Employee Dashboard Experience

# Attendance Widget

---

## Widget Shows

| Item              | Description           |
| ----------------- | --------------------- |
| Current Date      | Today’s date          |
| Shift Timing      | Assigned shift        |
| Live Timer        | Running work duration |
| Check-In Button   | Start attendance      |
| Check-Out Button  | End attendance        |
| Attendance Mode   | Office-In/Remote-In   |
| Attendance Status | Present/Late etc      |
| Worked Hours      | Total duration        |

---

# 12. Attendance Widget States

---

## Before Check-In

```text id="kq49y4"
[ Check In ]
```

---

## During Session

```text id="9jlwm8"
Checked in at 09:12 AM

Attendance Mode:
Office-In

Live Timer:
03:12:45

[ Check Out ]
```

---

## Completed Attendance

```text id="yw6s1g"
Checked out at 06:05 PM

Worked Hours:
08h 53m

Status:
Present
```

---

# 13. Check-In Validation Flow

System validates:

| Validation                       | Result                  |
| -------------------------------- | ----------------------- |
| Already checked in               | Block                   |
| Shift exists                     | Required                |
| GPS enabled                      | Required if geo enabled |
| Inside office radius             | Office-In               |
| Outside radius + remote allowed  | Remote-In               |
| Outside radius + remote disabled | Reject                  |

---

# 14. Office-In Flow

```text id="f4wwit"
Employee clicks Check-In
    ↓
GPS captured
    ↓
Location inside radius
    ↓
Attendance Mode = Office-In
    ↓
Attendance created
```

---

# 15. Remote-In Flow

```text id="6x9j9w"
Employee clicks Check-In
    ↓
Outside office radius
    ↓
Remote-In allowed
    ↓
Employee enters reason
    ↓
Attendance Mode = Remote-In
    ↓
Attendance created
```

---

# 16. Restricted Remote Attendance Flow

```text id="k1jlwm"
Employee outside office radius
    ↓
Remote attendance disabled
    ↓
Check-In rejected
```

---

# 17. Remote-In Reasons

Organizations may require employees to specify reason.

---

## Suggested Reasons

| Reason         |
| -------------- |
| Work From Home |
| Client Visit   |
| Field Work     |
| Travel         |
| Emergency      |
| Health Issue   |
| Internet Issue |
| Other          |

---

# 18. Remote Approval Workflow (Optional)

Organizations may require remote attendance approval.

---

# Flow

```text id="jlwmhp"
Remote-In created
    ↓
Attendance marked:
Pending Approval
    ↓
Manager reviews
    ↓
Approve / Reject
```

---

## Approved

Attendance finalized.

---

## Rejected

Attendance may become:

* Absent
* Invalid attendance
* Escalated for HR review

---

# 19. Check-Out Flow

When employee checks out:

System calculates:

* Total work duration
* Late status
* Half-day
* Full-day
* Overtime
* Final attendance result

---

# 20. Attendance Calculation Logic

---

## Example

| Worked Hours | Result             |
| ------------ | ------------------ |
| 8h 53m       | Present            |
| 5h           | Half-Day           |
| 2h           | Absent             |
| 9h 30m       | Present + Overtime |

---

# 21. Multiple Session Support

Optional organization setting.

---

## Example

```text id="3nkghp"
09:00 → Check-In
01:00 → Check-Out

02:00 → Check-In
06:00 → Check-Out
```

Total worked duration:

```text id="1ozv4y"
8 hours
```

---

# 22. Daily Attendance Finalization

Nightly attendance jobs should:

* Mark absentees
* Mark missed checkout
* Apply leave overrides
* Calculate overtime
* Finalize pending attendance

---

# 23. Employee Attendance History

Employees can view:

| Field           | Description           |
| --------------- | --------------------- |
| Date            | Attendance date       |
| Check-In        | First punch           |
| Check-Out       | Last punch            |
| Worked Hours    | Total duration        |
| Attendance Mode | Office-In / Remote-In |
| Status          | Present/Half-Day      |
| Shift           | Assigned shift        |
| Notes           | HR/Admin notes        |

---

# 24. Admin Daily Preview

## Objective

Provide complete organization attendance visibility.

---

# 25. Daily Preview Dashboard

## Summary Cards

| Card                | Description          |
| ------------------- | -------------------- |
| Total Present       | Employees present    |
| Total Absent        | Employees absent     |
| Late Arrivals       | Late employees       |
| Half-Day            | Half-day employees   |
| On Leave            | Employees on leave   |
| Missed Checkout     | Missing checkout     |
| Office-In Employees | In-office attendance |
| Remote-In Employees | Remote workers       |
| Geo Violations      | Failed geo attempts  |

---

# 26. Attendance Table

## Columns

| Column               | Description          |
| -------------------- | -------------------- |
| Employee             | Employee details     |
| Date                 | Attendance date      |
| Shift                | Assigned shift       |
| Check-In             | First punch          |
| Check-Out            | Last punch           |
| Worked Hours         | Total duration       |
| Attendance Status    | Present/Half-Day     |
| Attendance Mode      | Office-In/Remote-In  |
| Geo Status           | Valid/Outside Radius |
| Distance from Office | GPS distance         |
| Source               | AUTO/MANUAL          |
| Notes                | HR notes             |

---

# 27. Admin Filters

Admins can filter by:

* Date
* Department
* Shift
* Attendance status
* Attendance mode
* Office-In
* Remote-In
* Late arrivals
* Missed checkout
* Geo violations
* Manual entries

---

# 28. Manual Attendance Entry

HR/Admin can manually create or correct attendance.

---

# 29. Manual Entry Use Cases

| Scenario          | Example               |
| ----------------- | --------------------- |
| Forgot checkout   | Employee missed punch |
| Server outage     | System unavailable    |
| Client visit      | External work         |
| Biometric failure | Hardware issue        |

---

# 30. Manual Attendance Modal

## Fields

| Field                      | Required |
| -------------------------- | -------- |
| Employee                   | Yes      |
| Date                       | Yes      |
| Check-In                   | Yes      |
| Check-Out                  | Optional |
| Attendance Mode            | Optional |
| Attendance Status Override | Optional |
| Remote Reason              | Optional |
| Notes                      | Optional |

---

# 31. Manual Attendance Rules

After save:

* Attendance recalculated
* Worked hours recalculated
* Existing attendance overridden if allowed
* Audit logs created

---

# 32. Geo Validation Engine

System calculates:

```text id="tv0j3g"
Distance between:
- Employee GPS
- Office GPS
```

---

# 33. Multi-Office Support

If organization has multiple offices:

System should:

* Detect nearest office
* Validate nearest geo-radius
* Mark matched office location

---

# 34. Edge Cases

---

## Duplicate Check-In

```text id="g49wfp"
Employee already checked in
```

---

## GPS Disabled

```text id="o5hczh"
Location access required for attendance.
```

---

## Missed Checkout

```text id="ylsqmr"
Attendance marked:
Missed Checkout
```

---

## Leave + Attendance Conflict

| Scenario                    | Result                  |
| --------------------------- | ----------------------- |
| Approved leave exists       | Leave overrides absence |
| Half-day leave + attendance | Merge rules apply       |

---

## Holiday Attendance

If employee works on holiday:

```text id="c1ik9k"
Status:
Holiday Worked
```

---

## Office-In → Remote Check-Out

Attendance mode remains:

```text id="6obgfh"
Office-In
```

Mode determined during check-in.

---

# 35. Audit Logs

Every attendance action must be logged.

---

## Logged Events

| Event           | Logged |
| --------------- | ------ |
| Check-In        | Yes    |
| Check-Out       | Yes    |
| Office-In       | Yes    |
| Remote-In       | Yes    |
| Geo rejection   | Yes    |
| Manual edit     | Yes    |
| Status override | Yes    |
| Remote approval | Yes    |

---

## Audit Data

| Field      | Description      |
| ---------- | ---------------- |
| User       | Action performer |
| Timestamp  | Action time      |
| Device     | Web/Mobile       |
| IP Address | Request IP       |
| Old Value  | Previous state   |
| New Value  | Updated state    |

---

# 36. Notifications

Optional notifications.

---

## Employee Notifications

| Trigger                  | Notification |
| ------------------------ | ------------ |
| Successful check-in      | Confirmation |
| Successful checkout      | Confirmation |
| Missed checkout          | Reminder     |
| Remote approval rejected | Alert        |

---

## Admin Notifications

| Trigger           | Notification   |
| ----------------- | -------------- |
| Geo violation     | Alert          |
| Remote attendance | Notify manager |
| Pending approval  | Review request |

---

# 37. Permissions

| Role           | Access                      |
| -------------- | --------------------------- |
| Employee       | Check-in/out                |
| Manager        | View team attendance        |
| HR/Admin       | Full attendance management  |
| Platform Admin | Configure attendance engine |

---

# 38. Reports & Analytics

## Attendance Analytics

| Metric              | Description           |
| ------------------- | --------------------- |
| Attendance rate     | Workforce presence    |
| Remote attendance % | Hybrid workforce      |
| Late arrival trend  | Punctuality tracking  |
| Geo violations      | Compliance monitoring |
| Office utilization  | Office planning       |

---

# 39. Suggested Database Tables

| Table                       | Purpose           |
| --------------------------- | ----------------- |
| attendance_records          | Daily attendance  |
| attendance_sessions         | Punch sessions    |
| attendance_geo_logs         | GPS validation    |
| attendance_audit_logs       | Audit tracking    |
| attendance_rule_assignments | Rule mappings     |
| attendance_remote_approvals | Approval workflow |
| office_locations            | Office geo data   |

---

# 40. Future Scope

* Biometric attendance
* Face recognition
* QR attendance
* Slack/Teams attendance
* Offline mobile attendance
* WiFi-based office validation
* Bluetooth beacon validation
* AI fake GPS detection
* Attendance heatmaps
* Shift auto-detection
