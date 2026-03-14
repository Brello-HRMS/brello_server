import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { ListQueryDto, PaginatedResponse } from '../dto/pagination.dto';
import { LoggedInUser } from '../../modules/auth/interfaces/logged-in-user.interface';

export class ListingHelper {
  /**
   * Applies standard listing logic (pagination, search, filter, org-scoping) to a QueryBuilder.
   */
  static async apply<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    listQuery: ListQueryDto,
    loggedInUser: LoggedInUser,
    searchFields: string[] = [],
    alias: string = 'entity',
  ): Promise<PaginatedResponse<T>> {
    // 1. Enforce Organization Scoping
    if (!loggedInUser.isPlatformAdmin) {
      queryBuilder.andWhere(`${alias}.organization_id = :orgId`, {
        orgId: loggedInUser.organizationId,
      });
    }

    // 2. Apply Search
    if (listQuery.search && searchFields.length > 0) {
      const searchClauses = searchFields
        .map((field) => `${alias}.${field} ILIKE :search`)
        .join(' OR ');
      queryBuilder.andWhere(`(${searchClauses})`, {
        search: `%${listQuery.search}%`,
      });
    }

    // 3. Apply Filters
    if (listQuery.filters) {
      Object.entries(listQuery.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryBuilder.andWhere(`${alias}.${key} = :${key}`, { [key]: value });
        }
      });
    }

    // 4. Get Total Count
    const total = await queryBuilder.getCount();

    // 5. Apply Pagination
    const page = listQuery.page || 1;
    const limit = listQuery.limit || 10;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    // 6. Execute Query
    const data = await queryBuilder.getMany();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
