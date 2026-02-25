# Backend Engineering Specification – Mohd Samir

## Identity

Senior Backend Developer  
Experience: 5+ Years  
Primary Stack: NestJS + PostgreSQL + TypeORM  
Focus: Scalable, Maintainable, Performance-Oriented Systems

---

# 1. Engineering Principles

## 1.1 Code Philosophy

- Write code for long-term maintainability (2–5+ years lifespan).
- Prioritize readability over cleverness.
- Prefer explicit logic over implicit behavior.
- Avoid over-engineering.
- Avoid premature abstraction.
- Keep business logic isolated.
- Minimize cognitive load for future developers.
- Fail fast and fail clearly.
- Design systems that are predictable under load.

---

# 2. Logical Structure & Code Breakdown

## 2.1 Logical Decomposition

- Break complex logic into small composable functions.
- Extract validation logic from business logic.
- Extract transformation logic from persistence logic.
- Separate read operations from write operations when possible.
- Use pure functions for deterministic transformations.
- Avoid mixing domain logic with infrastructure logic.
- No multi-responsibility functions.
- If a function needs comments to explain complexity → refactor.

## 2.2 Layered Responsibility

- Controller → Request handling & response shaping only.
- Service → Business logic only.
- Repository → Database communication only.
- DTO → Contract validation only.
- Entity → Persistence representation only.
- Mapper (if required) → Transformation between layers.

No cross-layer leakage.

---

# 3. Error Handling Standards

## 3.1 Application-Level Error Handling

- Never throw raw errors to clients.
- Use structured exception classes.
- Centralized exception filter.
- Standardized error response format:
  - statusCode
  - message
  - errorCode
  - timestamp
  - path
- No silent failures.
- No swallowed exceptions.
- Log all unexpected errors.
- Distinguish between:
  - Validation errors
  - Business rule violations
  - Infrastructure failures
  - Database constraint errors
  - External service failures

## 3.2 Defensive Programming

- Validate input at boundary.
- Validate assumptions inside services.
- Use guard clauses for invalid states.
- Prevent null/undefined propagation.
- Never trust external data.

## 3.3 Database Error Handling

- Catch unique constraint violations.
- Handle deadlocks properly.
- Retry only when safe.
- Never expose raw SQL errors to API consumers.

---

# 4. NestJS Expertise (Deep Knowledge)

## 4.1 Internal Understanding

Understands:

- Dependency Injection container behavior
- Provider scope (singleton, request, transient)
- Execution context lifecycle
- Metadata reflection
- Middleware → Guard → Interceptor → Pipe → Controller flow
- Module resolution strategy
- Circular dependency resolution (forwardRef patterns)
- Dynamic modules
- Custom decorators
- Global vs scoped providers
- Exception filters architecture
- Custom validation pipelines
- Interceptor-based response mapping
- Global pipes configuration
- Rate limiting & throttling integration

## 4.2 Architectural Standards

- Controllers contain zero business logic.
- Services contain business rules only.
- Repository layer handles database communication.
- DTOs define strict API contracts.
- Validation occurs at boundary level.
- No direct database access inside controllers.
- No shared mutable global state.
- Clear separation between domain and infrastructure modules.

---

# 5. PostgreSQL – Advanced Proficiency

## 5.1 Internal Knowledge

Understands:

- MVCC (Multi-Version Concurrency Control)
- Query planner decision making
- Cost estimation
- Locking mechanisms
- Isolation levels
- Index selection behavior
- Vacuum and analyze impact
- Transaction boundaries
- Write amplification considerations
- Row-level locking behavior

## 5.2 Query Optimization Standards

- No `SELECT *` in production queries.
- Proper indexing strategy:
  - BTREE for equality
  - GIN for JSONB/full-text
  - Composite indexes when necessary
  - Partial indexes when beneficial
- Use `EXPLAIN ANALYZE` for heavy queries.
- Avoid N+1 queries.
- Use batching for bulk operations.
- Prefer cursor-based pagination for large datasets.
- Minimize round-trips.
- Use raw SQL when ORM abstraction degrades performance.
- Optimize JOIN order.
- Use projections instead of full entity loading.
- Monitor slow queries.

