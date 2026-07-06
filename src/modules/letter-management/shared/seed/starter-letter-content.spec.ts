import {
  STARTER_LETTER_CATEGORIES,
  seedStarterLetterContent,
} from './starter-letter-content';
import { TemplateStatus } from '../../templates/enums/template-status.enum';
import { VARIABLE_KEYS } from '../registry/variable-registry';
import { Status } from '../../../../common/enums';

describe('seedStarterLetterContent', () => {
  let saved: any[];
  let manager: any;
  let idCounter: number;

  beforeEach(() => {
    saved = [];
    idCounter = 0;
    manager = {
      create: jest.fn((_entity, data) => ({ ...data })),
      save: jest.fn(async (entity) => {
        const withId = { ...entity, id: entity.id ?? `id-${++idCounter}` };
        saved.push(withId);
        return withId;
      }),
    };
  });

  it('seeds one category + one template per starter entry, scoped to the org', async () => {
    await seedStarterLetterContent(manager, {
      organizationId: 'org-1',
      enterpriseId: 'ent-1',
    });

    const categories = saved.filter((r) => !('category_id' in r));
    const templates = saved.filter((r) => 'category_id' in r);

    expect(categories).toHaveLength(STARTER_LETTER_CATEGORIES.length);
    expect(templates).toHaveLength(STARTER_LETTER_CATEGORIES.length);

    for (const category of categories) {
      expect(category.organization_id).toBe('org-1');
      expect(category.enterprise_id).toBe('ent-1');
      expect(category.status).toBe(Status.ACTIVE);
    }

    for (const template of templates) {
      expect(template.organization_id).toBe('org-1');
      expect(template.enterprise_id).toBe('ent-1');
      expect(template.template_status).toBe(TemplateStatus.DRAFT);
      expect(template.version).toBe(1);
      expect(categories.some((c) => c.id === template.category_id)).toBe(true);
    }
  });

  it('only ever uses variables that exist in the registry', async () => {
    await seedStarterLetterContent(manager, {
      organizationId: 'org-1',
      enterpriseId: 'ent-1',
    });

    const templates = saved.filter((r) => 'category_id' in r);
    for (const template of templates) {
      for (const key of template.variables) {
        expect(VARIABLE_KEYS.has(key)).toBe(true);
      }
    }
  });
});
