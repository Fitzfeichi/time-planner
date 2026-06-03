const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const styles = readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const appSource = readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');

function cssBlock(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  assert.ok(match, `Missing CSS block for ${selector}`);

  return match[1];
}

function miniPinSvg() {
  const match = appSource.match(/<svg\s+className="mini-pin-icon"[\s\S]*?<\/svg>/);

  assert.ok(match, 'Missing mini pin svg');

  return match[0];
}

test('mini pin button uses default muted color and transparent background', () => {
  assert.match(cssBlock('.mini-title-button'), /color:\s*var\(--color-muted-strong\);/);
  assert.match(cssBlock('.mini-title-button::before'), /background:\s*transparent;/);
});

test('mini pin button hover and active states use the existing blue treatment', () => {
  assert.match(
    styles,
    /\.mini-title-button:hover::before,\s*\.mini-pin-button\.active::before\s*\{[^}]*background:\s*var\(--color-primary-soft\);/s,
  );
  assert.match(
    styles,
    /\.mini-title-button:hover,\s*\.mini-pin-button\.active\s*\{[^}]*color:\s*var\(--color-primary\);/s,
  );
});

test('mini pin icon uses the traced pushpin svg with a heavier currentColor shape', () => {
  const iconBlock = cssBlock('.mini-pin-icon');
  const svg = miniPinSvg();

  assert.match(svg, /<svg[^>]*className="mini-pin-icon"/);
  assert.match(svg, /viewBox="0 0 487 691"/);
  assert.match(svg, /fill="currentColor"/);
  assert.match(svg, /stroke="currentColor"/);
  assert.match(svg, /strokeWidth="34"/);
  assert.match(svg, /strokeLinejoin="round"/);
  assert.match(svg, /M 337 41 L 296 27 L 263 21/);
  assert.doesNotMatch(svg, /<script|on\w+=|href=/i);
  assert.match(iconBlock, /width:\s*16px;/);
  assert.match(iconBlock, /height:\s*16px;/);
  assert.match(iconBlock, /z-index:\s*1;/);
  assert.doesNotMatch(iconBlock, /transform:/);
  assert.doesNotMatch(styles, /\.mini-pin-icon::before/);
  assert.doesNotMatch(styles, /\.mini-pin-icon::after/);
});
