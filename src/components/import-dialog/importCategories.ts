import type {ImportCategoryKey} from '@/core/types';

export interface ImportCategoryMeta {
  key: ImportCategoryKey;
  labelKey: string;
  iconKey: string;
}

export const importCategories: ImportCategoryMeta[] = [
  {key: 'clothes', labelKey: 'import-dialog-category-clothes-label', iconKey: 'import-dialog-category-clothes-icon'},
  {key: 'cosplay', labelKey: 'import-dialog-category-cosplay-label', iconKey: 'import-dialog-category-cosplay-icon'},
  {key: 'body', labelKey: 'import-dialog-category-body-label', iconKey: 'import-dialog-category-body-icon'},
  {key: 'restraints', labelKey: 'import-dialog-category-restraints-label', iconKey: 'import-dialog-category-restraints-icon'},
  {key: 'other', labelKey: 'import-dialog-category-other-label', iconKey: 'import-dialog-category-other-icon'},
];