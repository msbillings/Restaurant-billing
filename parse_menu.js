const fs = require('fs');
const data = JSON.parse(fs.readFileSync('Backend/backups/backup_2026-07-10.json', 'utf8'));
console.log(JSON.stringify(data.menuItems[0], null, 2));
