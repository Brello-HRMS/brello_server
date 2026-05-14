import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { GlobalSearchDocument } from './entities/global-search-document.entity';
import { RecentSearch } from './entities/recent-search.entity';
import { GlobalSearchDocumentRepository } from './repositories/global-search-document.repository';
import { RecentSearchRepository } from './repositories/recent-search.repository';
import { SearchDatabaseInitService } from './services/search-database-init.service';
import { SearchIndexingService } from './services/search-indexing.service';
import { SearchQueryService } from './services/search-query.service';
import { SearchCleanupService } from './services/search-cleanup.service';
import { SearchController } from './controllers/search.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([GlobalSearchDocument, RecentSearch]),
    ScheduleModule.forRoot(),
  ],
  controllers: [SearchController],
  providers: [
    SearchDatabaseInitService,
    SearchQueryService,
    SearchIndexingService,
    SearchCleanupService,
    GlobalSearchDocumentRepository,
    RecentSearchRepository,
  ],
  exports: [SearchIndexingService],
})
export class GlobalSearchModule {}
