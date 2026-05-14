# API Contract Documentation

# Module: Attendance Check-In / Check-Out + Office-In / Remote-In

## Product: Brello HRMS

---

# 1. Base URL

```http
/api/v1/attendance
```

---

# 2. Authentication

All endpoints require authentication.

---

## Headers

```http
Authorization: Bearer <token>
Content-Type: application/json
```

---

# 3. Core Attendance Concepts

| Field              | Description                     |
| ------------------ | ------------------------------- |
| Attendance Status  | Present / Half-Day / Absent etc |
| Attendance Mode    | Office-In / Remote-In           |
| Attendance Source  | AUTO / MANUAL / BIOMETRIC       |
| Attendance Session | Individual check-in/out session |

---

# 4. Attendance Status Enums

```json
[
  "Present",
  "Half-Day",
  "Absent",
  "Late",
  "On Leave",
  "Holiday",
  "Weekly Off",
  "Missed Checkout",
  "Overtime",
  "Pending Approval"
]
```

---

# 5. Attendance Mode Enums

```json
[
  "Office-In",
  "Remote-In"
]
```

---

# 6. Attendance Source Enums

```json
[
  "AUTO",
  "MANUAL",
  "WEB",
  "MOBILE",
  "BIOMETRIC"
]
```

---

# 7. Geo Status Enums

```json
[
  "VALID",
  "OUTSIDE_RADIUS",
  "GPS_DISABLED",
  "MOCK_LOCATION",
  "REJECTED"
]
```

---

# 8. Check-In API

## Endpoint

```http
POST /check-in
```

---

# 9. Check-In Request

## Request Body

```json
{
  "latitude": 19.0760,
  "longitude": 72.8777,
  "device": "WEB",
  "remote_reason": null,
  "notes": "Optional note"
}
```

---

## Request Rules

| Field         | Required           | Notes                                |
| ------------- | ------------------ | ------------------------------------ |
| latitude      | Yes if geo enabled | GPS latitude                         |
| longitude     | Yes if geo enabled | GPS longitude                        |
| device        | Yes                | WEB/MOBILE                           |
| remote_reason | Conditional        | Required for Remote-In if configured |
| notes         | No                 | Optional notes                       |

---

# 10. Check-In Success Response (Office-In)

```json
{
  "success": true,
  "message": "Checked in successfully",
  "data": {
    "attendance_id": "ATT-1001",
    "attendance_session_id": "ATS-9001",
    "attendance_mode": "Office-In",
    "attendance_status": "Present",
    "geo_status": "VALID",
    "distance_from_office_meters": 120,
    "office": {
      "office_id": "OFF-1",
      "office_name": "Mumbai HQ"
    },
    "check_in_time": "2026-03-10T09:12:00Z",
    "shift": {
      "shift_id": "SHIFT-1",
      "shift_name": "General Shift",
      "start_time": "09:00",
      "end_time": "18:00"
    },
    "is_late": false
  }
}
```

---

# 11. Check-In Success Response (Remote-In)

```json
{
  "success": true,
  "message": "Remote check-in successful",
  "data": {
    "attendance_id": "ATT-1002",
    "attendance_session_id": "ATS-9002",
    "attendance_mode": "Remote-In",
    "attendance_status": "Pending Approval",
    "geo_status": "OUTSIDE_RADIUS",
    "distance_from_office_meters": 4200,
    "remote_reason": "Work From Home",
    "check_in_time": "2026-03-10T09:25:00Z",
    "requires_approval": true,
    "approval_status": "PENDING"
  }
}
```

---

# 12. Check-In Validation Errors

---

## Already Checked In

```json
{
  "success": false,
  "message": "Employee already checked in"
}
```

---

## Remote-In Not Allowed

```json
{
  "success": false,
  "message": "You are outside the allowed office location. Remote attendance is disabled.",
  "error_code": "REMOTE_ATTENDANCE_DISABLED"
}
```

---

## GPS Disabled

```json
{
  "success": false,
  "message": "Location permission required for attendance",
  "error_code": "GPS_REQUIRED"
}
```

---

## Missing Remote Reason

