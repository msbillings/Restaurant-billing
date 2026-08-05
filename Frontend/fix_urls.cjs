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
            if (fullPath.endsWith('config.js') || fullPath.endsWith('axios.js') || fullPath.endsWith('update_urls.cjs')) return;
            
            let content = fs.readFileSync(fullPath, 'utf8');
            const original = content;
            
            // Replace 'http://localhost:5002/api' with getApiUrl()
            content = content.replace(/'http:\/\/localhost:5002\/api\/?([^']*)'/g, '`${getApiUrl()}/$1`');
            
            // Replace `http://localhost:5002/api...` with `${getApiUrl()}...`
            content = content.replace(/http:\/\/localhost:5002\/api/g, '${getApiUrl()}');

            // Replace http://127.0.0.1:5002/api with ${getApiUrl()}
            content = content.replace(/http:\/\/127\.0\.0\.1:5002\/api/g, '${getApiUrl()}');
            
            // Clean up if it results in `${getApiUrl()}/`
            content = content.replace(/`\$\{getApiUrl\(\)\}\/`/g, 'getApiUrl()');
            content = content.replace(/`\$\{getApiUrl\(\)\}`/g, 'getApiUrl()');
            
            if (content !== original) {
                // Ensure getApiUrl is imported
                if (!content.includes('getApiUrl')) {
                    const importPath = getDepth(fullPath).replace(/\\/g, '/');
                    const importStmt = `import { getApiUrl } from "${importPath}";\n`;
                    
                    const importRegex = /^import .*?;?\n/gm;
                    let lastIndex = 0;
                    let match;
                    while ((match = importRegex.exec(content)) !== null) {
                        lastIndex = match.index + match[0].length;
                    }
                    
                    content = content.substring(0, lastIndex) + importStmt + content.substring(lastIndex);
                }
                
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Updated ' + fullPath);
            }
        }
    });
}

processDirectory(directoryPath);
