import type { CategoryItem, Complaint } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import { MOCK_CATEGORIES, MOCK_COMPLAINTS } from '@/data/mockData';

/**
 * Category Service
 * Manages complaint categories, department SLAs, and operational status.
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
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);

    // Compute live complaint counts per category
    const countMap: Record<string, number> = {};
    complaints.forEach((c) => {
      const key = (c.category || '').toLowerCase().trim();
      countMap[key] = (countMap[key] || 0) + 1;
    });

    const enriched = categories.map((cat) => {
      const liveCount =
        countMap[cat.slug.toLowerCase()] ??
        countMap[cat.name.toLowerCase()] ??
        cat.complaintCount ??
        0;
      return {
        ...cat,
        complaintCount: liveCount,
      };
    });

    if (activeOnly) {
      return enriched.filter((c) => c.active);
    }
    return enriched;
  }

  public async getCategoryById(id: string): Promise<CategoryItem | null> {
    const categories = await this.getCategories();
    return categories.find((c) => c.id === id || c.slug === id) || null;
  }

  public async createCategory(data: Omit<CategoryItem, 'id'>): Promise<CategoryItem> {
    this.ensureInitialized();
    const categories = getStorageItem<CategoryItem[]>(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const newCategory: CategoryItem = {
      ...data,
      id: `cat-${Date.now()}`,
      slug,
      complaintCount: 0,
      active: data.active ?? true,
    };

    setStorageItem(STORAGE_KEYS.CATEGORIES, [...categories, newCategory]);
    return newCategory;
  }

  public async updateCategory(id: string, data: Partial<CategoryItem>): Promise<CategoryItem> {
    this.ensureInitialized();
    const categories = getStorageItem<CategoryItem[]>(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    const index = categories.findIndex((c) => c.id === id || c.slug === id);

    if (index === -1) {
      throw new Error(`Category with ID ${id} not found`);
    }

    const updated: CategoryItem = {
      ...categories[index],
      ...data,
      slug: data.slug || (data.name ? data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : categories[index].slug),
    };

    categories[index] = updated;
    setStorageItem(STORAGE_KEYS.CATEGORIES, categories);
    return updated;
  }

  public async toggleCategoryStatus(id: string): Promise<CategoryItem> {
    this.ensureInitialized();
    const categories = getStorageItem<CategoryItem[]>(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    const index = categories.findIndex((c) => c.id === id || c.slug === id);

    if (index === -1) {
      throw new Error(`Category with ID ${id} not found`);
    }

    const updated: CategoryItem = {
      ...categories[index],
      active: !categories[index].active,
    };

    categories[index] = updated;
    setStorageItem(STORAGE_KEYS.CATEGORIES, categories);
    return updated;
  }
}

export const categoryService = new CategoryService();
