# Document APIs

Base path: `/api/v1/documents`

Manages secure asset uploading directly to S3 via pre-signed URLs.

---

## 1. Generate Upload URL

Generates a short-lived S3 pre-signed upload URL for direct-to-S3 client uploading to dynamically mapped folders based on tenant relationships. Also tracks the file metadata in Postgres as INACTIVE.

|            |                                |
| ---------- | ------------------------------ |
| **Method** | `POST`                         |
| **URL**    | `/api/v1/documents/upload-url` |
| **Auth**   | Required                       |
| **Status** | `201 Created`                  |

**Request Body:**

| Field            | Type   | Required | Validation                                                                                             | Description                              |
| ---------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `originalName`   | string | ✅       | None                                                                                                   | Original filename (e.g., photo.jpg)      |
| `mimeType`       | string | ✅       | None                                                                                                   | File MIME (e.g., image/jpeg)             |
| `size`           | number | ✅       | None                                                                                                   | File size in bytes                       |
| `folderType`     | enum   | ✅       | `ENTERPRISE_LOGO`, `ORGANIZATION_LOGO`, `EMPLOYEE_IMAGE`, `EMPLOYEE_DOCUMENT`, `ORGANIZATION_DOCUMENT` | Controls backend S3 directory structures |
| `enterpriseId`   | UUID   | ✅       | UUID                                                                                                   | Root partition check                     |
| `organizationId` | UUID   | ❌       | UUID                                                                                                   | Secondary partition check                |
| `employeeId`     | string | ❌       | String                                                                                                 | Third-level partition check              |

**Response:**

```json
{
  "success": true,
  "data": {
    "documentId": "1a2b3c...",
    "uploadUrl": "https://s3.amazonaws.com/your-bucket/enterprise/logo/uuid.jpg?X-Amz-Signature=...",
    "objectKey": "enterprise/logo/uuid.jpg",
    "expiresIn": 300
  }
}
```

---

## 2. Confirm Upload

Validates that the upload completed and activates the Document tracking entity so that it can be assigned to modules via `document_id`.

|            |                                 |
| ---------- | ------------------------------- |
| **Method** | `POST`                          |
| **URL**    | `/api/v1/documents/:id/confirm` |
| **Auth**   | Required                        |
| **Status** | `200 OK`                        |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "1a2b3c...",
    "url": "https://your-bucket.s3.us-east-1.amazonaws.com/enterprise/logo/uuid.jpg",
    "status": "ACTIVE"
  }
}
```

---

## 3. Generate Signed Download URL

Retrieves a short-lived URL for downloading a protected enterprise file. Only succeeds if status is `ACTIVE`.

|            |                                    |
| ---------- | ---------------------------------- |
| **Method** | `GET`                              |
| **URL**    | `/api/v1/documents/:id/signed-url` |
| **Auth**   | Required                           |
| **Status** | `200 OK`                           |

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://s3.amazonaws.com/your-bucket/enterprise/logo/uuid.jpg?X-Amz-Signature=..."
  }
}
```
