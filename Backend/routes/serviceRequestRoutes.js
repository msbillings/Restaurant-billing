import express from 'express';
const router = express.Router();
import { getActiveRequests, resolveRequest } from '../controllers/serviceRequestController.js';

router.get('/', getActiveRequests);
router.put('/:id/resolve', resolveRequest);

export default router;
