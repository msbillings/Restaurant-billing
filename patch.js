const fs = require('fs');
let file = 'Backend/controllers/whatsappController.js';
let content = fs.readFileSync(file, 'utf8');

const retryFunc = `
async function processSendBillMediaWithRetries(whatsappService, phone, payload, tenantId, billId, billNumber, BillModel, attempt = 1) {
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
    } else {
      console.error('[Queue] ❌ Send permanently failed for ' + phone + ' after 5 attempts!');
      // Try Cloud Gateway as last resort on 5th failure
      const isCloud = process.env.RENDER || process.env.VERCEL;
      if (!isCloud) {
        console.warn('[Queue] Fallback to 24/7 Cloud Gateway...');
        try {
          const cloudUrl = 'https://msbillings-backend-x9qw.onrender.com/api/whatsapp/send-bill';
          const fetchParams = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-db': tenantId },
            body: JSON.stringify({ phone, imageBase64: payload.imageBase64, pdfBase64: payload.pdfBase64, documentBase64: payload.documentBase64, mimetype: payload.mimetype, billText: payload.caption, fileName: payload.fileName, billId, billNumber, forceResend: true })
          };
          fetch(cloudUrl, fetchParams).then(r => r.json()).then(cloudData => {
             if (cloudData && cloudData.success) {
                console.log('[Queue] ✅ Cloud Gateway fallback succeeded!');
                if (BillModel && (billId || billNumber)) {
                  const updateQuery = billId && require('mongoose').Types.ObjectId.isValid(billId) ? { _id: billId } : { billNumber: billNumber || billId };
                  BillModel.updateOne(updateQuery, { $set: { whatsappSent: true, whatsappSentAt: new Date() } }).catch(e=>{});
                }
             }
          }).catch(e => console.error('[Queue] Cloud gateway fallback error:', e.message));
        } catch(e) {}
      }
      return { success: false, queued: false };
    }
  }
}
`;

if (!content.includes('processSendBillMediaWithRetries')) {
  content = content.replace('export const resolveTenantInfo', retryFunc + '\nexport const resolveTenantInfo');
}

// Now replace the inside of sendBill to use the queue
const target = `      try {
        console.log(\`[WhatsApp sendBill] Sending MEDIA (Receipt Photo) to \${phone}... (hasCloudUrl=\${!!imageUrl})\`);
        await whatsappService.sendBillMedia(phone, {
          imageBase64,
          imageUrl,
          pdfBase64,
          documentBase64,
          mimetype,
          caption: billText,
          fileName
        });
        console.log(\`[WhatsApp sendBill] ✅ Receipt photo & media sent successfully to \${phone}\`);
      } catch (sendErr) {
        // If local socket send failed (e.g. Baileys conflict with 24/7 Render cloud gateway),
        // seamlessly forward the bill send request to the Render Cloud Gateway!
        const isCloud = process.env.RENDER || process.env.VERCEL;
        if (!isCloud) {
          console.warn(\`[WhatsApp sendBill] Local send failed (\${sendErr.message}). Fallback to 24/7 Cloud Gateway...\`);
          try {
            const cloudUrl = 'https://msbillings-backend-x9qw.onrender.com/api/whatsapp/send-bill';
            const cloudRes = await fetch(cloudUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-tenant-db': tenantId,
                ...(req.headers['authorization'] ? { 'authorization': req.headers['authorization'] } : {})
              },
              body: JSON.stringify(req.body)
            });
            const cloudData = await cloudRes.json();
            if (cloudRes.ok && cloudData?.success) {
              console.log('[WhatsApp sendBill] ✅ Cloud Gateway fallback succeeded!');
              // Mark bill as sent in DB
              if (BillModel && (billId || billNumber)) {
                try {
                  const updateQuery = billId && mongoose.Types.ObjectId.isValid(billId)
                    ? { _id: billId }
                    : { billNumber: billNumber || billId };
                  await BillModel.updateOne(updateQuery, {
                    $set: { whatsappSent: true, whatsappSentAt: new Date() }
                  });
                } catch (e) {}
              }
              return res.json({ success: true, message: 'e-Bill sent successfully via Cloud Gateway!' });
            }
          } catch (cloudErr) {
            console.warn('[WhatsApp sendBill] Cloud gateway fallback error:', cloudErr.message);
          }
        }
        throw sendErr;
      }

      // --- Mark bill as sent in DB ---
      if (BillModel && (billId || billNumber)) {
        try {
          const updateQuery = billId && mongoose.Types.ObjectId.isValid(billId)
            ? { _id: billId }
            : { billNumber: billNumber || billId };
          const updateRes = await BillModel.updateOne(updateQuery, {
            $set: { whatsappSent: true, whatsappSentAt: new Date() }
          });
          console.log(\`[WhatsApp sendBill] ✅ Marked bill \${billNumber || billId} as whatsappSent in DB (matched: \${updateRes?.matchedCount}, modified: \${updateRes?.modifiedCount})\`);
        } catch (dbErr) {
          console.warn('[WhatsApp sendBill] Could not update Bill whatsappSent flag:', dbErr?.message);
        }
      }

      res.json({ success: true, message: 'e-Bill sent successfully via WhatsApp!' });`;

const replacement = `      // Dispatch to dynamic retry queue
      console.log(\`[WhatsApp sendBill] Queueing MEDIA (Receipt Photo) to \${phone}... (hasCloudUrl=\${!!imageUrl})\`);
      
      const payload = {
          imageBase64,
          imageUrl,
          pdfBase64,
          documentBase64,
          mimetype,
          caption: billText,
          fileName
      };
      
      // Do not block the request. Send the first attempt and handle retries asynchronously.
      const initialAttempt = await processSendBillMediaWithRetries(whatsappService, phone, payload, tenantId, billId, billNumber, BillModel, 1);
      
      if (initialAttempt && initialAttempt.success) {
          return res.json({ success: true, message: 'e-Bill sent successfully via WhatsApp!' });
      } else {
          // It failed on the first attempt, but it's now dynamically in the queue!
          // We return an error so the frontend knows it hasn't successfully sent YET, 
          // but we do NOT stop the background retries.
          return res.status(500).json({ 
              error: 'WhatsApp dispatch failed immediately. Queued for background retries.', 
              queued: true,
              message: initialAttempt.error
          });
      }`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
