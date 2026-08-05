const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function getDepth(filePath) {
    const relPath = path.relative(path.join(__dirname, 'src'), filePath);
    const depth = relPath.split(path.sep).length - 1;
    if (depth === 0) return './config.js';
    return '../'.repeat(depth) + 'config.js';
}

function processDirectory(directory) {
    fs.readdirSync(directory).forEach(file => {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            if (fullPath.endsWith('config.js')) return;
            
            let content = fs.readFileSync(fullPath, 'utf8');
            const original = content;
            
            // Replace VITE_API_URL fallback patterns
            content = content.replace(/\(navigator\.userAgent\.toLowerCase\(\)\.includes\('electron'\)\s*\?\s*'http:\/\/localhost:5002\/api'\s*:\s*\(import\.meta\.env\.VITE_API_URL\s*\|\|\s*'http:\/\/localhost:5002\/api'\)\)/g, 'getApiUrl()');
            content = content.replace(/import\.meta\.env\.VITE_API_URL\s*\|\|\s*'http:\/\/localhost:5002\/api'/g, 'getApiUrl()');
            
            // Replace SUPERADMIN URL fallback patterns
            content = content.replace(/import\.meta\.env\.VITE_SUPERADMIN_API_URL\s*\|\|\s*'(https:\/\/restaurant-superadmin-api-maheer\.vercel\.app|http:\/\/localhost:4000)'/g, 'getSuperadminApiUrl()');
            
            if (content !== original) {
                const importPath = getDepth(fullPath).replace(/\\/g, '/');
                const importStmt = `import { getApiUrl, getSuperadminApiUrl } from "${importPath}";\n`;
                
                // insert after last import
                const importRegex = /^import .*?;?\n/gm;
                let lastIndex = 0;
                let match;
                while ((match = importRegex.exec(content)) !== null) {
                    lastIndex = match.index + match[0].length;
                }
                
                content = content.substring(0, lastIndex) + importStmt + content.substring(lastIndex);
                
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    });
}

processDirectory(directoryPath);
