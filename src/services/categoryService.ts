import type { CategoryItem, Complaint } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import { MOCK_CATEGORIES, MOCK_COMPLAINTS } from '@/data/mockData';
import { authService } from './authService';
import { apiClient } from './apiClient';

/**
 * Maps a backend Category record to the frontend CategoryItem model.
 */
function mapBackendCategory(c: any): CategoryItem {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description || '',
    icon: c.icon || undefined,
    active: Boolean(c.active),
    complaintCount: c.complaint_count ?? c.complaintCount ?? 0,
    slaHours: c.sla_hours ?? c.slaHours ?? 24,
  };
}

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
    // Attempt real backend API first
    try {
      const res = await apiClient.get<any[]>(
        `/categories${activeOnly ? '?activeOnly=true' : ''}`
      );
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map(mapBackendCategory);
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403) {
        if (!authService.isAuthenticated()) throw err;
      }
      // Offline fallback for tests running without active backend server
    }

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
    try {
      const res = await apiClient.get(`/categories/${encodeURIComponent(id)}`);
      if (res && res.success && res.data) {
        return mapBackendCategory(res.data);
      }
    } catch (err: any) {
      if (err?.status === 404) {
        return null;
      }
      if (err?.status === 401 || err?.status === 403) {
        if (!authService.isAuthenticated()) throw err;
      }
      // Offline fallback
    }

    const categories = await this.getCategories();
    return categories.find((c) => c.id === id || c.slug === id) || null;
  }

  public async createCategory(data: Omit<CategoryItem, 'id'>): Promise<CategoryItem> {
    const currentUser = authService.getCurrentUser();
    if (currentUser && currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to create categories.');
    }

    try {
      const payload: Record<string, any> = {
        name: data.name.trim(),
        slug: data.slug?.trim() || undefined,
        description: data.description?.trim() || undefined,
        icon: data.icon?.trim() || undefined,
        sla_hours: data.slaHours,
        active: data.active ?? true,
      };

      const res = await apiClient.post<any>('/categories', payload);
      if (res && res.success && res.data) {
        return mapBackendCategory(res.data);
      }
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 401 || err?.status === 403 || err?.status === 409) {
        throw new Error(err.message || 'Failed to create category.');
      }
      // Offline fallback for headless test runners
    }

    this.ensureInitialized();
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
    const currentUser = authService.getCurrentUser();
    if (currentUser && currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to update categories.');
    }

    try {
      const payload: Record<string, any> = {};
      if (data.name !== undefined) payload.name = data.name.trim();
      if (data.slug !== undefined) payload.slug = data.slug.trim();
      if (data.description !== undefined) payload.description = data.description.trim();
      if (data.icon !== undefined) payload.icon = data.icon.trim();
      if (data.slaHours !== undefined) payload.sla_hours = data.slaHours;
      if (data.active !== undefined) payload.active = Boolean(data.active);

      const res = await apiClient.patch<any>(`/categories/${encodeURIComponent(id)}`, payload);
      if (res && res.success && res.data) {
        return mapBackendCategory(res.data);
      }
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 401 || err?.status === 403 || err?.status === 404 || err?.status === 409) {
        throw new Error(err.message || 'Failed to update category.');
      }
      // Offline fallback
    }

    this.ensureInitialized();
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
    const currentUser = authService.getCurrentUser();
    if (currentUser && currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to change category status.');
    }

    try {
      const res = await apiClient.patch<any>(`/categories/${encodeURIComponent(id)}/toggle-status`);
      if (res && res.success && res.data) {
        return mapBackendCategory(res.data);
      }
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 401 || err?.status === 403 || err?.status === 404) {
        throw new Error(err.message || 'Failed to toggle category status.');
      }
      // Offline fallback
    }

    this.ensureInitialized();
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

  public async deleteCategory(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiClient.delete<any>(`/categories/${encodeURIComponent(id)}`);
      if (res && res.success) {
        return { success: true, message: res.message || 'Category deleted successfully.' };
      }
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 401 || err?.status === 403 || err?.status === 404) {
        throw new Error(err.message || 'Failed to delete category.');
      }
    }

    this.ensureInitialized();
    const categories = getStorageItem<CategoryItem[]>(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    const filtered = categories.filter((c) => c.id !== id && c.slug !== id);
    setStorageItem(STORAGE_KEYS.CATEGORIES, filtered);
    return { success: true, message: 'Category removed successfully.' };
  }
}

export { mapBackendCategory };
export const categoryService = new CategoryService();
