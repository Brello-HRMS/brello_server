import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, SelectQueryBuilder } from 'typeorm';
import { User } from '../entities/user.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) { }

  getListingQueryBuilder(alias: string = 'user'): SelectQueryBuilder<User> {
    return this.repository.createQueryBuilder(alias)
      .leftJoinAndSelect(`${alias}.user_profile`, 'profile')
      .leftJoinAndSelect('profile.photo', 'photo');
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.repository.create(user);
    return this.repository.save(newUser);
  }

  async findAll(): Promise<User[]> {
    return this.repository.find({
      where: { status: Not(Status.DELETED) },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.repository.findOne({
      where: { id, status: Not(Status.DELETED) },
      relations: ['designation', 'department', 'user_profile', 'user_profile.photo'],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email, status: Not(Status.DELETED) },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.repository.findOne({
      where: { phone, status: Not(Status.DELETED) },
    });
  }

  async findByEnterpriseId(enterpriseId: string): Promise<User[]> {
    return this.repository.find({
      where: { enterprise_id: enterpriseId, status: Not(Status.DELETED) },
      order: { created_at: 'DESC' },
    });
  }

  async findByOrganizationId(organizationId: string): Promise<User[]> {
    return this.repository.find({
      where: {
        organization_id: organizationId,
        status: Not(Status.DELETED),
      },
      order: { created_at: 'DESC' },
    });
  }

  async update(id: string, updateData: Partial<User>): Promise<User | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<User | null> {
    await this.repository.update(id, { status: Status.DELETED });
    return this.findById(id);
  }
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
  async exists(id: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { id, status: Not(Status.DELETED) },
    });
    return count > 0;
  }

  async emailExists(email: string, excludeUserId?: string): Promise<boolean> {
    const where: any = { email, status: Not(Status.DELETED) };
    if (excludeUserId) {
      where.id = Not(excludeUserId);
    }
    const count = await this.repository.count({ where });
    return count > 0;
  }

  async phoneExists(phone: string, excludeUserId?: string): Promise<boolean> {
    const where: any = { phone, status: Not(Status.DELETED) };
    if (excludeUserId) {
      where.id = Not(excludeUserId);
    }
    const count = await this.repository.count({ where });
    return count > 0;
  }

  async findAvatarsByDepartmentIds(departmentIds: string[]): Promise<Record<string, string[]>> {
    if (departmentIds.length === 0) return {};

    const users = await this.repository.createQueryBuilder('user')
      .leftJoinAndSelect('user.user_profile', 'profile')
      .leftJoinAndSelect('profile.photo', 'photo')
      .where('user.department_id IN (:...departmentIds)', { departmentIds })
      .andWhere('user.status != :deleted', { deleted: Status.DELETED })
      .orderBy('user.created_at', 'DESC')
      .getMany();

    const result: Record<string, string[]> = {};
    departmentIds.forEach(id => (result[id] = []));

    users.forEach(user => {
      // Basic URL logic - in a real app this would come from DocumentService
      const photo = user.user_profile?.photo;
      if (result[user.department_id].length < 3 && photo) {
        const region = 'us-east-1'; // fallback
        const url = `https://${photo.bucket}.s3.${region}.amazonaws.com/${photo.object_key}`;
        result[user.department_id].push(url);
      }
    });

    return result;
  }

  async findAllUsers(
    organizationId: string,
    enterpriseId: string,
    excludeUserId: string,
  ): Promise<Partial<User>[]> {
    return this.repository.find({
      select: [
        'id',
        'first_name',
        'middle_name',
        'last_name',
        'email',
        'phone',
        'status',
        'designation_id',
        'department_id',
      ],
      where: {
        organization_id: organizationId,
        enterprise_id: enterpriseId,
        status: Not(Status.DELETED),
        id: Not(excludeUserId),
      },
      order: { first_name: 'ASC' },
    });
  }

  /**
   * Fetch every non-deleted user in the org/enterprise with the relations
   * needed to build the reporting hierarchy in memory (designation, department,
   * profile photo). The self-referencing `reports_to_id` column carries the
   * manager link, so no extra join is required for the tree itself.
   */
  async findAllForHierarchy(
    organizationId: string,
    enterpriseId: string,
  ): Promise<User[]> {
    return this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.designation', 'designation')
      .leftJoinAndSelect('user.department', 'department')
      .leftJoinAndSelect('user.user_profile', 'profile')
      .leftJoinAndSelect('profile.photo', 'photo')
      .where('user.organization_id = :organizationId', { organizationId })
      .andWhere('user.enterprise_id = :enterpriseId', { enterpriseId })
      .andWhere('user.status != :deleted', { deleted: Status.DELETED })
      .orderBy('user.first_name', 'ASC')
      .getMany();
  }

  async getDropdownList(organizationId: string): Promise<Partial<User>[]> {
    return this.repository.find({
      select: ['id', 'first_name', 'middle_name', 'last_name'],
      where: {
        organization_id: organizationId,
        status: Status.ACTIVE,
      },
      order: { first_name: 'ASC' },
    });
  }

  async findBirthdaysThisMonth(organizationId: string, month: number): Promise<User[]> {
    return this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.user_profile', 'profile')
      .where('user.organization_id = :organizationId', { organizationId })
      .andWhere('user.status = :status', { status: Status.ACTIVE })
      .andWhere('profile.dob IS NOT NULL')
      .andWhere('EXTRACT(MONTH FROM profile.dob) = :month', { month })
      .orderBy('EXTRACT(DAY FROM profile.dob)', 'ASC')
      .getMany();
  }

  async countActive(organizationId: string): Promise<number> {
    return this.repository.count({
      where: { organization_id: organizationId, status: Status.ACTIVE },
    });
  }

  async countByDepartment(departmentId: string): Promise<number> {
    return this.repository.count({
      where: { department_id: departmentId, status: Not(Status.DELETED) },
    });
  }

  async findNewHiresThisMonth(organizationId: string): Promise<User[]> {
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(now.getMonth() - 1);

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const firstDay = formatDate(oneMonthAgo);
    const lastDay = formatDate(now);

    return this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.user_profile', 'profile')
      .leftJoinAndSelect('user.department', 'department')
      .where('user.organization_id = :organizationId', { organizationId })
      .andWhere('user.status = :status', { status: Status.ACTIVE })
      .andWhere('profile.joining_date IS NOT NULL')
      .andWhere('profile.joining_date >= :firstDay', { firstDay })
      .andWhere('profile.joining_date <= :lastDay', { lastDay })
      .orderBy('profile.joining_date', 'ASC')
      .getMany();
  }
}
