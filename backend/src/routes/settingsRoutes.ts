import { Router } from 'express';
import { SettingsController } from '../controllers/settingsController';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

// Read operations: Available to authenticated users (safe settings whitelist)
router.get('/', requireAuth, SettingsController.getSettings);
router.get('/:key', requireAuth, SettingsController.getSettingByKey);

// Administrative operations: Admin-only
router.patch('/', requireAuth, requireAdmin, SettingsController.updateSettings);
router.patch('/:key', requireAuth, requireAdmin, SettingsController.updateSettingByKey);

export default router;
