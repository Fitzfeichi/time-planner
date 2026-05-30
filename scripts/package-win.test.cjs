const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');
const packageJson = require(path.join(rootDir, 'package.json'));
const packageScript = fs.readFileSync(path.join(__dirname, 'package-win.cjs'), 'utf8');

test('Windows packaging keeps only Chinese and English Electron locales', () => {
  assert.deepEqual(packageJson.build.electronLanguages, ['zh-CN', 'en-US']);
});

test('Windows packaging defaults to the portable exe only', () => {
  assert.match(packageScript, /electronBuilderBin,\s*\['--win', 'portable'\]/);
  assert.doesNotMatch(packageScript, /Compress-Archive/);
  assert.doesNotMatch(packageScript, /--dir/);
});
