const fs = require('fs');
const path = require('path');

function wrapLogout(filePath) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        const logoutRegex = /<a\s+(class="[^"]*text-error[^"]*")>\s*<span class="material-symbols-outlined[^"]*">logout<\/span>Log Out\s*<\/a>/g;
        
        if (logoutRegex.test(content)) {
            content = content.replace(logoutRegex, '<a href="/" $1>\n        <span class="material-symbols-outlined text-lg">logout</span>Log Out\n      </a>');
            fs.writeFileSync(filePath, content);
            console.log('Fixed logout in', filePath);
        }
    }
}

function processDirRecursive(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirRecursive(fullPath);
        } else if (fullPath.endsWith('.html')) {
            wrapLogout(fullPath);
        }
    }
}

wrapLogout('public/app.html');
processDirRecursive('public/dashboard');
