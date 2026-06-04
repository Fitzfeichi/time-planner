const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appSource = readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');

test('browser mini popup uses the compact mini window size', () => {
  assert.match(appSource, /MINI_WINDOW_WIDTH = 260/);
  assert.match(appSource, /popup=yes,width=\$\{MINI_WINDOW_WIDTH\},height=230/);
});
