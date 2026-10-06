import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

/**
 * Public Authentication Endpoints
 */
router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/refresh', AuthController.refresh);

/**
 * Protected Session & Profile Endpoints
 */
router.get('/me', requireAuth, AuthController.me);

/**
 * Privileged Administrator Endpoints
 */
router.post('/provision', requireAuth, requireAdmin, AuthController.provision);

export default router;
