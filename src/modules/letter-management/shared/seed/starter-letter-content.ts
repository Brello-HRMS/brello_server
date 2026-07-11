import { EntityManager } from 'typeorm';
import { Status } from '../../../../common/enums';
import { LetterCategory } from '../../categories/entities/letter-category.entity';
import { LetterTemplate } from '../../templates/entities/letter-template.entity';
import { TemplateStatus } from '../../templates/enums/template-status.enum';
import { extractVariableKeys } from '../registry/variable-registry';

export interface StarterTemplateSeed {
  name: string;
  heading: string;
  paragraphs: string[];
  bullet_list: string[];
  include_salary_table: boolean;
}

export interface StarterCategorySeed {
  name: string;
  description: string;
  template: StarterTemplateSeed;
}

/**
 * Starter categories + templates seeded for every organization so Letter
 * Management never starts as a completely blank slate. Templates are always
 * created as DRAFT — an admin must read through and publish each one before
 * it can be used to generate a real letter. Content sticks to variables that
 * exist in the registry today; bracketed placeholders (e.g. "[Last Working
 * Day]") mark specifics the current registry has no variable for, and are
 * meant to be filled in by hand during that review.
 */
export const STARTER_LETTER_CATEGORIES: StarterCategorySeed[] = [
  {
    name: 'Offer Letter',
    description: 'Extend an offer of employment to a new joiner.',
    template: {
      name: 'Offer Letter',
      heading: 'Offer of Employment',
      paragraphs: [
        'Dear {{employee_name}},',
        'We are pleased to offer you the position of {{designation}} in the {{department}} department at {{organization_name}}. We were impressed by your background and are confident you will be a valuable addition to our team.',
        'Your date of joining will be {{doj}}, and your annual Cost to Company (CTC) will be {{ctc}}. Detailed compensation and benefits information is enclosed with this letter.',
        'This offer is subject to the terms and conditions listed below, and to the successful completion of any pending background or reference checks.',
      ],
      bullet_list: [
        'This offer is contingent upon verification of your credentials and references.',
        'Your employment will be governed by the organization’s policies as amended from time to time.',
        'Notice period applicable to this role: [Notice Period].',
        'Please confirm your acceptance of this offer by [Response Deadline].',
      ],
      include_salary_table: false,
    },
  },
  {
    name: 'Confirmation Letter',
    description: 'Confirm an employee as permanent after probation.',
    template: {
      name: 'Confirmation Letter',
      heading: 'Confirmation of Employment',
      paragraphs: [
        'Dear {{employee_name}},',
        'We are happy to confirm that your employment with {{organization_name}} as {{designation}}, which commenced on {{doj}}, has been reviewed and is hereby confirmed as permanent, effective {{today_date}}.',
        'All other terms and conditions of your employment remain unchanged. We look forward to your continued contribution to the organization.',
      ],
      bullet_list: [],
      include_salary_table: false,
    },
  },
  {
    name: 'Transfer Letter',
    description:
      'Notify an employee of a transfer to a new department or location.',
    template: {
      name: 'Transfer Letter',
      heading: 'Transfer Order',
      paragraphs: [
        'Dear {{employee_name}},',
        'This is to inform you that, effective {{today_date}}, you are being transferred from the {{department}} department to [New Department/Location].',
        'Your designation of {{designation}} and other terms of employment remain unchanged unless communicated separately. Please coordinate with your reporting manager and HR to complete the transition.',
      ],
      bullet_list: [],
      include_salary_table: false,
    },
  },
  {
    name: 'Probation Extension Letter',
    description:
      'Notify an employee that their probation period has been extended.',
    template: {
      name: 'Probation Extension Letter',
      heading: 'Extension of Probation Period',
      paragraphs: [
        'Dear {{employee_name}},',
        'This letter is to inform you that your probation period as {{designation}}, which commenced on {{doj}}, is being extended to [New Probation End Date].',
        'This decision has been made on account of: [Reason for Extension]. We encourage you to discuss this with your reporting manager to understand the areas of focus during the extended period.',
      ],
      bullet_list: [],
      include_salary_table: false,
    },
  },
  {
    name: 'Promotion Letter',
    description: 'Congratulate and formally notify an employee of a promotion.',
    template: {
      name: 'Promotion Letter',
      heading: 'Promotion Letter',
      paragraphs: [
        'Dear {{employee_name}},',
        'Congratulations! In recognition of your performance and contribution to {{organization_name}}, you have been promoted from {{designation}} to [New Designation], effective {{today_date}}.',
        'Your revised annual CTC will be [New CTC]. All other terms and conditions of your employment remain unchanged unless communicated separately.',
        'We look forward to your continued success in this new role.',
      ],
      bullet_list: [],
      include_salary_table: false,
    },
  },
  {
    name: 'Salary Increment Letter',
    description: 'Inform an employee of a revision to their compensation.',
    template: {
      name: 'Salary Increment Letter',
      heading: 'Salary Revision Letter',
      paragraphs: [
        'Dear {{employee_name}},',
        'We are pleased to inform you that, in recognition of your performance, your annual Cost to Company (CTC) has been revised from {{ctc}} to [New CTC], effective [Effective Date].',
        'A summary of your revised compensation is provided below.',
      ],
      bullet_list: [],
      include_salary_table: true,
    },
  },
  {
    name: 'Experience Letter',
    description: 'Certify an employee’s tenure and role for a former employee.',
    template: {
      name: 'Experience Letter',
      heading: 'Experience Certificate',
      paragraphs: [
        'This is to certify that {{employee_name}} was employed with {{organization_name}} as {{designation}} in the {{department}} department from {{doj}} to [Last Working Day].',
        'During this period, we found their conduct and performance to be satisfactory.',
        'We wish them success in their future endeavors.',
      ],
      bullet_list: [],
      include_salary_table: false,
    },
  },
  {
    name: 'Relieving Letter',
    description: 'Confirm that an employee has been relieved of their duties.',
    template: {
      name: 'Relieving Letter',
      heading: 'Relieving Letter',
      paragraphs: [
        'Dear {{employee_name}},',
        'This is to confirm that you have been relieved from your duties as {{designation}} at {{organization_name}}, effective [Last Working Day], following your resignation.',
        'All dues and settlements, if any, will be processed as per company policy. We thank you for your contribution to the organization and wish you the best in your future endeavors.',
      ],
      bullet_list: [],
      include_salary_table: false,
    },
  },
  {
    name: 'Proof of Employment',
    description:
      'Confirm that an individual is a current employee, for external use.',
    template: {
      name: 'Proof of Employment',
      heading: 'Proof of Employment',
      paragraphs: [
        'This is to confirm that {{employee_name}} (Employee Code: {{employee_code}}) is currently employed with {{organization_name}} as {{designation}}, since {{doj}}.',
        'Their current annual Cost to Company (CTC) is as summarized below. This letter is issued upon request for whatever purpose it may serve.',
      ],
      bullet_list: [],
      include_salary_table: true,
    },
  },
];

