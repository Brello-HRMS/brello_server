# PRD Addendum — Cost Optimized Global Search (Bootstrapped V1)

# Objective

Build a production-grade global search system for Brello that is:

✅ Cheap to operate
✅ Easy to maintain
✅ Scalable enough for early-stage growth
✅ Upgradeable later without rewrite
✅ Minimal infrastructure dependent

This version should support:

- Small → medium organizations
- Thousands of employees
- Multi-tenant architecture
- RBAC filtering
- Fast UX

WITHOUT introducing expensive infrastructure like:

- OpenSearch clusters
- Kafka
- Elastic Cloud
- Dedicated search infrastructure

---

# Core Philosophy for V1

DO NOT optimize for:

- millions of records
- AI search
- distributed indexing
- enterprise-scale search

OPTIMIZE FOR:

- simplicity
- maintainability
- low DevOps cost
- fast development
- future migration path

---

# Recommended V1 Architecture

```txt
Frontend Search Modal
        ↓
Search API
        ↓
PostgreSQL Full Text Search
        ↓
Search Documents Table
```

---

# V1 Recommended Stack

| Layer    | Technology        | Reason         |
| -------- | ----------------- | -------------- |
| DB       | PostgreSQL        | Already exists |
| Search   | PostgreSQL FTS    | Free           |
| Queue    | DB Queue / BullMQ | Cheap          |
| Backend  | NestJS            | Existing stack |
| Cache    | Redis (optional)  | Cheap          |
| Frontend | React             | Existing       |
| State    | Zustand           | Lightweight    |

---

# IMPORTANT DESIGN DECISION

## DO NOT SEARCH ACTUAL MODULE TABLES

Even in V1.

Instead:

✅ Create ONE centralized searchable table.

This is CRITICAL because:

- migration to OpenSearch later becomes easy
- search logic remains centralized
- permissions become consistent
- avoids massive refactor later

---

# V1 Search Table Design

# Table: `global_search_documents`

```sql
CREATE TABLE global_search_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL,

    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,

    module_key TEXT NOT NULL,

    title TEXT NOT NULL,
    subtitle TEXT,

    keywords TEXT,

    route TEXT NOT NULL,

    permissions TEXT[],

    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,

    metadata JSONB,

    search_vector tsvector,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

# Why This Design?

Because later:

```txt
Postgres Search
      ↓
OpenSearch
```

Only indexing layer changes.

Frontend and APIs remain SAME.

Huge future savings.

---

# Required Indexes

CRITICAL.

```sql
CREATE INDEX idx_search_tenant
ON global_search_documents(tenant_id);

CREATE INDEX idx_search_entity
ON global_search_documents(entity_type);

CREATE INDEX idx_search_vector
ON global_search_documents
USING GIN(search_vector);

CREATE INDEX idx_search_active
ON global_search_documents(is_active);
```

---

# Search Vector Strategy

Use PostgreSQL Full Text Search.

---

# Example

```sql
UPDATE global_search_documents
SET search_vector =
    to_tsvector(
        'simple',
        coalesce(title, '') || ' ' ||
        coalesce(subtitle, '') || ' ' ||
        coalesce(keywords, '')
    );
