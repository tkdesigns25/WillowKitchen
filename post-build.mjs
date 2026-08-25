// post-build.mjs
// Runs after `vite build` to patch dist/index.html so it opens correctly
// as a local file:// without a dev server (removes module/crossorigin attributes).

import { readFileSync, writeFileSync } from 'fs';

const htmlPath = 'dist/index.html';
let html = readFileSync(htmlPath, 'utf8');

// Remove type="module" and crossorigin from <script> tag
html = html.replace(/ type="module"/g, '');
html = html.replace(/ crossorigin/g, '');

writeFileSync(htmlPath, html, 'utf8');
console.log('✓ post-build patch applied: dist/index.html is now file:// compatible');
