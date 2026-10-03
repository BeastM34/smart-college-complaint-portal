import type { CategoryItem, Complaint } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import { MOCK_CATEGORIES, MOCK_COMPLAINTS } from '@/data/mockData';
import { authService } from './authService';

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
      const slugKey = cat.slug.toLowerCase().trim();
      const nameKey = cat.name.toLowerCase().trim();
      const idKey = cat.id.toLowerCase().trim();

      // Look up complaints referencing either the slug, name, or id
      let liveCount = 0;
      if (countMap[slugKey]) liveCount += countMap[slugKey];
      if (countMap[nameKey] && nameKey !== slugKey) liveCount += countMap[nameKey];
      if (countMap[idKey] && idKey !== slugKey && idKey !== nameKey) liveCount += countMap[idKey];

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
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to create categories.');
    }
    const categories = getStorageItem<CategoryItem[]>(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);

    const cleanName = data.name.trim();
    if (!cleanName) {
      throw new Error('Category name is required.');
    }

    const slug = (
      data.slug || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    ).toLowerCase().trim();

    // Prevent duplicate category names
    if (categories.some((c) => c.name.toLowerCase().trim() === cleanName.toLowerCase())) {
      throw new Error(`A category with the name "${cleanName}" already exists.`);
    }

    // Prevent duplicate category slugs
    if (categories.some((c) => c.slug.toLowerCase().trim() === slug)) {
      throw new Error(`A category with the slug "${slug}" already exists.`);
    }

    const newCategory: CategoryItem = {
      ...data,
      id: `cat-${Date.now()}`,
      name: cleanName,
      slug,
      complaintCount: 0,
      active: data.active ?? true,
    };

    setStorageItem(STORAGE_KEYS.CATEGORIES, [...categories, newCategory]);
    return newCategory;
  }

  public async updateCategory(id: string, data: Partial<CategoryItem>): Promise<CategoryItem> {
    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to update categories.');
    }

    const categories = getStorageItem<CategoryItem[]>(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    const index = categories.findIndex((c) => c.id === id || c.slug === id);

    if (index === -1) {
      throw new Error(`Category with ID ${id} not found`);
    }

    const current = categories[index];

    // Prevent duplicate category name if name changed
    if (data.name) {
      const cleanName = data.name.trim();
      if (!cleanName) {
        throw new Error('Category name cannot be empty.');
      }
      if (
        categories.some(
          (c) => c.id !== current.id && c.name.toLowerCase().trim() === cleanName.toLowerCase()
        )
      ) {
        throw new Error(`A category with the name "${cleanName}" already exists.`);
      }
    }

    // Prevent duplicate category slug if slug explicitly changed
    if (data.slug) {
      const cleanSlug = data.slug.toLowerCase().trim();
      if (
        categories.some(
          (c) => c.id !== current.id && c.slug.toLowerCase().trim() === cleanSlug
        )
      ) {
        throw new Error(`A category with the slug "${cleanSlug}" already exists.`);
      }
    }

    // Preserve existing slug unless a valid new slug is explicitly supplied.
    // This preserves identity and prevents breaking historical complaint records.
    const finalSlug = data.slug ? data.slug.toLowerCase().trim() : current.slug;

    const updated: CategoryItem = {
      ...current,
      ...data,
      name: data.name ? data.name.trim() : current.name,
      slug: finalSlug,
    };

    categories[index] = updated;
    setStorageItem(STORAGE_KEYS.CATEGORIES, categories);
    return updated;
  }

  public async toggleCategoryStatus(id: string): Promise<CategoryItem> {
    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to change category status.');
    }

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
