// post-build.mjs
// After every `vite build`:
// 1. Patches dist/index.html (removes type="module", adds defer, strips crossorigin)
// 2. Copies the patched index.html + compiled assets to the project root
//    so double-clicking the root index.html opens the app with no server needed.

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const distDir = 'dist';
const rootAssets = 'assets';

// --- Patch dist/index.html ---
const htmlPath = join(distDir, 'index.html');
let html = readFileSync(htmlPath, 'utf8');
html = html.replace(/ type="module"/g, ' defer');
html = html.replace(/ crossorigin/g, '');
writeFileSync(htmlPath, html, 'utf8');
console.log('✓ Patched dist/index.html (defer, no type=module)');

// --- Copy built assets to root ---
mkdirSync(rootAssets, { recursive: true });
const assetFiles = readdirSync(join(distDir, 'assets'));
for (const file of assetFiles) {
  copyFileSync(join(distDir, 'assets', file), join(rootAssets, file));
}
console.log(`✓ Copied ${assetFiles.length} asset(s) to root /assets/`);

// --- Copy patched index.html to root ---
copyFileSync(htmlPath, 'index.html');
console.log('✓ Copied patched index.html to project root');

// --- Copy favicon ---
try {
  copyFileSync(join(distDir, 'favicon.svg'), 'favicon.svg');
  console.log('✓ Copied favicon.svg to root');
} catch {}

console.log('\n🎉 Done! Open index.html directly in your browser — no server needed.');
