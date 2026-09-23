import express from 'express';
import { getPrinterConfigs, createPrinterConfig, updatePrinterConfig, deletePrinterConfig, testPrinter, printBill, printKOT, getAvailablePorts, getAvailableNetworkPrinters, getNetworkStatus, getBluetoothDevices, getBluetoothBattery } from '../controllers/printerConfigController.js';

import { authenticateToken as protect, requireAdmin as admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getPrinterConfigs)
  .post(protect, admin, createPrinterConfig);

router.route('/usb-ports')
  .get(protect, getAvailablePorts);

router.route('/ports')
  .get(protect, getAvailablePorts);

router.route('/network-printers')
  .get(protect, getAvailableNetworkPrinters);

router.route('/network-status')
  .get(protect, getNetworkStatus);

router.route('/bluetooth-devices')
  .get(protect, getBluetoothDevices);

router.route('/bluetooth-battery/:address')
  .get(protect, getBluetoothBattery);

router.route('/print-bill')
  .post(protect, printBill);


router.route('/print-kot')
  .post(protect, printKOT);

router.route('/:id')
  .put(protect, admin, updatePrinterConfig)
  .delete(protect, admin, deletePrinterConfig);

router.route('/:id/test')
  .post(protect, admin, testPrinter);

export default router;
