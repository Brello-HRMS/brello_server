import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { ListQueryDto, PaginatedResponse } from '../dto/pagination.dto';
import { LoggedInUser } from '../../modules/auth/interfaces/logged-in-user.interface';

export interface ListingOptions {
  searchFields?: string[];
  filterFields?: string[];
  alias?: string;
}

export class ListingHelper {
  /**
   * Applies standard listing logic (pagination, search, filter, org-scoping, sorting) to a QueryBuilder.
   */
  static async apply<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    listQuery: ListQueryDto,
    loggedInUser: LoggedInUser,
    options: ListingOptions = {},
  ): Promise<PaginatedResponse<T>> {
    const { searchFields = [], filterFields = [], alias = 'entity' } = options;

    // 1. Enforce Organization Scoping
    if (!loggedInUser.isPlatformAdmin && loggedInUser.organizationId) {
      queryBuilder.andWhere(`${alias}.organization_id = :orgId`, {
        orgId: loggedInUser.organizationId,
      });
    }

    // 2. Apply Search
    if (listQuery.search && searchFields.length > 0) {
      const searchClauses = searchFields
        .map((field) => {
          const searchField = field.includes('.') ? field : `${alias}.${field}`;
          return `${searchField} ILIKE :search`;
        })
        .join(' OR ');
      queryBuilder.andWhere(`(${searchClauses})`, {
        search: `%${listQuery.search}%`,
      });
    }

    // 3. Apply Explicit Filters (from listQuery.filters object)
    if (listQuery.filters) {
      Object.entries(listQuery.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          const filterField = key.includes('.') ? key : `${alias}.${key}`;
          const paramName = key.replace(/\./g, '_');
          queryBuilder.andWhere(`${filterField} = :${paramName}`, {
            [paramName]: value,
          });
        }
      });
    }

    // 4. Apply Root Level Filters (standard flat params)
    filterFields.forEach((field) => {
      const value = (listQuery as any)[field];
      if (value !== undefined && value !== null && value !== '') {
        const filterField = field.includes('.') ? field : `${alias}.${field}`;
        const paramName = field.replace(/\./g, '_');
        queryBuilder.andWhere(`${filterField} = :${paramName}`, {
          [paramName]: value,
        });
      }
    });

    // 5. Apply Sorting
    const sortBy = (listQuery as any).sort_by || 'created_at';
    const sortOrder = (listQuery as any).sort_order || 'DESC';
    const sortField = sortBy.includes('.') ? sortBy : `${alias}.${sortBy}`;
    queryBuilder.orderBy(sortField, sortOrder as any);

    // 6. Get Total Count
    const total = await queryBuilder.getCount();

    // 7. Apply Pagination
    const page = listQuery.page || 1;
    const limit = listQuery.limit || 10;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    // 8. Execute Query
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
