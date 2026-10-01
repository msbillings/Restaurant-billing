const fs = require('fs');
let file = 'Backend/services/whatsappService.js';
let content = fs.readFileSync(file, 'utf8');

// Replace the fallback 1
let s1 = content.indexOf('else if (caption) {\n              console.warn');
if (s1 === -1) {
    s1 = content.indexOf('else if (caption) {');
}
if (s1 > -1) {
    let e1 = content.indexOf('} else {', s1);
    if (e1 > -1) {
        content = content.substring(0, s1) + content.substring(e1);
    }
}

// Replace the fallback 2
let s2 = content.indexOf('if (caption) {');
while (s2 > -1) {
    if (content.substring(s2, s2 + 100).includes('fallback')) {
        let e2 = content.indexOf('throw retryErr;', s2);
        if (e2 > -1) {
            content = content.substring(0, s2) + content.substring(e2);
        }
    }
    s2 = content.indexOf('if (caption) {', s2 + 1);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Removed all text fallbacks.');
