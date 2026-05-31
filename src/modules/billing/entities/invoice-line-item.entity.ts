import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Invoice } from './invoice.entity';

@Entity('invoice_line_item')
@Index(['invoice_id'])
export class InvoiceLineItem extends BaseEntity {
  @Column({ type: 'uuid' })
  invoice_id: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.line_items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ type: 'varchar', length: 255 })
  line_description: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unit_price: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;
}
