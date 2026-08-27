// post-build.mjs
// Runs after `vite build`.
// 
// 1. Prepares dist/ for Vercel / GitHub Pages:
//    Renames dist/index.source.html -> dist/index.html
//
// 2. Prepares standalone inlined HTML files (index.html and standalone.html)
//    for direct local file:// opening with ZERO server or network dependencies.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const distDir = 'dist';
const distAssetsDir = join(distDir, 'assets');

// 1. Ensure dist/index.html exists for Vercel / hosting
const distSourceHtmlPath = join(distDir, 'index.source.html');
const distHtmlPath = join(distDir, 'index.html');

if (existsSync(distSourceHtmlPath)) {
  copyFileSync(distSourceHtmlPath, distHtmlPath);
  console.log('✓ Created dist/index.html for Vercel / web hosting');
}

const distHtml = readFileSync(distHtmlPath, 'utf8');

// Find JS and CSS asset filenames from the built HTML
const jsMatch = distHtml.match(/src="\.\/assets\/([^"]+\.js)"/);
const cssMatch = distHtml.match(/href="\.\/assets\/([^"]+\.css)"/);

if (!jsMatch) {
  console.error('❌ Could not find JS asset in dist/index.html');
  process.exit(1);
}

const jsContent = readFileSync(join(distAssetsDir, jsMatch[1]), 'utf8');
const cssContent = cssMatch ? readFileSync(join(distAssetsDir, cssMatch[1]), 'utf8') : '';

// 2. Build the self-contained, standalone single-file HTML
// Clean template based on distHtml
let standalone = distHtml;

// Replace CSS <link> with inline <style> (use function replacer to avoid pattern substitution)
if (cssMatch) {
  standalone = standalone.replace(
    /<link rel="stylesheet"[^>]+>/,
    () => `<style>\n${cssContent}\n</style>`
  );
}

// Remove module script from <head>
standalone = standalone.replace(/<script type="module"[^>]+><\/script>/, '');

// Strip any remaining crossorigin attributes
standalone = standalone.replace(/ crossorigin/g, '');

// CRITICAL FOR BROWSER RUNTIME:
// 1) Escape any </script> sequences inside JS string literals so browser HTML parser doesn't close script early
// 2) Place <script> at the bottom of <body> AFTER <div id="root"></div> so document.getElementById('root') is NOT null!
const safeJsContent = jsContent.replace(/<\/script>/gi, '<\\/script>');
standalone = standalone.replace(
  '</body>',
  () => `<script>\n${safeJsContent}\n</script>\n</body>`
);

// Save as both index.html (so opening folder or index.html works) AND standalone.html
writeFileSync('index.html', standalone, 'utf8');
writeFileSync('standalone.html', standalone, 'utf8');

const kb = Math.round(standalone.length / 1024);
console.log(`✓ Generated self-contained index.html & standalone.html (${kb} KB)`);
console.log('✓ Script placed after <div id="root"></div> for flawless local execution');
console.log('✓ Ready for direct local double-clicking AND web deployment!');
