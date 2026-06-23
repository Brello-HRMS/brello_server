import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface AuditRequestContext {
  actorId: string;
  isPlatformAdmin: boolean;
  enterpriseId: string;
  organizationId: string;
  ip?: string;
  userAgent?: string;
  // Populated by service layer before an UPDATE mutation runs
  preValue?: Record<string, unknown>;
  // Populated for bulk operations
  bulkEntities?: Array<{ id: string; displayName?: string }>;
}

/**
 * Carries per-request audit context using Node's AsyncLocalStorage.
 * Set up by AuditInterceptor at the start of each HTTP request.
 *
 * Service-layer callers use setPreValue() to store the old record
 * before running an UPDATE — the interceptor then picks it up automatically.
 */
@Injectable()
export class AuditContextService {
  private readonly storage = new AsyncLocalStorage<AuditRequestContext>();

  run(context: AuditRequestContext, fn: () => void): void {
    this.storage.run(context, fn);
  }

  getContext(): AuditRequestContext | undefined {
    return this.storage.getStore();
  }

  setPreValue(value: Record<string, unknown>): void {
    const ctx = this.storage.getStore();
    if (ctx) ctx.preValue = value;
  }

  setBulkEntities(entities: Array<{ id: string; displayName?: string }>): void {
    const ctx = this.storage.getStore();
    if (ctx) ctx.bulkEntities = entities;
  }
}
