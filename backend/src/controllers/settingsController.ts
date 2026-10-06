import { Request, Response } from 'express';
import { SettingsService } from '../services/settingsService';

export class SettingsController {
  /**
   * GET /api/settings
   * Retrieve portal system settings
   */
  public static async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await SettingsService.getSettings(req.supabase!);

      res.status(200).json({
        success: true,
        message: 'System settings retrieved successfully.',
        data: settings,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve system settings.',
        error: err.message,
      });
    }
  }

  /**
   * GET /api/settings/:key
   * Retrieve a single setting by key
   */
  public static async getSettingByKey(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const result = await SettingsService.getSettingByKey(req.supabase!, key);

      res.status(200).json({
        success: true,
        message: `Setting "${result.key}" retrieved successfully.`,
        data: result,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve setting.',
        error: err.message,
      });
    }
  }

  /**
   * PATCH /api/settings
   * Update portal system settings (Admin-only)
   */
  public static async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const updated = await SettingsService.updateSettings(req.supabase!, req.body);

      res.status(200).json({
        success: true,
        message: 'System settings updated successfully.',
        data: updated,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to update system settings.',
        error: err.message,
      });
    }
  }

  /**
   * PATCH /api/settings/:key
   * Update single setting by key (Admin-only)
   */
  public static async updateSettingByKey(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const value = req.body && typeof req.body === 'object' && req.body.value !== undefined
        ? req.body.value
        : req.body;

      const result = await SettingsService.updateSettingByKey(req.supabase!, key, value);

      res.status(200).json({
        success: true,
        message: `Setting "${result.key}" updated successfully.`,
        data: result,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to update setting.',
        error: err.message,
      });
    }
  }
}
