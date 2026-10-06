import { SupabaseClient } from '@supabase/supabase-js';
import { Category, CreateCategoryInput, UpdateCategoryInput } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CategoryService {
  /**
   * Lists categories under Row Level Security.
   * Authenticated users see active categories; Admins see all categories.
   * Enriches categories with live complaint counts.
   */
  public static async listCategories(
    client: SupabaseClient,
    activeOnly: boolean = false
  ): Promise<Category[]> {
    let query = client
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data: categories, error } = await query;
    if (error) {
      const err: any = new Error(error.message || 'Failed to retrieve categories.');
      err.statusCode = error.code === '42501' ? 403 : 500;
      throw err;
    }

    if (!categories || categories.length === 0) {
      return [];
    }

    // Query complaint counts grouped by category_id
    const { data: complaintRows } = await client
      .from('complaints')
      .select('category_id');

    const countMap: Record<string, number> = {};
    if (complaintRows) {
      for (const row of complaintRows) {
        if (row.category_id) {
          countMap[row.category_id] = (countMap[row.category_id] || 0) + 1;
        }
      }
    }

    return (categories as Category[]).map((cat) => ({
      ...cat,
      complaint_count: countMap[cat.id] || 0,
    }));
  }

  /**
   * Retrieves a single category by ID (UUID) or slug.
   */
  public static async getCategoryById(
    client: SupabaseClient,
    idOrSlug: string
  ): Promise<Category | null> {
    const clean = idOrSlug.trim();
    if (!clean) return null;

    let query = client.from('categories').select('*');
    if (UUID_REGEX.test(clean)) {
      query = query.eq('id', clean);
    } else {
      query = query.eq('slug', clean.toLowerCase());
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) {
      return null;
    }

    // Attach complaint count
    const { count } = await client
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', data.id);

    return {
      ...(data as Category),
      complaint_count: count || 0,
    };
  }

  /**
   * Creates a new category (Admin-only).
   */
  public static async createCategory(
    client: SupabaseClient,
    input: CreateCategoryInput
  ): Promise<Category> {
    const cleanName = input.name?.trim();
    if (!cleanName) {
      const err: any = new Error('Category name is required.');
      err.statusCode = 400;
      throw err;
    }
    if (cleanName.length > 100) {
      const err: any = new Error('Category name cannot exceed 100 characters.');
      err.statusCode = 400;
      throw err;
    }

    const rawSlug = input.slug?.trim() || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const cleanSlug = rawSlug.replace(/^-+|-+$/g, '').toLowerCase();
    if (!cleanSlug) {
      const err: any = new Error('Valid category slug could not be determined.');
      err.statusCode = 400;
      throw err;
    }

    // Check for existing duplicates
    const { data: existing } = await client
      .from('categories')
      .select('id, name, slug')
      .or(`name.ilike.${cleanName},slug.eq.${cleanSlug}`);

    if (existing && existing.length > 0) {
      const nameConflict = existing.some((c) => c.name.toLowerCase() === cleanName.toLowerCase());
      const slugConflict = existing.some((c) => c.slug === cleanSlug);
      const err: any = new Error(
        nameConflict
          ? `A category with the name "${cleanName}" already exists.`
          : `A category with the slug "${cleanSlug}" already exists.`
      );
      err.statusCode = 409;
      throw err;
    }

    let slaHours = 48;
    if (input.sla_hours !== undefined) {
      const parsedSla = Number(input.sla_hours);
      if (isNaN(parsedSla) || !Number.isInteger(parsedSla) || parsedSla <= 0) {
        const err: any = new Error('SLA hours must be a positive integer greater than 0.');
        err.statusCode = 400;
        throw err;
      }
      slaHours = parsedSla;
    }

    const payload = {
      name: cleanName,
      slug: cleanSlug,
      description: input.description?.trim() || null,
      icon: input.icon?.trim() || null,
      sla_hours: slaHours,
      active: input.active !== undefined ? Boolean(input.active) : true,
    };

    const { data, error } = await client
      .from('categories')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      const err: any = new Error(error?.message || 'Failed to create category.');
      err.statusCode = error?.code === '42501' ? 403 : 500;
      throw err;
    }

    return {
      ...(data as Category),
      complaint_count: 0,
    };
  }

  /**
   * Updates an existing category (Admin-only).
   */
  public static async updateCategory(
    client: SupabaseClient,
    idOrSlug: string,
    input: UpdateCategoryInput
  ): Promise<Category> {
    const category = await this.getCategoryById(client, idOrSlug);
    if (!category) {
      const err: any = new Error(`Category "${idOrSlug}" not found.`);
      err.statusCode = 404;
      throw err;
    }

    const updatePayload: Record<string, any> = {};

    if (input.name !== undefined) {
      const cleanName = input.name.trim();
      if (!cleanName) {
        const err: any = new Error('Category name cannot be empty.');
        err.statusCode = 400;
        throw err;
      }
      if (cleanName.length > 100) {
        const err: any = new Error('Category name cannot exceed 100 characters.');
        err.statusCode = 400;
        throw err;
      }

      // Check name uniqueness if changed
      if (cleanName.toLowerCase() !== category.name.toLowerCase()) {
        const { data: dupName } = await client
          .from('categories')
          .select('id')
          .ilike('name', cleanName)
          .neq('id', category.id)
          .maybeSingle();

        if (dupName) {
          const err: any = new Error(`A category with the name "${cleanName}" already exists.`);
          err.statusCode = 409;
          throw err;
        }
      }
      updatePayload.name = cleanName;
    }

    if (input.slug !== undefined) {
      const cleanSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '');
      if (!cleanSlug) {
        const err: any = new Error('Category slug cannot be empty.');
        err.statusCode = 400;
        throw err;
      }

      if (cleanSlug !== category.slug) {
        const { data: dupSlug } = await client
          .from('categories')
          .select('id')
          .eq('slug', cleanSlug)
          .neq('id', category.id)
          .maybeSingle();

        if (dupSlug) {
          const err: any = new Error(`A category with the slug "${cleanSlug}" already exists.`);
          err.statusCode = 409;
          throw err;
        }
      }
      updatePayload.slug = cleanSlug;
    }

    if (input.description !== undefined) {
      updatePayload.description = input.description.trim() || null;
    }

    if (input.icon !== undefined) {
      updatePayload.icon = input.icon.trim() || null;
    }

    if (input.sla_hours !== undefined) {
      const parsedSla = Number(input.sla_hours);
      if (isNaN(parsedSla) || !Number.isInteger(parsedSla) || parsedSla <= 0) {
        const err: any = new Error('SLA hours must be a positive integer greater than 0.');
        err.statusCode = 400;
        throw err;
      }
      updatePayload.sla_hours = parsedSla;
    }

    if (input.active !== undefined) {
      updatePayload.active = Boolean(input.active);
    }

    if (Object.keys(updatePayload).length === 0) {
      return category;
    }

    const { data: updated, error } = await client
      .from('categories')
      .update(updatePayload)
      .eq('id', category.id)
      .select('*')
      .single();

    if (error || !updated) {
      const err: any = new Error(error?.message || 'Failed to update category.');
      err.statusCode = error?.code === '42501' ? 403 : 500;
      throw err;
    }

    return {
      ...(updated as Category),
      complaint_count: category.complaint_count || 0,
    };
  }

  /**
   * Toggles category active status (Admin-only).
   */
  public static async toggleCategoryStatus(
    client: SupabaseClient,
    idOrSlug: string
  ): Promise<Category> {
    const category = await this.getCategoryById(client, idOrSlug);
    if (!category) {
      const err: any = new Error(`Category "${idOrSlug}" not found.`);
      err.statusCode = 404;
      throw err;
    }

    return this.updateCategory(client, category.id, { active: !category.active });
  }

  /**
   * Deletes or deactivates a category (Admin-only).
   * If existing complaints reference the category, soft-deactivates it to preserve referential integrity.
   */
  public static async deleteCategory(
    client: SupabaseClient,
    idOrSlug: string
  ): Promise<{ message: string; deactivated: boolean; deleted: boolean; category: Category }> {
    const category = await this.getCategoryById(client, idOrSlug);
    if (!category) {
      const err: any = new Error(`Category "${idOrSlug}" not found.`);
      err.statusCode = 404;
      throw err;
    }

    // Check if any complaints reference this category
    const { count } = await client
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', category.id);

    if (count && count > 0) {
      // Deactivate rather than deleting to protect existing complaints
      const updated = await this.updateCategory(client, category.id, { active: false });
      return {
        message: `Category "${category.name}" has ${count} existing complaints and cannot be permanently deleted. It has been deactivated instead.`,
        deactivated: true,
        deleted: false,
        category: updated,
      };
    }

    // If zero complaints reference it, delete cleanly
    const { error } = await client
      .from('categories')
      .delete()
      .eq('id', category.id);

    if (error) {
      const err: any = new Error(error.message || 'Failed to delete category.');
      err.statusCode = error.code === '42501' ? 403 : 500;
      throw err;
    }

    return {
      message: `Category "${category.name}" deleted successfully.`,
      deactivated: false,
      deleted: true,
      category: { ...category, active: false },
    };
  }
}