```

---

# V1 Search Query

```sql
SELECT *
FROM global_search_documents
WHERE tenant_id = $1
AND is_active = true
AND is_deleted = false
AND search_vector @@ plainto_tsquery($2)
LIMIT 10;
```

---

# Fuzzy Search (Cheap Version)

Postgres alone is weak for typo tolerance.

Use:

## pg_trgm extension

FREE.

---

# Enable Extension

```sql
CREATE EXTENSION pg_trgm;
```

---

# Trigram Index

```sql
CREATE INDEX idx_title_trgm
ON global_search_documents
USING GIN(title gin_trgm_ops);
```

---

# Fuzzy Query

```sql
SELECT *
FROM global_search_documents
WHERE similarity(title, $query) > 0.3
ORDER BY similarity(title, $query) DESC;
```

---

# Why This Works for V1

Supports:

- typo correction
- partial matches
- autocomplete feel

WITHOUT ElasticSearch.

---

# V1 Search Features

| Feature             | Support |
| ------------------- | ------- |
| Exact match         | ✅      |
| Prefix search       | ✅      |
| Typo tolerance      | ✅      |
| Multi-tenant        | ✅      |
| RBAC filtering      | ✅      |
| Grouped results     | ✅      |
| Recent searches     | ✅      |
| Keyboard navigation | ✅      |
| Search-as-you-type  | ✅      |

---

# What NOT To Build in V1

# DO NOT BUILD

❌ OpenSearch cluster
❌ Kafka
❌ Microservice search infra
❌ Distributed indexing
❌ AI embeddings
❌ Vector DB
❌ Real-time streaming indexing

All unnecessary now.

---

# Updated Indexing Strategy

# V1 Strategy

Use:

- synchronous DB updates
  OR
- lightweight async queue

---

# BEST OPTION

Use lightweight async jobs.

---

# Recommended

## BullMQ + Redis

Cheap and simple.

---

# Flow

```txt
Employee Updated
      ↓
Queue Job Created
      ↓
Search Worker
      ↓
Update Search Table
```

---

# Why Queue Still Matters

Avoid:

- blocking user requests
- search update failures breaking core flow

---

# Queue Jobs

| Event            | Action      |
| ---------------- | ----------- |
| employee.created | insert      |
| employee.updated | update      |
| employee.deleted | soft delete |

---

# Worker Example

```ts
await globalSearchRepo.upsert({
  tenant_id,
  entity_type: 'employee',
  title: employee.name,
  subtitle: employee.designation,
});
```

---

# V1 Module Registry

Keep SIMPLE.

---

# Static Config File

```ts
export const searchableModules = [
  {
    module: 'employees',
    permission: 'employee.read',
    route: '/employees',
  },
];
```

No need for dynamic plugin architecture yet.

---

# V1 Permission Strategy

Keep it SIMPLE.

---

# Search Filtering

When searching:

```ts
WHERE permissions && userPermissions
```

AND

```ts
tenant_id = currentTenant;
```

---

# NEVER TRUST FRONTEND

Even in V1.

---

# Recent Search Table

```sql
CREATE TABLE recent_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,

    query TEXT,

    entity_id TEXT,
    entity_type TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# Recent Search Rules

Store:

- last 10 searches per user

Auto cleanup:

- cron daily

---

# Frontend Architecture (V1)

Keep lightweight.

---

# Components

```txt
SearchModal
SearchInput
SearchResults
RecentSearches
SearchItem
```

---

# State Management

Use:

- Zustand

NOT Redux.

---

# Search Flow

```txt
Type
  ↓
Debounce 200ms
  ↓
Cancel previous request
  ↓
Fetch search
  ↓
Render grouped results
```

---

# IMPORTANT UX OPTIMIZATIONS

# 1. Debounce

200ms

Mandatory.

---

# 2. AbortController

Cancel old requests.

Mandatory.

---

# 3. Top Results Only

DO NOT SHOW:

- 100 results

Show:

- top 5 modules
- top 10 entities

---

# 4. Preload Recent Searches

When modal opens:

- instantly show recents

Feels fast.

---

# V1 Result Ranking

Keep SIMPLE.

---

# Ranking Formula

```txt
Exact Match
↓
Starts With
↓
Contains
↓
Recent Clicked
↓
Trigram Similarity
```

---

# API Design (V1)

# Search API

```http
GET /search?q=john
```

---

# Response

```json
{
  "modules": [
    {
      "label": "Employees",
      "route": "/employees"
    }
  ],

  "results": [
    {
      "id": "emp_1",
      "type": "employee",
      "title": "John Doe",
      "subtitle": "Frontend Engineer",
      "route": "/employees/1"
    }
  ]
}
```

---

# Save Recent Search

```http
POST /search/recent
```

---

# V1 Security Requirements

MANDATORY.

| Requirement           | Why                   |
| --------------------- | --------------------- |
| tenant filtering      | prevent leakage       |
| RBAC filtering        | secure data           |
| soft delete filtering | hide deleted          |
| active filtering      | avoid invalid results |

