// post-build.mjs
// Runs after `vite build` to create a standalone.html for local file:// access.
//
// Rules:
// - NEVER touches root index.html (Vite needs it as its source template)
// - NEVER modifies dist/ (Vercel and gh-pages serve from dist/ — leave it clean)
// - Generates standalone.html by inlining all JS + CSS into one self-contained file
//   so it can be opened by double-clicking with no server, no assets/ folder needed.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const distDir = 'dist';
const distAssetsDir = join(distDir, 'assets');

const html = readFileSync(join(distDir, 'index.html'), 'utf8');

// Find JS and CSS asset filenames from the built HTML
const jsMatch = html.match(/src="\.\/assets\/(index-[^"]+\.js)"/);
const cssMatch = html.match(/href="\.\/assets\/(index-[^"]+\.css)"/);

if (!jsMatch) {
  console.error('❌ Could not find JS asset in dist/index.html');
  process.exit(1);
}

const jsContent = readFileSync(join(distAssetsDir, jsMatch[1]), 'utf8');
const cssContent = cssMatch ? readFileSync(join(distAssetsDir, cssMatch[1]), 'utf8') : '';

// Build standalone HTML — inline everything, no external deps, no type=module
let standalone = html;

// Replace <link rel=stylesheet ...> with inline <style>
if (cssMatch) {
  standalone = standalone.replace(
    /<link rel="stylesheet"[^>]+>/,
    `<style>\n${cssContent}\n</style>`
  );
}

// Replace <script type="module" ...></script> with inline <script defer>
standalone = standalone.replace(
  /<script type="module"[^>]+><\/script>/,
  `<script defer>\n${jsContent}\n</script>`
);

// Strip crossorigin attributes
standalone = standalone.replace(/ crossorigin/g, '');

writeFileSync('standalone.html', standalone, 'utf8');

const kb = Math.round(standalone.length / 1024);
console.log(`✓ Generated standalone.html (${kb} KB) — open by double-clicking, no server needed`);
console.log('✓ dist/ and root index.html left untouched');
