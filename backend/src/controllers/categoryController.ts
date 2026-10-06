import { Request, Response } from 'express';
import { CategoryService } from '../services/categoryService';

export class CategoryController {
  /**
   * GET /api/categories
   * List categories (activeOnly optional)
   */
  public static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.activeOnly === 'true' || req.query.active === 'true';
      const categories = await CategoryService.listCategories(req.supabase!, activeOnly);

      res.status(200).json({
        success: true,
        message: 'Categories retrieved successfully.',
        data: categories,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve categories.',
        error: err.message,
      });
    }
  }

  /**
   * GET /api/categories/:id
   * Get category by ID or slug
   */
  public static async getCategoryById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const category = await CategoryService.getCategoryById(req.supabase!, id);

      if (!category) {
        res.status(404).json({
          success: false,
          message: `Category "${id}" not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Category retrieved successfully.',
        data: category,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve category.',
        error: err.message,
      });
    }
  }

  /**
   * POST /api/categories
   * Create new category (Admin-only)
   */
  public static async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const category = await CategoryService.createCategory(req.supabase!, req.body);

      res.status(201).json({
        success: true,
        message: 'Category created successfully.',
        data: category,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to create category.',
        error: err.message,
      });
    }
  }

  /**
   * PATCH /api/categories/:id
   * Update category (Admin-only)
   */
  public static async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const category = await CategoryService.updateCategory(req.supabase!, id, req.body);

      res.status(200).json({
        success: true,
        message: 'Category updated successfully.',
        data: category,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to update category.',
        error: err.message,
      });
    }
  }

  /**
   * PATCH /api/categories/:id/toggle-status
   * Toggle category active status (Admin-only)
   */
  public static async toggleCategoryStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const category = await CategoryService.toggleCategoryStatus(req.supabase!, id);

      res.status(200).json({
        success: true,
        message: `Category "${category.name}" is now ${category.active ? 'active' : 'inactive'}.`,
        data: category,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to toggle category status.',
        error: err.message,
      });
    }
  }

  /**
   * DELETE /api/categories/:id
   * Delete or deactivate category (Admin-only)
   */
  public static async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await CategoryService.deleteCategory(req.supabase!, id);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to delete category.',
        error: err.message,
      });
    }
  }
}
