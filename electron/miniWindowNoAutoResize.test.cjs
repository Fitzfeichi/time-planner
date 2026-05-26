const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('mini renderer does not request automatic Electron window resizing', () => {
  const appSource = readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');

  assert.equal(appSource.includes('ResizeObserver'), false);
  assert.equal(appSource.includes('resizeMiniWindow'), false);
});
