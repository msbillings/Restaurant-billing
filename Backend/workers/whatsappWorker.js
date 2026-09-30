import { Worker } from 'bullmq';
import { connection } from './queueManager.js';
import whatsappManager from '../services/whatsappService.js';
import mongoose from 'mongoose';

import { getTenantModels } from '../utils/tenantManager.js';

export const startWhatsAppWorker = () => {
  const worker = new Worker('WhatsAppQueue', async (job) => {
    const {
      tenantDb,
      phone,
      billText,
      imageBase64,
      pdfBase64,
      documentBase64,
      mimetype,
      fileName,
      billId,
      billNumber,
      forceResend
    } = job.data;

    console.log(`[WhatsApp Worker] Processing Job ${job.id} for phone: ${phone}`);

    // Since this is a worker, we might not have a full `req` object for getTenantModel.
    // We can simulate the `req` object for the tenant helper if needed, or query directly.
    if (!tenantDb) {
      throw new Error('[WhatsApp Worker] Missing tenantDb in job payload. Refusing to process against global master database.');
    }

    let updateResult = null;
    let BillModel = null;
    if (billId) {
       const models = await getTenantModels(tenantDb);
       BillModel = models.Bill;
       if (!BillModel) {
         throw new Error(`[WhatsApp Worker] Failed to resolve Bill model for tenant ${tenantDb}`);
       }
    }

    try {
      const whatsappService = whatsappManager.getInstance(tenantDb || 'default');
      await whatsappService.ensureConnection();

      const svcStatus = whatsappService.getStatus();
      if (svcStatus.status !== 'CONNECTED' || !whatsappService.connectedNumber) {
        throw new Error('WhatsApp bot is not connected for tenant ' + tenantDb);
      }

      await whatsappService.sendBillMedia(phone, {
        imageBase64,
        imageUrl: null, // Removed cloudinary
        pdfBase64,
        documentBase64,
        mimetype,
        caption: billText,
        fileName
      });

      if (BillModel && billId) {
        updateResult = await BillModel.updateOne(
          { _id: billId },
          { $set: { isWhatsappSent: true } }
        );
      }
      console.log(`[WhatsApp Worker] Job ${job.id} completed successfully.`);
    } catch (error) {
      console.error(`[WhatsApp Worker] Job ${job.id} error:`, error.message);
      throw error;
    }
  }, {
    connection,
    concurrency: 5 // Process up to 5 WhatsApp messages simultaneously
  });

  worker.on('failed', (job, err) => {
    console.error(`[WhatsApp Worker] Job ${job?.id} failed with error: ${err.message}`);
  });

  console.log('[WhatsApp Worker] Started and listening to WhatsAppQueue');
  return worker;
};
