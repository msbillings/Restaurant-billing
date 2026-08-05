const fs = require('fs');
const path = require('path');
const directoryPath = path.join(__dirname, 'src');

function processDirectory(directory) {
    fs.readdirSync(directory).forEach(file => {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;

            // Find all imports of getApiUrl
            // We can just use a simple regex to remove `import { getApiUrl } from "../config.js";` 
            // if there is another import from config.js that includes getApiUrl
            
            const lines = content.split('\n');
            let configImports = [];
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('import ') && lines[i].includes('getApiUrl') && lines[i].includes('config')) {
                    configImports.push(i);
                }
            }
            
            if (configImports.length > 1) {
                // Keep the one that has more things imported, or just the first one if they are the same
                // Actually, let's just remove the first one that is strictly `import { getApiUrl } from "...";`
                let removed = false;
                for (let i = configImports.length - 1; i >= 0; i--) {
                    let lineIndex = configImports[i];
                    if (lines[lineIndex].match(/import\s*{\s*getApiUrl\s*}\s*from\s*['"].*config(\.js)?['"];?/)) {
                        lines.splice(lineIndex, 1);
                        removed = true;
                        break;
                    }
                }
                
                if (removed) {
                    content = lines.join('\n');
                    fs.writeFileSync(fullPath, content, 'utf8');
                    console.log('Fixed duplicates in ' + fullPath);
                }
            }
        }
    });
}

processDirectory(directoryPath);
