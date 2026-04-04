# **Attendance Module — API Contract (v1.0)**

---

# **1. Base Configuration**

### **Base URL**

```
/api/v1/attendance
```

### **Authentication**

```
Authorization: Bearer <JWT_TOKEN>
```

---

# **2. Global Standards**

---

## **2.1 Data Types**

| Type    | Description              |
| ------- | ------------------------ |
| string  | UTF-8 string             |
| integer | Whole number             |
| float   | Decimal number           |
| boolean | true / false             |
| enum    | Predefined string values |
| time    | `HH:mm` (24-hour format) |
| uuid    | Unique string identifier |

---

## **2.2 ID Format**

All IDs:

```
type: string
format: uuid (recommended) OR prefixed string (e.g. shift_123)
```

---

## **2.3 Status Enum**

```json
"status": "ACTIVE" | "INACTIVE"
```

---

## **2.4 Pagination**

### **Request**

```
?page=1&limit=20
```

### **Response**

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

---

## **2.5 Standard Response**

### **Success**

```json
{
  "success": true,
  "data": {},
  "message": "Optional"
}
```

### **Error**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": {
      "field_name": "Error reason"
    }
  }
}
```

---

## **2.6 HTTP Status Codes**

| Code | Usage                   |
| ---- | ----------------------- |
| 200  | Success                 |
| 201  | Created                 |
| 400  | Validation error        |
| 401  | Unauthorized            |
| 404  | Not found               |
| 409  | Conflict                |
| 422  | Business rule violation |

---

# **3. Shifts API**

---

## **3.1 Create Shift**

### **POST** `/shifts`

---

### **Request Schema**

```json
{
  "name": "string (required, max 100)",
  "start_time": "HH:mm (required)",
  "end_time": "HH:mm (required, > start_time)",
  "late_grace_minutes": "integer (>=0)",
  "auto_checkout_time": "HH:mm (>= end_time)",
  "allow_multiple_checkins": "boolean",
  "full_day_hours": "float (>0)",
  "half_day_hours": "float (>0 and < full_day_hours)"
}
```

---

### **Validations**

* `name` must be unique
* `end_time > start_time`
* `auto_checkout_time ≥ end_time`
* `full_day_hours > half_day_hours`

---

### **Response**

**201 Created**

```json
{
  "success": true,
  "data": {
    "id": "shift_uuid"
  }
}
```

---

---

## **3.2 List Shifts**

### **GET** `/shifts`

Supports pagination

---

## **3.3 Update Shift**

### **PATCH** `/shifts/{id}`

Partial update allowed

---

## **3.4 Change Status**

### **PATCH** `/shifts/{id}/status`

```json
{
  "status": "ACTIVE | INACTIVE"
}
```

---

### **Business Rules**

* Cannot deactivate if used in active rules → return `409 CONFLICT`

---

# **4. Weekly Off API**

---

## **4.1 Create Weekly Off**

### **POST** `/weekly-offs`

---

### **Request**

```json
{
  "name": "string (required, unique)",
  "days": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
}
```

---

### **Validations**

* At least **1 day required**
* Max **7 days**
* No duplicates

---

---

## **4.2 List Weekly Offs**

### **GET** `/weekly-offs`

---

## **4.3 Update Weekly Off**

### **PATCH** `/weekly-offs/{id}`

---

## **4.4 Change Status**

### **PATCH** `/weekly-offs/{id}/status`

---

### **Business Rules**

* Cannot deactivate if linked to active rule

---

# **5. Attendance Rules API**

---

## **5.1 Create Rule**

### **POST** `/rules`

---

### **Request**

```json
{
  "name": "string (required, unique)",
  "shift_id": "uuid (required)",
  "weekly_off_id": "uuid (required)",

  "full_day_hours": "float (>0)",
  "half_day_hours": "float (>0, < full_day_hours)",

  "overtime_after_hours": "float (>= full_day_hours)",
  "overtime_multiplier": "float (>=1)",

  "allow_multiple_checkins": "boolean",
  "require_geo_fencing": "boolean",

  "geo_fence": {
    "office_name": "string (required if geo enabled)",
    "latitude": "float (-90 to 90)",
    "longitude": "float (-180 to 180)",
    "radius_meters": "integer (>0)"
  }
}
```

---

### **Validations**

* `shift_id` must exist
* `weekly_off_id` must exist
* If `require_geo_fencing = true` → `geo_fence` required
* `overtime_after_hours ≥ full_day_hours`

---

### **Response**

**201 Created**

```json
{
  "success": true,
  "data": {
    "id": "rule_uuid"
  }
}
```

---

---

## **5.2 List Rules**

### **GET** `/rules`

---

## **5.3 Update Rule**

### **PATCH** `/rules/{id}`

---

## **5.4 Change Status**

### **PATCH** `/rules/{id}/status`

---

---

# **6. Rule Assignment API**

---

## **6.1 Assign to Departments**

### **POST** `/rules/{id}/assign/departments`

---

### **Request**

```json
{
  "department_ids": ["uuid"]
}
```

---

### **Behavior**

* Assigns rule to all employees in departments
* Overwrites previous department-level rule

---

---

## **6.2 Assign to Employees (Override)**

### **POST** `/rules/{id}/assign/employees`

---

### **Request**

```json
{
  "employee_ids": ["uuid"]
}
```

---

### **Critical Rule (Precedence)**

```
Employee-level assignment OVERRIDES department-level assignment
```

---

---

## **6.3 Get Assignments**

### **GET** `/rules/{id}/assignments`

---

---

# **7. Geo-Fencing Logic**

---

## **Rule Selection Priority**

```
1. Employee-level rule
2. Department-level rule
```

---

## **Distance Calculation**

* Use **Haversine formula**
* Units: meters

---

## **Validation API**

### **POST** `/geo/validate`

---

### **Request**

```json
{
  "employee_id": "uuid",
  "latitude": "float",
  "longitude": "float"
}
```

---

### **Response**

```json
{
  "success": true,
  "data": {
    "is_within_radius": true,
    "distance": 120
  }
}
```

---

### **Errors**

| Code          | Case                 |
| ------------- | -------------------- |
| NOT_FOUND     | No rule assigned     |
| INVALID_STATE | Geo-fencing disabled |

---

# **8. Core Business Rules (Critical)**

---

## **Rule Assignment**

* One employee can have:

  * 1 department rule
  * 1 employee override rule

---

## **Precedence**

```
Employee Rule > Department Rule
```

---

## **Deletion Strategy**

* No hard delete
* Only `INACTIVE`

---

## **Consistency Rules**

* Shift cannot be deleted if used
* Weekly off cannot be deleted if used
* Rule cannot exist without shift + weekly off

---

---

# **9. Edge Cases Covered**

---

### **Case 1: Invalid Shift Timing**

→ Return `400 VALIDATION_ERROR`

---

### **Case 2: Duplicate Names**

→ Return `409 CONFLICT`

---

### **Case 3: Geo Required but Missing**

→ Return `422 BUSINESS_ERROR`

---

### **Case 4: Assigning Non-existent Entity**

→ Return `404 NOT_FOUND`

