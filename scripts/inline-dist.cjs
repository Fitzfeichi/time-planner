const fs = require('node:fs');
const path = require('node:path');

const distDir = path.resolve(__dirname, '..', 'dist');
const htmlPath = path.join(distDir, 'index.html');

let html = fs.readFileSync(htmlPath, 'utf8');
let inlineScript = '';

html = html.replace(
  /<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/,
  (_tag, assetPath) => {
    const css = fs.readFileSync(path.join(distDir, assetPath), 'utf8');
    return `<style>\n${css.replaceAll('</style', '<\\/style')}\n</style>`;
  },
);

html = html.replace(
  /<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/,
  (_tag, assetPath) => {
    const js = fs
      .readFileSync(path.join(distDir, assetPath), 'utf8')
      .replace(/import\((["'])\.\/([^"']+\.js)\1\)/g, 'import($1./assets/$2$1)');
    inlineScript = `<script type="module">\n${js.replaceAll('</script', '<\\/script')}\n</script>`;
    return '';
  },
);

if (inlineScript) {
  html = html.replace('\n  </body>', () => `\n    ${inlineScript}\n  </body>`);
}

fs.writeFileSync(htmlPath, html, 'utf8');
