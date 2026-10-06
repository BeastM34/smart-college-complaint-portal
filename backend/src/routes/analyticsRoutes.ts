import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

// Campus-wide analytics are restricted exclusively to administrators
router.get('/', requireAuth, requireAdmin, AnalyticsController.getComprehensive);
router.get('/overview', requireAuth, requireAdmin, AnalyticsController.getOverview);
router.get('/complaints', requireAuth, requireAdmin, AnalyticsController.getComplaints);
router.get('/trends', requireAuth, requireAdmin, AnalyticsController.getTrends);
router.get('/categories', requireAuth, requireAdmin, AnalyticsController.getCategories);
router.get('/performance', requireAuth, requireAdmin, AnalyticsController.getPerformance);

export default router;
