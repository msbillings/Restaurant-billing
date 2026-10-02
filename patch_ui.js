const fs = require('fs');
let file = 'Frontend/src/components/BillingPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const marker1 = 'markBillAlreadySent(billNo);';
const marker2 = '} else {';
const s = content.indexOf(marker1);
if (s > -1) {
    const e = content.indexOf(marker2, s);
    if (e > -1) {
        const replacement = `markBillAlreadySent(billNo);
          window.dispatchEvent(new CustomEvent('whatsappSent', { detail: { billNumber: billNo } }));
          if (res.queued) {
            console.log(\`[Instant WhatsApp Auto-Send] ⏳ Queued for background delivery to +\${cleanPhone}\`);
            setToast({ message: \`WhatsApp e-Bill queued for background delivery (will retry up to 5 times) ⏳\`, type: 'info' });
          } else {
            console.log(\`[Instant WhatsApp Auto-Send] ✅ Receipt Image & Message delivered to +\${cleanPhone} successfully!\`);
            setToast({ message: \`e-Bill & Receipt Image sent to +\${cleanPhone} via WhatsApp! ✓\`, type: 'success' });
          }
        `;
        content = content.substring(0, s) + replacement + content.substring(e);
        fs.writeFileSync(file, content, 'utf8');
        console.log('UI patched!');
    }
}
