const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appSource = readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');
const timeTableSource = readFileSync(path.join(__dirname, 'components', 'TimeTable.tsx'), 'utf8');
const styles = readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

test('current task positioning scrolls only the time table list', () => {
  assert.match(appSource, /function scrollSlotListToSecondVisibleRow/);
  assert.match(appSource, /querySelector<HTMLElement>\('\.slot-list'\)/);
  assert.match(appSource, /listElement\.scrollTop \+=/);
  assert.match(appSource, /hasAutoScrolledToCurrentSlot/);

  const jumpToCurrentSlotMatch = appSource.match(
    /function jumpToCurrentSlot\(\) \{[\s\S]*?\n  \}/,
  );

  assert.ok(jumpToCurrentSlotMatch, 'Missing jumpToCurrentSlot function');
  assert.match(jumpToCurrentSlotMatch[0], /scrollSlotListToSecondVisibleRow/);
  assert.doesNotMatch(jumpToCurrentSlotMatch[0], /scrollIntoView/);
});

test('time table can render editable tomorrow rows with a matching time prefix', () => {
  assert.match(timeTableSource, /tomorrowDateKey\?: string;/);
  assert.match(timeTableSource, /onSelectDatedSlot:/);
  assert.match(timeTableSource, /timePrefix: '（明）'/);
  assert.doesNotMatch(timeTableSource, /timePrefix: '（明） '/);
  assert.match(timeTableSource, /data-date-key=\{row\.dateKey\}/);
  assert.match(timeTableSource, /className="slot-day-prefix"/);
  assert.match(timeTableSource, /className="slot-time-value"/);
  assert.match(timeTableSource, /\{row\.timePrefix\}/);
  assert.match(timeTableSource, /\{daySlot\.start\} - \{displayEnd\}/);
  assert.doesNotMatch(timeTableSource, /\{row\.timePrefix\}\{daySlot\.start\}/);
  assert.match(styles, /\.slot-time\s*\{[^}]*display:\s*grid;/s);
  assert.match(styles, /\.slot-time\s*\{[^}]*grid-template-columns:\s*2\.75em max-content;/s);
  assert.doesNotMatch(styles, /\.slot-day-prefix\s*\{[^}]*position:\s*absolute;/s);
  assert.doesNotMatch(styles, /\.slot-day-prefix\s*\{[^}]*right:/s);
});
