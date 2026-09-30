import type { CategoryItem } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import { MOCK_CATEGORIES } from '@/data/mockData';

/**
 * Category Service
 * Manages complaint categories and classification metadata.
 */
class CategoryService {
  private ensureInitialized(): void {
    const existing = getStorageItem<CategoryItem[] | null>(STORAGE_KEYS.CATEGORIES, null);
    if (!existing || existing.length === 0) {
      setStorageItem(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    }
  }

  public async getCategories(activeOnly = false): Promise<CategoryItem[]> {
    this.ensureInitialized();
    const categories = getStorageItem<CategoryItem[]>(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    if (activeOnly) {
      return categories.filter((c) => c.active);
    }
    return categories;
  }

  public async getCategoryById(id: string): Promise<CategoryItem | null> {
    this.ensureInitialized();
    const categories = getStorageItem<CategoryItem[]>(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    return categories.find((c) => c.id === id || c.slug === id) || null;
  }

  public async createCategory(data: Omit<CategoryItem, 'id'>): Promise<CategoryItem> {
    this.ensureInitialized();
    const categories = getStorageItem<CategoryItem[]>(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    const newCategory: CategoryItem = {
      ...data,
      id: `cat-${Date.now()}`,
    };
    setStorageItem(STORAGE_KEYS.CATEGORIES, [...categories, newCategory]);
    return newCategory;
  }

  public async updateCategory(id: string, data: Partial<CategoryItem>): Promise<CategoryItem> {
    this.ensureInitialized();
    const categories = getStorageItem<CategoryItem[]>(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    const index = categories.findIndex((c) => c.id === id);

    if (index === -1) {
      throw new Error(`Category with ID ${id} not found`);
    }

    const updated = { ...categories[index], ...data };
    categories[index] = updated;
    setStorageItem(STORAGE_KEYS.CATEGORIES, categories);
    return updated;
  }
}

export const categoryService = new CategoryService();
