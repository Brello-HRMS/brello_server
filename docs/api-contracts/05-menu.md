# Menu API (RBAC)

Base path: `/api/v1/menu`

Returns the authenticated user's accessible module tree for their currently active application. The tree is filtered based on RBAC role permissions and plan restrictions.

---

## 1. Get Menu

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/menu` |
| **Auth** | Bearer `<access_token>` |
| **Status** | `200 OK` |

**Request Body:** None

**How it works:**

The endpoint reads `userId`, `organizationId`, and `appId` from the JWT payload and calls the `PermissionResolverService` to compute the effective module tree:

1. Fetches the user's active roles for the current org + app
2. OR-aggregates permissions across all roles
3. AND-restricts against the organization's subscription plan
4. Propagates access up the WBS hierarchy (child access ⟹ parent gets `view`)
5. Strips modules with no effective actions
6. Builds a hierarchical tree sorted by WBS codes

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "mod-001-uuid",
      "name": "Human Resources",
      "wbs_code": "1",
      "actions": ["view"],
      "children": [
        {
          "id": "mod-002-uuid",
          "name": "Leave Management",
          "wbs_code": "1.1",
          "actions": ["view", "create", "update", "approve"],
          "children": []
        },
        {
          "id": "mod-003-uuid",
          "name": "Attendance",
          "wbs_code": "1.2",
          "actions": ["view", "create"],
          "children": []
        }
      ]
    },
    {
      "id": "mod-004-uuid",
      "name": "Payroll",
      "wbs_code": "2",
      "actions": ["view"],
      "children": []
    }
  ],
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

**Menu Node Structure:**

| Field | Type | Description |
|---|---|---|
| `id` | string (UUID) | Module ID |
| `name` | string | Module display name |
| `wbs_code` | string | Hierarchical ordering code (e.g., `1`, `1.1`, `1.1.2`) |
| `actions` | string[] | Permitted actions for this module |
| `children` | MenuNode[] | Nested child modules (recursive tree structure) |

**Available Actions:**

| Action | Description |
|---|---|
| `view` | Read/view access |
| `create` | Create new records |
| `update` | Modify existing records |
| `delete` | Remove records |
| `approve` | Approve/reject workflows |
| `export` | Export/download data |

**Error Responses:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | Invalid or expired access token |

**Notes:**

- The menu tree only includes modules the user can actually access — there are no "hidden" or "disabled" nodes.
- Parent modules automatically get `view` action if any child module has access (WBS hierarchy propagation).
- The tree is sorted by `wbs_code` at each level using natural numeric ordering.
- Switching apps (via `/auth/switch-app`) changes the menu tree since different apps have different modules and roles.
