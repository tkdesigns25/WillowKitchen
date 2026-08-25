// post-build.mjs
// Runs after `vite build` to patch dist/index.html so it opens directly
// as a local file:// without a dev server.
// - Replaces type="module" with defer (module scripts auto-defer; plain scripts don't — without defer React tries to mount before #root exists)
// - Strips crossorigin attribute (not needed for local files)

import { readFileSync, writeFileSync } from 'fs';

const htmlPath = 'dist/index.html';
let html = readFileSync(htmlPath, 'utf8');

// Replace type="module" with defer, strip crossorigin
html = html.replace(/ type="module"/g, ' defer');
html = html.replace(/ crossorigin/g, '');

writeFileSync(htmlPath, html, 'utf8');
console.log('✓ post-build patch applied: dist/index.html is now file:// compatible');
