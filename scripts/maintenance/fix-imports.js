const fs = require('fs');
const path = require('path');

const replacements = {
    "@/components/loading-skeleton": "@/components/feedback/loading-skeleton",
    "@/components/empty-state": "@/components/feedback/empty-state",
    "@/components/maintenance-scene": "@/components/feedback/maintenance-scene",
    "@/components/onboarding-modal": "@/components/feedback/onboarding-modal",
    "@/components/sidebar": "@/components/layout/sidebar",
    "@/components/theme-toggle": "@/components/layout/theme-toggle",
    "@/components/language-picker": "@/components/layout/language-picker",
    "@/components/navbar": "@/components/layout/navbar",
    "@/components/mobile-nav": "@/components/layout/mobile-nav",
    "@/components/premium-search-input": "@/components/search/premium-search-input",
    "@/components/ai-suggestions": "@/components/search/ai-suggestions",
    "@/components/search-skeleton": "@/components/search/search-skeleton",
    "@/components/search-highlight": "@/components/search/search-highlight",
    "@/components/browser-search-animation": "@/components/search/browser-search-animation",
    "@/components/filter-bar": "@/components/search/filter-bar",
    "@/components/search-bar": "@/components/search/search-bar",
    "@/components/user-search": "@/components/search/user-search",
    "@/components/enhanced-tool-detail-modal": "@/components/tools/enhanced-tool-detail-modal",
    "@/components/pricing-badge": "@/components/tools/pricing-badge",
    "@/components/review-card": "@/components/tools/review-card",
    "@/components/tool-image": "@/components/tools/tool-image",
    "@/components/collection-card": "@/components/tools/collection-card",
    "@/components/tool-card": "@/components/tools/tool-card"
};

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walkDir(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walkDir(path.join(__dirname, '..', 'app'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    for (const [key, value] of Object.entries(replacements)) {
        if (content.includes(key)) {
            // Use regex to replace all occurrences globally, and account for quotes
            const regex = new RegExp(key, 'g');
            content = content.replace(regex, value);
            modified = true;
        }
    }
    if (modified) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
