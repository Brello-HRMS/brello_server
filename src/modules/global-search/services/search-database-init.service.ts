import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GlobalSearchDocument } from '../entities/global-search-document.entity';

@Injectable()
export class SearchDatabaseInitService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SearchDatabaseInitService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.enablePgTrgm();
    await this.addSearchVectorColumn();
    await this.ensureUniqueConstraint();
    await this.createIndexes();
    this.logger.log('Global search database initialized');
  }

  private getTableName(): string {
    const metadata = this.dataSource.getMetadata(GlobalSearchDocument);
    return metadata.schema ? `"${metadata.schema}"."${metadata.tableName}"` : `"${metadata.tableName}"`;
  }

  private async enablePgTrgm(): Promise<void> {
    await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  }

  private async addSearchVectorColumn(): Promise<void> {
    const tableName = this.getTableName();
    await this.dataSource.query(`
      ALTER TABLE ${tableName}
      ADD COLUMN IF NOT EXISTS search_vector tsvector
    `);
  }

  private async ensureUniqueConstraint(): Promise<void> {
    const tableName = this.getTableName();
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_search_doc_entity'
        ) THEN
          ALTER TABLE ${tableName}
          ADD CONSTRAINT uq_search_doc_entity
          UNIQUE (enterprise_id, entity_id, entity_type);
        END IF;
      END;
      $$
    `);
  }

  private async createIndexes(): Promise<void> {
    const tableName = this.getTableName();
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_search_vector
      ON ${tableName} USING GIN(search_vector)
    `);

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_title_trgm
      ON ${tableName} USING GIN(title gin_trgm_ops)
    `);
  }
}