---

# V1 Performance Targets

| Metric             | Target |
| ------------------ | ------ |
| Search response    | <300ms |
| Modal open         | <100ms |
| Query result count | max 10 |

---

# Scaling Plan (IMPORTANT)

# Stage 1 (Now)

```txt
Postgres FTS
```

Supports:

- ~500K searchable records comfortably

Enough for early Brello.

---

# Stage 2 (Growth)

Move ONLY indexing/search layer to:

```txt
OpenSearch
```

WITHOUT changing:

- frontend
- APIs
- modal UX
- search document structure

---

# Migration Strategy

Because V1 uses:

- centralized search table
- unified documents

Migration becomes:

```txt
DB Table
   ↓
OpenSearch Index
```

Easy.

---

# Estimated Monthly Cost

# V1

| Service      | Cost     |
| ------------ | -------- |
| PostgreSQL   | Existing |
| Redis        | $5–10    |
| BullMQ       | Free     |
| Search infra | $0       |
| Queue infra  | $0       |

Total:
≈ almost free.

---

# Final Recommendation

# Build NOW

✅ PostgreSQL Full Text Search
✅ pg_trgm
✅ centralized search table
✅ BullMQ async indexing
✅ RBAC filtering
✅ unified search documents
✅ lightweight architecture

---

# Upgrade LATER

❌ OpenSearch
❌ Kafka
❌ AI search
❌ vector DB

Only after:

- real scale
- paying customers
- infra budget

---

# Final Bootstrapped Architecture

```txt
React Modal
    ↓
NestJS Search API
    ↓
Postgres FTS + pg_trgm
    ↓
global_search_documents

Async Sync:
App Events
    ↓
BullMQ
    ↓
Search Worker
    ↓
Update Search Table
```

---

# Implementation Status (V1 — Completed)

## What Was Built

### Server (`brello_server/src/modules/global-search/`)

| File | Responsibility |
| ---- | -------------- |
| `entities/global-search-document.entity.ts` | TypeORM entity for the centralized index table |
| `entities/recent-search.entity.ts` | Per-user recent search history |
| `repositories/global-search-document.repository.ts` | Raw SQL upsert + combined FTS + trigram search query |
| `repositories/recent-search.repository.ts` | Save recent search, trim to 10 per user |
| `services/search-database-init.service.ts` | Runs on `OnApplicationBootstrap` — enables pg_trgm, adds `search_vector tsvector` column, creates GIN indexes, adds unique constraint |
| `services/search-indexing.service.ts` | Fire-and-forget upsert/soft-delete — failures never block core employee operations |
| `services/search-query.service.ts` | Search logic, recent search CRUD |
| `services/search-cleanup.service.ts` | Daily cron (`@Cron EVERY_DAY_AT_MIDNIGHT`) — deletes recent searches older than 30 days |
| `controllers/search.controller.ts` | `GET /search?q=`, `GET /search/recent`, `POST /search/recent` |
| `config/searchable-modules.ts` | Static module registry — add new entity types here |

### Employee Indexing Hooks (`user/services/employee.service.ts`)

| Event | Handler | Search Action |
| ----- | ------- | ------------- |
| `createEmployee` | After transaction commit | `indexEmployee()` |
| `updateBasicInfo` | After name fields change | `indexEmployee()` |
| `softDeleteEmployee` | After soft delete | `removeEmployee()` |

### Frontend (`brello_webapp/src/features/search/`)

| File | Responsibility |
| ---- | -------------- |
| `types/search.types.ts` | Shared TypeScript interfaces matching API response wrapper |
| `api/search.ts` | Typed API calls with AbortSignal for React Query cancellation |
| `store/search.store.ts` | Zustand store — modal open/close only, no query state |
| `hooks/useSearch.ts` | React Query + 200ms debounce + AbortSignal cancellation |
| `hooks/useRecentSearches.ts` | Fetch recents + `useSaveRecentSearch` mutation |
| `components/SearchModal/` | Command-palette modal, keyboard nav (↑↓ Enter Esc) |
| `components/SearchInput/` | Input with clear button |
| `components/SearchResults/` | Grouped results — modules (button nav) + result items |
| `components/SearchItem/` | Individual result row with entity icon |
| `components/RecentSearches/` | Recent history list |