```json
{
  "success": false,
  "message": "Remote reason is required",
  "error_code": "REMOTE_REASON_REQUIRED"
}
```

---

# 13. Check-Out API

## Endpoint

```http
POST /check-out
```

---

# 14. Check-Out Request

```json
{
  "latitude": 19.0760,
  "longitude": 72.8777,
  "notes": "Leaving for the day"
}
```

---

# 15. Check-Out Success Response

```json
{
  "success": true,
  "message": "Checked out successfully",
  "data": {
    "attendance_id": "ATT-1001",
    "attendance_session_id": "ATS-9001",
    "attendance_mode": "Office-In",
    "check_out_time": "2026-03-10T18:05:00Z",
    "worked_hours": "08:53",
    "worked_minutes": 533,
    "attendance_status": "Present",
    "is_half_day": false,
    "is_overtime": true,
    "overtime_minutes": 53
  }
}
```

---

# 16. Get Current Attendance Session

## Endpoint

```http
GET /me/today
```

---

# 17. Response

```json
{
  "success": true,
  "data": {
    "attendance_id": "ATT-1001",
    "attendance_session_id": "ATS-9001",
    "date": "2026-03-10",
    "attendance_mode": "Office-In",
    "attendance_status": "Present",
    "check_in_time": "09:12 AM",
    "check_out_time": null,
    "worked_duration_live": "03:42:15",
    "live_session": true,
    "shift": {
      "shift_name": "General Shift",
      "start_time": "09:00",
      "end_time": "18:00"
    },
    "office": {
      "office_name": "Mumbai HQ"
    }
  }
}
```

---

# 18. Get Employee Attendance History

## Endpoint

```http
GET /me/history
```

---

# 19. Query Params

```http
?page=1
&limit=20
&month=3
&year=2026
&attendance_mode=Remote-In
&attendance_status=Present
```

---

# 20. Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "attendance_id": "ATT-1001",
        "date": "2026-03-10",
        "check_in": "09:12 AM",
        "check_out": "06:05 PM",
        "worked_hours": "08:53",
        "attendance_mode": "Office-In",
        "attendance_status": "Present",
        "shift": "General Shift",
        "remote_reason": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 31
    }
  }
}
```

---

# 21. Admin Daily Preview API

## Endpoint

```http
GET /admin/daily-preview
```

---

# 22. Query Params

```http
?date=2026-03-10
&department_id=DEP-1
&attendance_status=Present
&attendance_mode=Remote-In
&shift_id=SHIFT-1
```

---

# 23. Response

```json
{
  "success": true,
  "data": {
    "summary": {
      "present": 142,
      "absent": 12,
      "late": 8,
      "half_day": 5,
      "on_leave": 4,
      "missed_checkout": 3,
      "office_in": 110,
      "remote_in": 32,
      "geo_violations": 6
    },
    "items": [
      {
        "attendance_id": "ATT-1001",
        "employee": {
          "employee_id": "EMP-001",
          "name": "John Doe",
          "department": "Design"
        },
        "date": "2026-03-10",
        "shift": {
          "shift_name": "General Shift"
        },
        "check_in": "09:12 AM",
        "check_out": "06:05 PM",
        "worked_hours": "08:53",
        "attendance_mode": "Office-In",
        "attendance_status": "Present",
        "geo_status": "VALID",
        "distance_from_office_meters": 120,
        "source": "AUTO",
        "remote_reason": null,
        "approval_status": null,
        "notes": null
      }
    ]
  }
}
```

---

# 24. Add Manual Attendance Entry

## Endpoint

```http
POST /admin/manual-entry
```

---

# 25. Request Body

```json
{
  "employee_id": "EMP-001",
  "date": "2026-03-10",
  "check_in": "09:12",
  "check_out": "18:05",
  "attendance_mode": "Remote-In",
  "attendance_status_override": null,
  "remote_reason": "Client Visit",
  "notes": "Manual correction by HR"
}
```

---

# 26. Response

```json
{
  "success": true,
  "message": "Attendance entry created successfully",
  "data": {
    "attendance_id": "ATT-1001",
    "attendance_mode": "Remote-In",
    "attendance_status": "Present",
    "worked_hours": "08:53",
    "source": "MANUAL"
  }
}
```

---

# 27. Update Attendance Entry

## Endpoint

```http
PUT /admin/{attendance_id}
```

---

# 28. Request Body

```json
{
  "check_in": "09:30",
  "check_out": "18:10",
  "attendance_mode": "Office-In",
  "attendance_status_override": "Present",
  "remote_reason": null,
  "notes": "Approved by HR"
}
```

---

# 29. Response

```json
{
  "success": true,
  "message": "Attendance updated successfully"
}
```

---

# 30. Delete Attendance Entry

## Endpoint

```http
DELETE /admin/{attendance_id}
```

---

# 31. Response

```json
{
  "success": true,
  "message": "Attendance deleted successfully"
}
```

---

# 32. Remote Attendance Approval APIs

---

# 33. Approve Remote Attendance

## Endpoint

```http
POST /admin/remote-approvals/{attendance_id}/approve
```

---

## Response

```json
{
  "success": true,
  "message": "Remote attendance approved successfully",
  "data": {
    "attendance_status": "Present",
    "approval_status": "APPROVED"
  }
}
```

---

# 34. Reject Remote Attendance

## Endpoint

```http
POST /admin/remote-approvals/{attendance_id}/reject
```

---

## Request Body

```json
{
  "reason": "Outside approved work region"
}
```

---

## Response

```json
{
  "success": true,
  "message": "Remote attendance rejected",
  "data": {
    "attendance_status": "Absent",
    "approval_status": "REJECTED"
  }
}
```

---

# 35. Get Pending Remote Approvals

## Endpoint

```http
GET /admin/remote-approvals
```

---

# 36. Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "attendance_id": "ATT-1002",
        "employee": {
          "employee_id": "EMP-001",
          "name": "John Doe"
        },
        "date": "2026-03-10",
        "check_in_time": "09:25 AM",
        "remote_reason": "Work From Home",
        "distance_from_office_meters": 4200,
        "approval_status": "PENDING"
      }
    ]
  }
}
```

