import {
  Injectable,
  Logger,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_SERVICE_TOKEN } from '../interfaces/audit-service.interface';
import type { IAuditService } from '../interfaces/audit-service.interface';
import { AuditContextService } from '../services/audit-context.service';
import {
  AUDIT_METADATA_KEY,
  AuditLogMetadata,
} from '../decorators/audit-log.decorator';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    @Inject(AUDIT_SERVICE_TOKEN)
    private readonly auditService: IAuditService,
    private readonly auditContext: AuditContextService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditLogMetadata>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.loggedInUser;
    if (!user) return next.handle();

    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      request.ip;
    const auditCtx = {
      actorId: user.userId,
      isPlatformAdmin: user.isPlatformAdmin,
      enterpriseId: user.enterpriseId,
      organizationId: user.organizationId,
      ip,
      userAgent: request.headers['user-agent'] as string,
    };

    return new Observable((subscriber) => {
      this.auditContext.run(auditCtx, () => {
        next
          .handle()
          .pipe(tap((response) => this.fireLog(user, meta, request, response)))
          .subscribe(subscriber);
      });
    });
  }

  /**
   * AuditInterceptor runs inside TransformInterceptor (which is registered via
   * useGlobalInterceptors and therefore outermost). The tap() callback therefore
   * receives the already-wrapped { success, data, timestamp } shape. Unwrap it
   * so we store the raw entity, not the HTTP envelope.
   */
  private unwrapPayload(response: unknown): unknown {
    if (response !== null && typeof response === 'object') {
      const r = response as Record<string, unknown>;
      if ('success' in r && 'data' in r && 'timestamp' in r) {
        return r['data'];
      }
    }
    return response;
  }

  private fireLog(
    user: any,
    meta: AuditLogMetadata,
    request: any,
    response: unknown,
  ): void {
    const ctx = this.auditContext.getContext();

    if (ctx?.bulkEntities?.length) {
      for (const entity of ctx.bulkEntities) {
        void this.buildAndLog(
          user,
          meta,
          entity.id,
          entity.displayName,
          undefined,
        );
      }
      return;
    }

    const payload = this.unwrapPayload(response);
    const items = Array.isArray(payload) ? payload : [payload];
    for (const entity of items) {
      const e = entity as Record<string, unknown> | null | undefined;
      const entityId =
        (e?.['id'] as string | undefined) ??
        (request.params?.[meta.entityIdParam] as string | undefined) ??
        (request.body?.id as string | undefined);

      if (!entityId) {
        this.logger.warn(
          `AuditInterceptor: no entity_id for ${meta.module}.${meta.action} — ` +
            `response has no 'id' and param '${meta.entityIdParam}' is absent`,
        );
        continue;
      }

      // For DELETE the response is void — fall back to preValue for display name
      const ctx = this.auditContext.getContext();
      const pre = ctx?.preValue;
      const displayName =
        (e?.['name'] as string | undefined) ??
        (e?.['full_name'] as string | undefined) ??
        (e?.['title'] as string | undefined) ??
        (e?.['code'] as string | undefined) ??
        (pre?.['name'] as string | undefined) ??
        (pre?.['full_name'] as string | undefined) ??
        (pre?.['title'] as string | undefined) ??
        (pre?.['code'] as string | undefined);

      void this.buildAndLog(user, meta, entityId, displayName, e ?? undefined);
    }
  }

  private async buildAndLog(
    user: any,
    meta: AuditLogMetadata,
    entityId: string,
    displayName: string | undefined,
    newValue: Record<string, unknown> | undefined,
  ): Promise<void> {
    const ctx = this.auditContext.getContext();
    const dto: CreateAuditLogDto = {
      actor_id: user.userId,
      is_platform_admin: user.isPlatformAdmin,
      enterprise_id: user.enterpriseId,
      organization_id: user.organizationId,
      module: meta.module,
      action: meta.action,
      entity_type: meta.entityType,
      entity_id: entityId,
      entity_display_name: displayName,
      old_value: ctx?.preValue ?? null,
      new_value: newValue,
    };
    await this.auditService.log(dto).catch(() => {});
  }
}
