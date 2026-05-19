import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

import { RecentSearch } from '../entities/recent-search.entity';

@Injectable()
export class SearchCleanupService {
  private readonly logger = new Logger(SearchCleanupService.name);
  private readonly RECENT_SEARCH_TTL_DAYS = 30;

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldRecentSearches(): Promise<void> {
    const tableName = this.getTableName();

    const result = await this.dataSource.query<{ count: string }[]>(
      `
      DELETE FROM ${tableName}
      WHERE created_at < NOW() - INTERVAL '${this.RECENT_SEARCH_TTL_DAYS} days'
      RETURNING id
      `,
    );

    const deleted = result.length;
    if (deleted > 0) {
      this.logger.log(`Cleanup: removed ${deleted} recent search entries older than ${this.RECENT_SEARCH_TTL_DAYS} days`);
    }
  }

  private getTableName(): string {
    const metadata = this.dataSource.getMetadata(RecentSearch);
    return metadata.schema
      ? `"${metadata.schema}"."${metadata.tableName}"`
      : `"${metadata.tableName}"`;
  }
}
