const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Header layout fix inside app.html
    content = content.replace('<main class="ml-64 min-h-screen">', '<main class="ml-64 pt-16 min-h-screen">');
    // Also change the Overview padding since it compensated for the absolute header before
    content = content.replace('<div class="pt-24 px-8 pb-12', '<div class="pt-8 px-8 pb-12');
    
    // Replace $ amounts with ₹ amounts
    content = content.replace(/\$(\d)/g, '₹$1');
    content = content.replace(/sub-\$/g, 'sub-₹');
    
    fs.writeFileSync(filePath, content);
    console.log('Processed', filePath);
  }
}

processFile('public/app.html');
processFile('public/interactions.js');

// If there are other HTML files inside public/dashboard, update them too.
function processDirRecursive(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirRecursive(fullPath);
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
            processFile(fullPath);
        }
    }
}

processDirRecursive('public/dashboard');
