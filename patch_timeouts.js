const fs = require('fs');
let file = 'Backend/services/whatsappService.js';
let content = fs.readFileSync(file, 'utf8');

// Replace sendBillMedia initial Promise.race
let s1 = content.indexOf('const result = await Promise.race([');
if (s1 > -1) {
    let e1 = content.indexOf(']);', s1);
    if (e1 > -1) {
        content = content.substring(0, s1) + 'const result = await this.sock.sendMessage(jid, messagePayload);' + content.substring(e1 + 3);
    }
}

// Replace sendBillMedia retry Promise.race
let s2 = content.indexOf('const retryResult = await Promise.race([');
if (s2 > -1) {
    let e2 = content.indexOf(']);', s2);
    if (e2 > -1) {
        content = content.substring(0, s2) + 'const retryResult = await this.sock.sendMessage(jid, messagePayload);' + content.substring(e2 + 3);
    }
}

// Also replace sendMessage plain text timeouts just to be safe
let s3 = content.indexOf('const result = await Promise.race([', content.indexOf('async sendMessage('));
if (s3 > -1) {
    let e3 = content.indexOf(']);', s3);
    if (e3 > -1) {
        content = content.substring(0, s3) + 'const result = await this.sock.sendMessage(jid, { text: String(text) });' + content.substring(e3 + 3);
    }
}

let s4 = content.indexOf('return await Promise.race([');
if (s4 > -1) {
    let e4 = content.indexOf(']);', s4);
    if (e4 > -1) {
        content = content.substring(0, s4) + 'return await this.sock.sendMessage(jid, { text: String(text) });' + content.substring(e4 + 3);
    }
}

fs.writeFileSync(file, content, 'utf8');
console.log('Removed timeouts!');
