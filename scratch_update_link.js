const fs = require('fs');
const path = require('path');

function fixHtml(filePath) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        const targetOld = `<div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-micro-gradient flex items-center justify-center text-on-primary">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL' 1;">security</span>
        </div>
        <div>
          <h1 class="font-headline font-bold text-on-surface tracking-tighter text-lg leading-tight">Sentinel AML</h1>
          <p class="text-[10px] text-on-surface-variant font-label tracking-widest uppercase">The Ethereal Ledger</p>
        </div>
      </div>`;
        
        const newCode = `<a href="/" class="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer" style="text-decoration: none; display: flex;">
        <div class="w-8 h-8 rounded-lg bg-micro-gradient flex items-center justify-center text-on-primary">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL' 1;">security</span>
        </div>
        <div>
          <h1 class="font-headline font-bold text-on-surface tracking-tighter text-lg leading-tight">Sentinel AML</h1>
          <p class="text-[10px] text-on-surface-variant font-label tracking-widest uppercase">The Ethereal Ledger</p>
        </div>
      </a>`;
        
        if (content.indexOf(targetOld) !== -1) {
            content = content.replace(targetOld, newCode);
            fs.writeFileSync(filePath, content);
            console.log('Fixed', filePath);
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
            fixHtml(fullPath);
        }
    }
}

processDirRecursive('public/dashboard');
