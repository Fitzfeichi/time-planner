const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appSource = readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');
const dayHeaderSource = readFileSync(
  path.join(__dirname, 'components', 'DayHeader.tsx'),
  'utf8',
);
const timeTableSource = readFileSync(
  path.join(__dirname, 'components', 'TimeTable.tsx'),
  'utf8',
);
const styles = readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

test('night fold expansion state can force a collapsed view', () => {
  assert.match(appSource, /type NightFoldExpansionMode = 'auto' \| 'expanded' \| 'collapsed';/);
  assert.match(appSource, /nightFoldExpansionMode === 'expanded'/);
  assert.match(appSource, /nightFoldExpansionMode !== 'collapsed'/);
  assert.match(appSource, /function collapseNightFold\(\)/);
  assert.match(appSource, /setNightFoldExpansionMode\('collapsed'\)/);
});

test('day header renders the single night fold toggle beside the date', () => {
  assert.match(dayHeaderSource, /nightFoldAction\?: ReactNode;/);
  assert.match(dayHeaderSource, /nightFoldAction,/);
  assert.match(dayHeaderSource, /<div className="day-title-row">[\s\S]*<h1>/);
  assert.match(dayHeaderSource, /\{nightFoldAction\}/);
  assert.match(appSource, /nightFoldAction=\{[\s\S]*night-fold-toggle-button/);
  assert.match(appSource, /isNightFoldExpanded \? '夜间时间收起' : '夜间时间展开'/);
  assert.match(appSource, /isNightFoldExpanded \? collapseNightFold : \(\) => setNightFoldExpansionMode\('expanded'\)/);
  assert.doesNotMatch(appSource, /isNightFoldExpanded \? '收起' : '展开'/);
  assert.match(styles, /\.day-title-row/);
  assert.match(styles, /\.day-title-row[\s\S]*align-items: center;/);
  assert.match(styles, /\.day-title-row[\s\S]*--day-title-font-size: 34px;/);
  assert.match(styles, /\.day-title-row[\s\S]*--day-title-line-height: 1\.1;/);
  assert.match(styles, /h1[\s\S]*margin: 0;/);
  assert.match(styles, /h1[\s\S]*font-size: var\(--day-title-font-size\);/);
  assert.match(styles, /h1[\s\S]*line-height: var\(--day-title-line-height\);/);
  assert.match(styles, /\.night-fold-toggle-button/);
  assert.match(
    styles,
    /\.night-fold-toggle-button[\s\S]*height: var\(--day-title-font-size\);/,
  );
  assert.match(
    styles,
    /\.night-fold-toggle-button[\s\S]*min-height: var\(--day-title-font-size\);/,
  );
  assert.match(styles, /\.night-fold-toggle-button[\s\S]*max-height: var\(--day-title-font-size\);/);
  assert.match(styles, /\.night-fold-toggle-button[\s\S]*align-self: center;/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*--day-title-font-size: 28px;/);
});

test('time table no longer owns the expand and collapse click target', () => {
  assert.doesNotMatch(timeTableSource, /onExpandNightFold: \(\) => void;/);
  assert.doesNotMatch(timeTableSource, /onCollapseNightFold: \(\) => void;/);
  assert.doesNotMatch(timeTableSource, /function handleCollapseNightFold/);
  assert.doesNotMatch(
    timeTableSource,
    /data-edit-field="actual"[\s\S]*onClick=\{handleCollapseNightFold\}/,
  );
  assert.doesNotMatch(timeTableSource, /onClick=\{onExpandNightFold\}/);
  assert.doesNotMatch(timeTableSource, />\s*收起\s*</);
});
