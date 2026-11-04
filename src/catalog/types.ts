export type Category = 'agent' | 'skill' | 'kb' | 'service';

export const CATEGORIES: Category[] = ['agent', 'skill', 'kb', 'service'];

export const CATEGORY_LABEL: Record<Category, string> = {
  agent: '数字员工',
  skill: 'Skill',
  kb: '知识库',
  service: '团队服务',
};

export interface CatalogEntry {
  id: string;
  category: Category;
  name: string;
  summary: string;
  detail: string;
  tags: string[];
  ownerOpenIds: string[];
  link: string | null;
  order: number;
  hot: boolean;
}

export interface RawRecord {
  record_id: string;
  fields: Record<string, unknown>;
}
