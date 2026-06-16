const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appSource = readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');
const dayHeaderSource = readFileSync(path.join(__dirname, 'components', 'DayHeader.tsx'), 'utf8');

test('day header receives whether the current date is today', () => {
  assert.match(dayHeaderSource, /isViewingToday:\s*boolean;/);
  assert.match(
    appSource,
    /<DayHeader[\s\S]*?isViewingToday=\{isViewingToday\}[\s\S]*?onToday=\{goToday\}/,
  );
});

test('today button is only primary when viewing another date', () => {
  assert.match(
    dayHeaderSource,
    /className=\{isViewingToday \? undefined : 'primary-button'\}/,
  );
});
