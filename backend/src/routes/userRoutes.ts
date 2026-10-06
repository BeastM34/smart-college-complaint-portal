import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { requireAuth, requireAdmin, requireStaffOrAdmin } from '../middleware/authMiddleware';

const router = Router();

// Staff listing: Available to staff & administrators for ticket assignment
router.get('/staff', requireAuth, requireStaffOrAdmin, UserController.getStaff);

// Global user directory: Admin-only
router.get('/', requireAuth, requireAdmin, UserController.getUsers);

// User profile detail: Admin or Self
router.get('/:id', requireAuth, UserController.getUserById);

// Account status toggle: Admin-only
router.patch('/:id/status', requireAuth, requireAdmin, UserController.toggleUserStatus);

export default router;
