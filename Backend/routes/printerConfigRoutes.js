import express from 'express';
import { getPrinterConfigs, createPrinterConfig, updatePrinterConfig, deletePrinterConfig, testPrinter } from '../controllers/printerConfigController.js';
import { authenticateToken as protect, requireAdmin as admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getPrinterConfigs)
  .post(protect, admin, createPrinterConfig);

router.route('/:id')
  .put(protect, admin, updatePrinterConfig)
  .delete(protect, admin, deletePrinterConfig);

router.route('/:id/test')
  .post(protect, admin, testPrinter);

export default router;
