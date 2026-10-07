import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

// ==============================================================================
// Notification Endpoints (Phase 4C)
// Base path: /api/notifications
// ==============================================================================

// Retrieve notifications for authenticated user
router.get(
  '/',
  requireAuth,
  NotificationController.getNotifications
);

// Get count of unread notifications for authenticated user
// Declared before /:id routes to avoid parameter collision
router.get(
  '/unread-count',
  requireAuth,
  NotificationController.getUnreadCount
);

// Dispatch administrative broadcast notification (Admin only)
router.post(
  '/broadcast',
  requireAuth,
  requireAdmin,
  NotificationController.createBroadcast
);

// List administrative broadcast history (Admin only)
router.get(
  '/broadcasts',
  requireAuth,
  requireAdmin,
  NotificationController.listBroadcasts
);

// Mark all unread notifications as read for authenticated user
// Declared before /:id routes to avoid parameter collision
router.patch(
  '/read-all',
  requireAuth,
  NotificationController.markAllAsRead
);

// Mark a single notification as read
router.patch(
  '/:id/read',
  requireAuth,
  NotificationController.markAsRead
);

export default router;
