import { Injectable } from '@nestjs/common';

import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { SEARCHABLE_MODULES } from '../config/searchable-modules';
import {
  GlobalSearchDocumentRepository,
  SearchResult,
} from '../repositories/global-search-document.repository';
import { RecentSearchRepository } from '../repositories/recent-search.repository';
import type { RecentSearch } from '../entities/recent-search.entity';
import { PermissionResolverService } from '../../rbac/services/permission-resolver.service';
import { SaveRecentSearchDto } from '../dto';

export interface ModuleInfo {
  label: string;
  route: string;
}

export interface SearchResponse {
  modules: ModuleInfo[];
  results: SearchResult[];
}

@Injectable()
export class SearchQueryService {
  constructor(
    private readonly searchDocumentRepository: GlobalSearchDocumentRepository,
    private readonly recentSearchRepository: RecentSearchRepository,
    private readonly permissionResolverService: PermissionResolverService,
  ) {}

  async search(query: string, user: LoggedInUser): Promise<SearchResponse> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { modules: [], results: [] };
    }

    const resolved = await this.permissionResolverService.resolve(user);
    const userPermissions = resolved.modules.map((m) => m.code);

    const results = await this.searchDocumentRepository.search(
      user.enterpriseId,
      user.organizationId,
      trimmed,
      userPermissions,
    );

    return {
      modules: this.extractMatchingModules(results),
      results,
    };
  }

  async getRecentSearches(user: LoggedInUser): Promise<RecentSearch[]> {
    return this.recentSearchRepository.findByUser(
      user.userId,
      user.enterpriseId,
    );
  }

  async saveRecentSearch(
    dto: SaveRecentSearchDto,
    user: LoggedInUser,
  ): Promise<void> {
    await this.recentSearchRepository.save({
      enterprise_id: user.enterpriseId,
      organization_id: user.organizationId,
      user_id: user.userId,
      query: dto.query,
      entity_id: dto.entity_id,
      entity_type: dto.entity_type,
      title: dto.title,
      route: dto.route,
    });
  }

  private extractMatchingModules(results: SearchResult[]): ModuleInfo[] {
    const seen = new Set<string>();
    const modules: ModuleInfo[] = [];

    for (const result of results) {
      if (seen.has(result.module_key)) continue;

      const config = SEARCHABLE_MODULES.find(
        (m) => m.module_key === result.module_key,
      );
      if (config) {
        modules.push({ label: config.label, route: config.route });
        seen.add(result.module_key);
      }

      if (modules.length >= 5) break;
    }

    return modules;
  }
}