**Trigger:** Sidebar search bar click + global `⌘ /` keyboard shortcut (registered in `MainLayout`).
**Mount point:** `SearchModal` rendered inside `MainLayout` via portal-like pattern.

---

## Key Implementation Decisions

### 1. `OnApplicationBootstrap` instead of `OnModuleInit`

`SearchDatabaseInitService` uses `OnApplicationBootstrap` because TypeORM's schema synchronization
completes during module initialization. `OnModuleInit` hooks across different modules run concurrently
via `Promise.all`, which caused a race condition where our `ALTER TABLE` ran before TypeORM created
the base table. `OnApplicationBootstrap` is guaranteed to run after ALL `onModuleInit` hooks settle.

### 2. Schema-Aware Table Names

All raw SQL queries use `getTableName()` which reads the schema from TypeORM entity metadata:

```ts
private getTableName(): string {
  const metadata = this.dataSource.getMetadata(GlobalSearchDocument);
  return metadata.schema
    ? `"${metadata.schema}"."${metadata.tableName}"`
    : `"${metadata.tableName}"`;
}
```

This is critical because Brello uses separate PostgreSQL schemas per environment
(`brello_dev`, `brello_uat`, `brello_prod`). Hardcoded table names without schema
qualification would fail silently in multi-schema deployments.

### 3. Fire-and-Forget Indexing

`SearchIndexingService` methods are synchronous callers (`void` return) that internally
call `.catch()` on the async repository operation. This means:

- Core employee CRUD never blocks on search indexing
- Indexing failures are logged as warnings, not thrown
- No BullMQ required in V1 (can be added later without changing the interface)

```ts
this.searchDocumentRepository.upsert({...}).catch((err) => {
  this.logger.warn(`Failed to index employee: ${err.message}`);
});
```

### 4. Combined FTS + Trigram Search

The search query ranks results using a multi-signal formula:

```sql
CASE
  WHEN LOWER(title) = LOWER($query)            THEN 4  -- exact match
  WHEN LOWER(title) LIKE LOWER($query) || '%'  THEN 3  -- prefix match
  WHEN LOWER(title) LIKE '%' || LOWER($query)  THEN 2  -- contains
  ELSE 1
END AS match_rank,
ts_rank(search_vector, plainto_tsquery('simple', $query)) AS ts_rank_score,
similarity(title, $query) AS trgm_score
```

Results must match EITHER FTS (`search_vector @@`) OR trigram (`similarity > 0.2`).
Ordered by `match_rank DESC, ts_rank_score DESC, trgm_score DESC`.

### 5. API Response Shape

All API responses are wrapped by the global `TransformInterceptor`:

```json
{ "success": true, "data": { "modules": [...], "results": [...] }, "timestamp": "..." }
```

Frontend types account for this wrapper in `SearchResponse.data.*`.

---

## To Add a New Searchable Entity

### Server

1. Inject `SearchIndexingService` in the entity's service
2. Call `searchDocumentRepository.upsert({...})` after create/update
3. Call `searchDocumentRepository.softDelete(...)` after delete
4. Add entry to `config/searchable-modules.ts`

### Frontend

No changes needed — the modal renders any `entity_type` automatically.
Add an icon to `ENTITY_ICONS` in `SearchItem.tsx` for a custom icon.

---

## Known Gaps — V2 Candidates

| Gap | Status | Effort |
| --- | ------ | ------ |
| BullMQ async queue for indexing | Not built — fire-and-forget works for V1 | Medium |
| Full RBAC permission filtering in search query | Partial — tenant isolation done, per-permission filtering TODO | Medium |
| Designation/department in search subtitle | Not indexed — only name + email | Low |
| Re-index on employment details change | Not done — only name changes trigger reindex | Low |
| Search analytics / click-through tracking | Not built | High |
| Collapsed sidebar search icon → modal trigger | Not built — only expanded sidebar shows search bar | Low |
