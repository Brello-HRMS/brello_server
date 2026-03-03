# Notification APIs (In-App)

Base path: `/api/v1/notifications`

Manages in-app notifications for the authenticated user. All endpoints require Bearer JWT authentication.

---

## 1. Get All Notifications

Returns all active in-app notifications for the current user.

|            |                         |
| ---------- | ----------------------- |
| **Method** | `GET`                   |
| **URL**    | `/api/v1/notifications` |
| **Auth**   | Bearer `<access_token>` |
| **Status** | `200 OK`                |

**Request Body:** None

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "nn0e8400-e29b-41d4-a716-446655440001",
      "title": "Leave Approved",
      "message": "Your leave request for Mar 10–12 has been approved.",
      "is_read": false,
      "created_at": "2026-03-03T10:00:00.000Z"
    }
  ],
  "timestamp": "2026-03-03T10:00:00.000Z"
}
```

---

## 2. Get Unread Notifications

Returns only unread in-app notifications for the current user.

|            |                                |
| ---------- | ------------------------------ |
| **Method** | `GET`                          |
| **URL**    | `/api/v1/notifications/unread` |
| **Auth**   | Bearer `<access_token>`        |
| **Status** | `200 OK`                       |

**Request Body:** None

**Response:** Same shape as Get All, but filtered to `is_read: false`.

---

## 3. Mark Notification as Read

Marks a specific notification as read for the current user.

|            |                                  |
| ---------- | -------------------------------- |
| **Method** | `PATCH`                          |
| **URL**    | `/api/v1/notifications/:id/read` |
| **Auth**   | Bearer `<access_token>`          |
| **Status** | `200 OK`                         |

**Path Parameters:**

| Parameter | Type | Description     |
| --------- | ---- | --------------- |
| `id`      | UUID | Notification ID |

**Response:**

```json
{
  "success": true
}
```

**Error Responses:**

| Status            | Condition              |
| ----------------- | ---------------------- |
| `400 Bad Request` | Invalid UUID format    |
| `404 Not Found`   | Notification not found |

---

## 4. Mark All Notifications as Read

Marks all notifications as read for the current user.

|            |                                  |
| ---------- | -------------------------------- |
| **Method** | `PATCH`                          |
| **URL**    | `/api/v1/notifications/read-all` |
| **Auth**   | Bearer `<access_token>`          |
| **Status** | `200 OK`                         |

**Request Body:** None

**Response:**

```json
{
  "success": true
}
```
