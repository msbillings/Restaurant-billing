const fs = require('fs');
let file = 'Backend/controllers/whatsappController.js';
let content = fs.readFileSync(file, 'utf8');

const oldFunc = `async function processSendBillMediaWithRetries(whatsappService, phone, payload, tenantId, billId, billNumber, BillModel, attempt = 1) {
  try {
    await whatsappService.sendBillMedia(phone, payload);
    // Success! Update DB.
    if (BillModel && (billId || billNumber)) {
      const updateQuery = billId && require('mongoose').Types.ObjectId.isValid(billId) ? { _id: billId } : { billNumber: billNumber || billId };
      await BillModel.updateOne(updateQuery, { $set: { whatsappSent: true, whatsappSentAt: new Date() } }).catch(e=>console.error(e));
    }
    console.log('[Queue] ✅ Successfully sent bill to ' + phone + ' on attempt ' + attempt);
    return { success: true };
  } catch (error) {
    if (attempt < 5) {
      console.warn('[Queue] Send failed for ' + phone + ' (Attempt ' + attempt + '/5): ' + error.message + '. Retrying in 8 seconds...');
      setTimeout(() => {
        processSendBillMediaWithRetries(whatsappService, phone, payload, tenantId, billId, billNumber, BillModel, attempt + 1);
      }, 8000);
      return { success: false, queued: true, error: error.message };
    } else {`;

const newFunc = `async function processSendBillMediaWithRetries(whatsappService, phone, payload, tenantId, billId, billNumber, BillModel, attempt = 1) {
  // Before trying, ensure it wasn't already sent by another process or previous successful retry that timed out locally
  if (attempt > 1 && BillModel && (billId || billNumber)) {
     try {
       const query = billId && require('mongoose').Types.ObjectId.isValid(billId) ? { _id: billId } : { billNumber: billNumber || billId };
       const existing = await BillModel.findOne(query).select('whatsappSent').lean();
       if (existing && existing.whatsappSent) {
          console.log('[Queue] 🛑 Bill ' + (billNumber||billId) + ' already marked as sent in DB. Stopping retries to prevent duplicate WhatsApp messages.');
          return { success: true };
       }
     } catch(e) {}
  }
  try {
    await whatsappService.sendBillMedia(phone, payload);
    // Success! Update DB.
    if (BillModel && (billId || billNumber)) {
      const updateQuery = billId && require('mongoose').Types.ObjectId.isValid(billId) ? { _id: billId } : { billNumber: billNumber || billId };
      await BillModel.updateOne(updateQuery, { $set: { whatsappSent: true, whatsappSentAt: new Date() } }).catch(e=>console.error(e));
    }
    console.log('[Queue] ✅ Successfully sent bill to ' + phone + ' on attempt ' + attempt);
    return { success: true };
  } catch (error) {
    // If the error implies the message might have actually reached WhatsApp server but Baileys timed out locally waiting for an ack, we should be extremely careful about retrying!
    // But we check DB at the top of the next retry anyway.
    if (attempt < 5) {
      console.warn('[Queue] Send failed for ' + phone + ' (Attempt ' + attempt + '/5): ' + error.message + '. Retrying in 8 seconds...');
      setTimeout(() => {
        processSendBillMediaWithRetries(whatsappService, phone, payload, tenantId, billId, billNumber, BillModel, attempt + 1);
      }, 8000);
      return { success: false, queued: true, error: error.message };
    } else {`;

if (content.includes("async function processSendBillMediaWithRetries")) {
    const start = content.indexOf('async function processSendBillMediaWithRetries');
    const end = content.indexOf('    } else {', start);
    if (start > -1 && end > -1) {
       content = content.substring(0, start) + newFunc + content.substring(end + 12);
       fs.writeFileSync(file, content, 'utf8');
       console.log('Fixed retry db check');
    }
}
