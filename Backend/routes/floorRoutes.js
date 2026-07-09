import express from 'express';
import { getFloors, saveFloors, updateTableStatus } from '../controllers/floorController.js';
import { authenticateToken } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';

const router = express.Router();

router.use(authenticateToken);
router.use(tenantMiddleware);

router.get('/', getFloors);
router.post('/', saveFloors);
router.put('/:floorId/tables/:tableId/status', updateTableStatus);

export default router;
