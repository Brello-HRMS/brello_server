import { Injectable } from '@nestjs/common';
import type {
  RenderModel,
  SalaryTableModel,
  SignatoryModel,
} from '../interfaces/render-model.interface';

export interface TemplateContent {
  heading?: string | null;
  paragraphs: string[];
  bullet_list: string[];
  include_salary_table: boolean;
}

/**
 * Pure transformation: template content + resolved variables + snapshots →
 * a renderable model. No database access, no side effects — used identically
 * by template preview and real letter generation so the two can never drift.
 */
@Injectable()
export class RenderModelBuilderService {
  substitute(text: string, values: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? '');
  }

  build(
    template: TemplateContent,
    values: Record<string, string>,
    salaryTable: SalaryTableModel | null,
    signatory: SignatoryModel | null,
  ): RenderModel {
    return {
      heading: template.heading ? this.substitute(template.heading, values) : '',
      paragraphs: template.paragraphs.map((p) => this.substitute(p, values)),
      bulletList: template.bullet_list.map((b) => this.substitute(b, values)),
      salaryTable: template.include_salary_table ? salaryTable : null,
      signatory,
    };
  }
}
