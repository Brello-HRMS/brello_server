import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { RecentSearch } from '../entities/recent-search.entity';

export interface SaveRecentSearchInput {
  enterprise_id: string;
  organization_id?: string;
  user_id: string;
  query?: string;
  entity_id?: string;
  entity_type?: string;
  title?: string;
  route?: string;
}

@Injectable()
export class RecentSearchRepository {
  private readonly MAX_PER_USER = 10;

  constructor(private readonly dataSource: DataSource) {}

  private getTableName(): string {
    const metadata = this.dataSource.getMetadata(RecentSearch);
    return metadata.schema ? `"${metadata.schema}"."${metadata.tableName}"` : `"${metadata.tableName}"`;
  }

  async save(input: SaveRecentSearchInput): Promise<void> {
    const tableName = this.getTableName();
    await this.dataSource.query(
      `
      INSERT INTO ${tableName}
        (enterprise_id, organization_id, user_id, query, entity_id, entity_type, title, route)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        input.enterprise_id,
        input.organization_id ?? null,
        input.user_id,
        input.query ?? null,
        input.entity_id ?? null,
        input.entity_type ?? null,
        input.title ?? null,
        input.route ?? null,
      ],
    );

    await this.dataSource.query(
      `
      DELETE FROM ${tableName}
      WHERE user_id = $1
        AND enterprise_id = $2
        AND id NOT IN (
          SELECT id FROM ${tableName}
          WHERE user_id = $1 AND enterprise_id = $2
          ORDER BY created_at DESC
          LIMIT $3
        )
      `,
      [input.user_id, input.enterprise_id, this.MAX_PER_USER],
    );
  }

  async findByUser(
    userId: string,
    enterpriseId: string,
    limit = 10,
  ): Promise<RecentSearch[]> {
    const tableName = this.getTableName();
    return this.dataSource.query<RecentSearch[]>(
      `
      SELECT id, query, entity_id, entity_type, title, route, created_at
      FROM ${tableName}
      WHERE user_id = $1 AND enterprise_id = $2
      ORDER BY created_at DESC
      LIMIT $3
      `,
      [userId, enterpriseId, limit],
    );
  }
}
