# Employee APIs (HRMS Aggregate)

Base path: `/api/v1/employees`

Manages system users + all of their rich HR profile data atomically.

---

## 1. Create Employee Aggregate

Creates a User Identity and UserProfile simultaneously using an ACID transaction.

|            |                     |
| ---------- | ------------------- |
| **Method** | `POST`              |
| **URL**    | `/api/v1/employees` |
| **Auth**   | Required            |
| **Status** | `201 Created`       |

**Request Body:**

```json
{
  "firstName": "String",
  "lastName": "String",
  "email": "String (Unique)",
  "phone": "String (Unique)",
  "password": "StrongPassword",
  "enterprise_id": "UUID",
  "organization_id": "UUID",
  "departmentId": "UUID",
  "designationId": "UUID",
  "reportsTo": "UUID",
  "profile": {
    "employeeId": "String (Unique HR Code)",
    "type": "Enum (ADMIN, EMPLOYEE)",
    "dob": "Date",
    "gender": "Enum (MALE, FEMALE, OTHER)",
    "maritalStatus": "Enum",
    "joiningDate": "Date",
    "employmentType": "Enum (FULL_TIME, PART_TIME, CONTRACT)",
    "workLocation": "Enum (ONSITE, REMOTE, HYBRID)",
    "bloodGroup": "Enum",
    "noticePeriod": 30,
    "currentSalary": "String"
  }
}
```

---

## 2. Get Employee Aggregate

Fetches the complete employee tree, including identity, profile, and all active child arrays (Education, Experience, Assets, Gov Info, Bank).

|            |                         |
| ---------- | ----------------------- |
| **Method** | `GET`                   |
| **URL**    | `/api/v1/employees/:id` |
| **Auth**   | Required                |
| **Status** | `200 OK`                |

**Response Snippet:**

```json
{
  "success": true,
  "data": {
    "id": "UUID (matches User ID)",
    "firstName": "John",
    "lastName": "Doe",
    "profile": {
      /* ... */
    },
    "education": [
      /* ... */
    ],
    "experience": [
      /* ... */
    ],
    "assets": [
      /* ... */
    ],
    "documents": [
      /* ... */
    ],
    "bankInfo": {
      /* ... */
    },
    "govInfo": {
      /* ... */
    },
    "emergencyContact": [
      /* ... */
    ]
  }
}
```

---

## 3. Child Collection Endpoints

Instead of one massive update payload, the Employee Profile allows atomic additions/updates/removals to collection arrays.

**Common Pattern:**
`[Method] /api/v1/employees/:id/[collection_name]`

### Education

- `POST /api/v1/employees/:id/education`: Add degree
- `DELETE /api/v1/employees/:id/education/:educationId`: Soft delete degree

### Experience

- `POST /api/v1/employees/:id/experience`: Add past job
- `DELETE /api/v1/employees/:id/experience/:expId`: Soft delete past job

### Assets

- `POST /api/v1/employees/:id/assets`: Assign corporate asset
- `DELETE /api/v1/employees/:id/assets/:assetId`: Return asset

### Documents (Linking existing Documents from S3 Upload Flow)

- `POST /api/v1/employees/:id/documents`: Link a `docId`
- `DELETE /api/v1/employees/:id/documents/:docId`: Unlink document

### Gov Info & Bank Info (1-to-1 Upserts)

- `PUT /api/v1/employees/:id/gov-info`: Upsert PAN/UAN/Aadhaar/Passport
- `PUT /api/v1/employees/:id/bank-info`: Upsert Account Details

### Status Transitions

- `POST /api/v1/employees/:id/exit`: Initiate Resignation/Termination. Will trigger state changes to exit flags.
- `DELETE /api/v1/employees/:id`: Hard-soft-delete of both Identity and Profile layers.
