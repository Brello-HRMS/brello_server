import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, FindOptionsWhere } from 'typeorm';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { Status } from 'src/common/enums';

@Injectable()
export class InvoiceRepository {
  constructor(
    @InjectRepository(Invoice)
    private readonly repository: Repository<Invoice>,
  ) {}

  create(data: Partial<Invoice>): Invoice {
    return this.repository.create(data);
  }

  save(invoice: Invoice): Promise<Invoice> {
    return this.repository.save(invoice);
  }

  findOneById(id: string, organizationId: string): Promise<Invoice | null> {
    return this.repository.findOne({
      where: { id, organization_id: organizationId, status: Status.ACTIVE },
      relations: ['line_items'],
    });
  }

  findCurrentForOrg(organizationId: string): Promise<Invoice | null> {
    return this.repository.findOne({
      where: {
        organization_id: organizationId,
        status: Status.ACTIVE,
        invoice_status: In([
          InvoiceStatus.PENDING,
          InvoiceStatus.FAILED,
          InvoiceStatus.OVERDUE,
        ]),
      },
      relations: ['line_items'],
      order: { invoice_date: 'DESC' },
    });
  }

  async findAllForOrg(
    organizationId: string,
    opts: {
      invoice_status?: InvoiceStatus;
      from?: Date;
      to?: Date;
      page: number;
      limit: number;
    },
  ): Promise<{ data: Invoice[]; total: number }> {
    const where: FindOptionsWhere<Invoice> = {
      organization_id: organizationId,
      status: Status.ACTIVE,
    };
    if (opts.invoice_status) where.invoice_status = opts.invoice_status;
    if (opts.from && opts.to) where.invoice_date = Between(opts.from, opts.to);

    const [data, total] = await this.repository.findAndCount({
      where,
      order: { invoice_date: 'DESC' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    });
    return { data, total };
  }

  async nextSequenceForMonth(yyyymm: string): Promise<number> {
    const prefix = `BRL-${yyyymm}-`;
    const row = await this.repository
      .createQueryBuilder('inv')
      .select('COUNT(*)', 'count')
      .where('inv.invoice_number LIKE :prefix', { prefix: `${prefix}%` })
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0) + 1;
  }
}
