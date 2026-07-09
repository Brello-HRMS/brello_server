import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GlobalSearchDocument } from '../entities/global-search-document.entity';

export interface UpsertSearchDocumentInput {
  enterprise_id: string;
  organization_id?: string;
  entity_id: string;
  entity_type: string;
  module_key: string;
  title: string;
  subtitle?: string;
  keywords?: string;
  route: string;
  permissions?: string[];
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  entity_id: string;
  entity_type: string;
  module_key: string;
  title: string;
  subtitle: string;
  route: string;
  permissions: string[];
  metadata: Record<string, unknown>;
}

@Injectable()
export class GlobalSearchDocumentRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getTableName(): string {
    const metadata = this.dataSource.getMetadata(GlobalSearchDocument);
    return metadata.schema ? `"${metadata.schema}"."${metadata.tableName}"` : `"${metadata.tableName}"`;
  }

  async upsert(input: UpsertSearchDocumentInput): Promise<void> {
    const tableName = this.getTableName();
    await this.dataSource.query(
      `
      INSERT INTO ${tableName}
        (enterprise_id, organization_id, entity_id, entity_type, module_key,
         title, subtitle, keywords, route, permissions, is_active, is_deleted, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, $12)
      ON CONFLICT ON CONSTRAINT uq_search_doc_entity
      DO UPDATE SET
        title       = EXCLUDED.title,
        subtitle    = EXCLUDED.subtitle,
        keywords    = EXCLUDED.keywords,
        route       = EXCLUDED.route,
        permissions = EXCLUDED.permissions,
        is_active   = EXCLUDED.is_active,
        metadata    = EXCLUDED.metadata,
        updated_at  = NOW()
      `,
      [
        input.enterprise_id,
        input.organization_id ?? null,
        input.entity_id,
        input.entity_type,
        input.module_key,
        input.title,
        input.subtitle ?? null,
        input.keywords ?? null,
        input.route,
        input.permissions ?? [],
        input.is_active ?? true,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );

    await this.dataSource.query(
      `
      UPDATE ${tableName}
      SET search_vector = to_tsvector(
        'simple',
        coalesce(title, '') || ' ' ||
        coalesce(subtitle, '') || ' ' ||
        coalesce(keywords, '')
      )
      WHERE enterprise_id = $1
        AND entity_id = $2
        AND entity_type = $3
      `,
      [input.enterprise_id, input.entity_id, input.entity_type],
    );
  }

  async softDelete(
    enterpriseId: string,
    entityId: string,
    entityType: string,
  ): Promise<void> {
    const tableName = this.getTableName();
    await this.dataSource.query(
      `
      UPDATE ${tableName}
      SET is_deleted = true, is_active = false, updated_at = NOW()
      WHERE enterprise_id = $1
        AND entity_id = $2
        AND entity_type = $3
      `,
      [enterpriseId, entityId, entityType],
    );
  }

  async search(
    enterpriseId: string,
    organizationId: string | null,
    query: string,
    userPermissions: string[],
    limit = 10,
  ): Promise<SearchResult[]> {
    const tableName = this.getTableName();
    return this.dataSource.query<SearchResult[]>(
      `
      SELECT
        id,
        entity_id,
        entity_type,
        module_key,
        title,
        subtitle,
        route,
        permissions,
        metadata,
        CASE
          WHEN LOWER(title) = LOWER($3)           THEN 4
          WHEN LOWER(title) LIKE LOWER($3) || '%' THEN 3
          WHEN LOWER(title) LIKE '%' || LOWER($3) || '%' THEN 2
          ELSE 1
        END AS match_rank,
        ts_rank(search_vector, plainto_tsquery('simple', $3)) AS ts_rank_score,
        similarity(title, $3) AS trgm_score
      FROM ${tableName}
      WHERE enterprise_id = $1
        AND ($2::uuid IS NULL OR organization_id = $2)
        AND is_active   = true
        AND is_deleted  = false
        AND (
          search_vector @@ plainto_tsquery('simple', $3)
          OR similarity(title, $3) > 0.2
        )
        AND (
          cardinality(permissions) = 0
          OR permissions IS NULL
          OR permissions && $5
        )
      ORDER BY match_rank DESC, ts_rank_score DESC, trgm_score DESC
      LIMIT $4
      `,
      [enterpriseId, organizationId, query, limit, userPermissions],
    );
  }
}
