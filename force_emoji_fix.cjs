const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Frontend', 'src', 'components', 'Invoice.jsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('HOME DELIVERY E-BILL')) {
    lines[i] = "      : `🛵 *HOME DELIVERY E-BILL* 🛵\\n🏠 *${restName.toUpperCase()}* | Bill #${billNo}`;";
  }
  if (lines[i].includes('thank you for your takeaway order!')) {
    lines[i] = "      ? `🛍️ Dear *${customerName}*, thank you for your takeaway order!\\n🧾 *Takeaway e-Bill #${billNo}* | *${restName.toUpperCase()}*`";
  }
  if (lines[i].includes('TAKEAWAY E-BILL RECEIPT')) {
    lines[i] = "      : `🛍️ *TAKEAWAY E-BILL RECEIPT* 🛍️\\n📦 *${restName.toUpperCase()}* | Bill #${billNo}`;";
  }
  if (lines[i].includes('DIGITAL E-BILL RECEIPT')) {
    lines[i] = "      : `🧾 *DIGITAL E-BILL RECEIPT* 🧾\\n🍽️ *${restName.toUpperCase()}* | Bill #${billNo}`;";
  }
  if (lines[i].includes('s.address ?')) {
    lines[i] = "      (s.address ? `📍 ${s.address.split('\\n')[0]}\\n` : '') +";
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Force-replaced emoji lines by index matching in Invoice.jsx');
