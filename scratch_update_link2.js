const fs = require('fs');
const path = require('path');

function processDirRecursive(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirRecursive(fullPath);
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            
            // Regex to match the wrapping div around the logo
            // <div class="flex items-center gap-3"> ... <h1 ...>Sentinel AML</h1> ... </div>
            const regex = /<div\s+class="flex items-center gap-3">\s*<div.*?bg-micro-gradient.*?>[\s\S]*?Sentinel AML[\s\S]*?<\/div>\s*<\/div>/g;
            
            if (regex.test(content)) {
                content = content.replace(regex, (match) => {
                    return match.replace('<div class="flex items-center gap-3">', '<a href="/" class="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer" style="text-decoration: none; display: flex;">').replace(/<\/div>$/, '</a>');
                });
                fs.writeFileSync(fullPath, content);
                console.log('Fixed', fullPath);
            }
        }
    }
}

processDirRecursive('public/dashboard');
