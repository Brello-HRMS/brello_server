# Client Module — API Contracts

## 1. Create Client

`POST /clients`

Creates a new client record within the user's organization.

### Request Body

```json
{
  "name": "Acme Corp",
  "poc_name": "John Doe",
  "poc_email": "john@acme.com",
  "poc_phone": "+1234567890",
  "address": "123 Acme St, City, Country",
  "status": "ACTIVE",
  "logo": "https://brand.acme.com/logo.png"
}
```

### Response (201 Created)

```json
{
  "id": "uuid",
  "name": "Acme Corp",
  "poc_name": "John Doe",
  "poc_email": "john@acme.com",
  "poc_phone": "+1234567890",
  "address": "123 Acme St, City, Country",
  "status": "ACTIVE",
  "logo": "https://brand.acme.com/logo.png",
  "org_id": "uuid",
  "created_at": "timestamp"
}
```

---

## 2. Get All Clients

`GET /clients`

Returns a paginated list of clients for the current organization.

### Query Parameters

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search by name or email
- `status`: Filter by status (`ACTIVE`, `INACTIVE`)
- `sortBy`: Field to sort by
- `sortOrder`: `ASC` or `DESC`

### Response (200 OK)

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "poc_name": "John Doe",
      "status": "ACTIVE",
      "projects_count": 5
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

## 3. Get Client by ID

`GET /clients/:id`

### Response (200 OK)

```json
{
  "id": "uuid",
  "name": "Acme Corp",
  "poc_name": "John Doe",
  "poc_email": "john@acme.com",
  "status": "ACTIVE",
  "logo": "url",
  "projects": []
}
```

---

## 4. Update Client

`PATCH /clients/:id`

### Request Body

```json
{
  "name": "Acme Corporation",
  "status": "INACTIVE"
}
```

### Response (200 OK)

```json
{
  "id": "uuid",
  "name": "Acme Corporation",
  "status": "INACTIVE"
}
```

---

## 5. Delete Client

`DELETE /clients/:id`

Soft deletes the client record.

### Response (200 OK)

```json
{
  "success": true,
  "message": "Client deleted successfully"
}
```
