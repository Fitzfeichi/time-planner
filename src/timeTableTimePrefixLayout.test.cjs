const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const timeTableSource = readFileSync(
  path.join(__dirname, 'components', 'TimeTable.tsx'),
  'utf8',
);
const styles = readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

function cssBlock(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  assert.ok(match, `Missing CSS block for ${selector}`);

  return match[1];
}

test('day prefix layout is limited to rows that actually show a prefix', () => {
  assert.match(timeTableSource, /row\.timePrefix === '' \? null : \(/);
  assert.match(timeTableSource, /with-day-prefix/);

  const slotTimeBlock = cssBlock('.slot-time');
  assert.doesNotMatch(slotTimeBlock, /display:\s*grid;/);
  assert.doesNotMatch(slotTimeBlock, /grid-template-columns:/);

  const prefixedSlotTimeBlock = cssBlock('.slot-time.with-day-prefix');
  assert.match(prefixedSlotTimeBlock, /display:\s*grid;/);
  assert.match(prefixedSlotTimeBlock, /grid-template-columns:\s*2\.75em\s+max-content;/);
});

test('day prefix is visually lighter than the time range', () => {
  const dayPrefixBlock = cssBlock('.slot-day-prefix');

  assert.match(dayPrefixBlock, /font-weight:\s*400;/);
});

test('merged task label spans the prefixed time columns', () => {
  const mergedTimeBlock = cssBlock('.slot-row.merged-range .slot-time::after');

  assert.match(mergedTimeBlock, /grid-column:\s*1\s*\/\s*-1;/);
});
