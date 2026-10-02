
const fs = require('fs');
let file = 'Backend/controllers/whatsappController.js';
let content = fs.readFileSync(file, 'utf8');

const startStr = '      let imageUrl = null;';
const endStr = "e-Bill sent successfully via WhatsApp!' });";

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr, startIdx);

if (startIdx > -1 && endIdx > -1) {
  const replacement = `      let imageUrl = null;
      // Dispatch to dynamic retry queue
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
      }
      `;
  
  content = content.substring(0, startIdx) + replacement + content.substring(endIdx + endStr.length);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully replaced logic!');
} else {
  console.log('Failed to find indices');
}