---

# 37. Get Attendance Rules

## Endpoint

```http
GET /rules
```

---

# 38. Response

```json
{
  "success": true,
  "data": {
    "full_day_hours": 8,
    "half_day_hours": 4,
    "late_after": "09:30",
    "grace_minutes": 15,
    "overtime_after_hours": 9,
    "multiple_sessions_allowed": true,
    "geo_fencing_enabled": true,
    "office_radius_meters": 500,
    "allow_remote_in": true,
    "require_remote_reason": true,
    "remote_approval_required": true
  }
}
```

---

# 39. Attendance Audit Logs API

## Endpoint

```http
GET /admin/audit-logs
```

---

# 40. Query Params

```http
?employee_id=EMP-001
&date=2026-03-10
&event_type=CHECK_IN
```

---

# 41. Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "audit_id": "AUD-1001",
        "event_type": "REMOTE_CHECK_IN",
        "performed_by": {
          "employee_id": "EMP-001",
          "name": "John Doe"
        },
        "timestamp": "2026-03-10T09:12:00Z",
        "device": "WEB",
        "ip_address": "122.172.1.20",
        "old_value": null,
        "new_value": {
          "attendance_mode": "Remote-In"
        }
      }
    ]
  }
}
```

---

# 42. Suggested Database Tables

| Table                       | Purpose                  |
| --------------------------- | ------------------------ |
| attendance_records          | Daily attendance         |
| attendance_sessions         | Punch sessions           |
| attendance_geo_logs         | Geo validations          |
| attendance_audit_logs       | Audit trail              |
| attendance_rule_assignments | Rule mappings            |
| attendance_remote_approvals | Remote approval workflow |
| office_locations            | Office geo configuration |

---

# 43. Suggested Internal Calculation Object

```json
{
  "worked_minutes": 533,
  "late_minutes": 12,
  "is_late": true,
  "is_half_day": false,
  "is_overtime": true,
  "attendance_status": "Present",
  "attendance_mode": "Office-In",
  "geo_status": "VALID"
}
```
