import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

// Read operations: Available to all authenticated campus users
router.get('/', requireAuth, CategoryController.getCategories);
router.get('/:id', requireAuth, CategoryController.getCategoryById);

// Administrative operations: Admin-only
router.post('/', requireAuth, requireAdmin, CategoryController.createCategory);
router.patch('/:id/toggle-status', requireAuth, requireAdmin, CategoryController.toggleCategoryStatus);
router.patch('/:id', requireAuth, requireAdmin, CategoryController.updateCategory);
router.delete('/:id', requireAuth, requireAdmin, CategoryController.deleteCategory);

export default router;