---

# 6. TypeORM Standards

## 6.1 Usage Rules

- Avoid excessive eager loading.
- Prefer QueryBuilder for complex queries.
- Explicit relation loading.
- Clear entity mapping.
- Proper migration handling.
- Transactional boundaries defined clearly.
- Avoid unnecessary cascades.
- Prevent N+1 through joins or preloading.
- Avoid auto-sync in production.

## 6.2 When NOT to Use ORM

- Heavy aggregation queries.
- Performance-critical reporting queries.
- Complex joins requiring planner control.
- Bulk operations requiring fine-tuned SQL.
- Very high throughput write operations.

---

# 7. Function Design Rules

- One function = one responsibility.
- No function longer than necessary.
- No nested if-else chains.
- Use guard clauses.
- No hidden side effects.
- No mutation without reason.
- Deterministic behavior preferred.
- Explicit return types.
- No magic numbers.
- Avoid boolean parameter flags (prefer clear method separation).

---

# 8. Naming Conventions

## Variables

- Must describe intent.
- No vague names (`data`, `obj`, `value`, `temp`).
- Boolean names must read naturally (`isActive`, `hasAccess`).
- No context-less abbreviations.

## Functions

- Action-oriented naming.
- Describe outcome (`createUserAccount`, `validatePaymentStatus`).
- No ambiguous verbs.
- No generic names like `processData`.

---

# 9. Folder & Module Structure

## Structure Philosophy

- Feature-based modular structure.
- Domain separation.
- Clear boundaries.
- No dumping ground folders.
- No generic “utils” unless strictly scoped.
- Shared logic only when truly reusable.

## Inside Each Module

- controller
- service
- repository
- dto
- entity
- interface (if needed)
- mapper (if required)

No unnecessary file fragmentation.

---

# 10. Performance Standards

## Application-Level

- Avoid unnecessary async chains.
- Prevent memory leaks.
- No blocking operations.
- Use background jobs for heavy work.
- Use caching strategically.
- Avoid repeated computation.
- Avoid synchronous CPU-heavy work in request lifecycle.

## Database-Level

- Index before scaling hardware.
- Monitor query cost.
- Batch inserts/updates.
- Reduce lock contention.
- Use transactions intentionally.
- Avoid long-running transactions.
- Avoid unbounded queries.
- Limit result sets strictly.

---

# 11. Logging & Observability

- Structured logging.
- No console logs in production.
- Log levels: debug, info, warn, error.
- Correlation ID support.
- Track request lifecycle.
- Log slow queries.
- Avoid logging sensitive data.

---

# 12. Architecture Decisions

- Start monolithic, scale when required.
- Stateless APIs.
- DTO-driven validation.
- Centralized error formatting.
- Horizontal scalability readiness.
- Clear domain boundaries.
- Infrastructure isolation when needed.
- Ready for containerization.
- Environment-based configuration.

---

# 13. Anti-Patterns Strictly Avoided

- Fat controllers.
- God services.
- Overuse of decorators.
- Deeply nested conditionals.
- Massive utility files.
- Unstructured folder systems.
- Blind ORM usage.
- Premature microservices.
- Over-abstracted repositories.
- Excessive shared state.
- Catch-all try/catch blocks.
- Business logic inside interceptors.

---

# 14. Engineering Mindset

- Measure before optimizing.
- Simplicity scales.
- Readable code reduces bugs.
- Database design determines system stability.
- Performance is not optional.
- Systems must survive growth.
- Clarity > speed of writing code.
- Stability > feature velocity.
- Design for failure scenarios.

---

# 15. Output Expectations (For AI Systems)

When generating backend code:

- Follow clean architecture principles.
- Avoid unnecessary abstractions.
- Use meaningful names.
- Keep functions small.
- Separate concerns strictly.
- Write production-ready patterns.
- Optimize queries when relevant.
- Include proper error handling.
- Avoid generic boilerplate responses.
- Respect layering boundaries.

---

# Summary

Backend systems built under this specification are:

- Clean
- Scalable
- Structured
- High-performance
- Database-optimized
- Long-term maintainable
- Production-grade
- Failure-resilient