/**
 * Seeds the starter categories/templates above for one organization. Shared
 * by both the new-org signup flow (organization.service.ts) and the
 * one-off backfill script for orgs that already existed before this seeding
 * was introduced — content only ever lives in this one file.
 */
export async function seedStarterLetterContent(
  manager: EntityManager,
  ctx: { organizationId: string; enterpriseId: string },
): Promise<void> {
  for (const categorySeed of STARTER_LETTER_CATEGORIES) {
    const category = manager.create(LetterCategory, {
      name: categorySeed.name,
      description: categorySeed.description,
      organization_id: ctx.organizationId,
      enterprise_id: ctx.enterpriseId,
      status: Status.ACTIVE,
    });
    const savedCategory = await manager.save(category);

    const { template } = categorySeed;
    const variables = extractVariableKeys([
      template.heading,
      ...template.paragraphs,
      ...template.bullet_list,
    ]);

    const letterTemplate = manager.create(LetterTemplate, {
      category_id: savedCategory.id,
      name: template.name,
      heading: template.heading,
      paragraphs: template.paragraphs,
      bullet_list: template.bullet_list,
      include_salary_table: template.include_salary_table,
      variables,
      version: 1,
      template_status: TemplateStatus.DRAFT,
      organization_id: ctx.organizationId,
      enterprise_id: ctx.enterpriseId,
      status: Status.ACTIVE,
    });
    await manager.save(letterTemplate);
  }
}
