const fs = require('fs');
let file = 'Backend/controllers/whatsappController.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('const processingBills = new Set();')) {
    content = content.replace("import { uploadImage } from '../utils/cloudinary.js';", "import { uploadImage } from '../utils/cloudinary.js';\n\nconst processingBills = new Set();");
}

const s1 = content.indexOf('// --- Prevent duplicate WhatsApp sends for the same bill ---');
if (s1 > -1) {
    const e1 = content.indexOf('const BillModel = (models && models.Bill)', s1);
    if (e1 > -1) {
        const replacement = `// --- Prevent duplicate WhatsApp sends for the same bill ---
    const lockKey = \`\${tenantId}_\${billId || billNumber}\`;
    if (!forceResend) {
      if (processingBills.has(lockKey)) {
        return res.status(409).json({ error: 'This bill is currently being sent.', alreadySent: true });
      }
      processingBills.add(lockKey);
    }
    
    let models = null;
    try {
      models = req.models || (await getTenantModels(tenantId));
    } catch (e) {}

    `;
        content = content.substring(0, s1) + replacement + content.substring(e1);
    }
}

const s2 = content.indexOf('// --- DIAGNOSTIC: Log socket state BEFORE ensureConnection ---');
if (s2 > -1) {
    content = content.substring(0, s2) + 'const cleanupLock = () => { if (!forceResend) processingBills.delete(lockKey); };\n\n    ' + content.substring(s2);
}

content = content.replace("if (svcStatus.status !== 'CONNECTED' || !whatsappService.connectedNumber) {\n      console.error", "if (svcStatus.status !== 'CONNECTED' || !whatsappService.connectedNumber) {\n      cleanupLock();\n      console.error");
content = content.replace("if (!imageBase64 && !pdfBase64 && !documentBase64) {\n      console.error", "if (!imageBase64 && !pdfBase64 && !documentBase64) {\n      cleanupLock();\n      console.error");

content = content.replace("if (initialAttempt && initialAttempt.success) {\n          return res.json", "cleanupLock();\n      if (initialAttempt && initialAttempt.success) {\n          return res.json");
content = content.replace("// It failed on the first attempt", "cleanupLock();\n          // It failed on the first attempt");

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed race conditions!');
