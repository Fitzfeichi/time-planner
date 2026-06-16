const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appSource = readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');
const dayHeaderSource = readFileSync(path.join(__dirname, 'components', 'DayHeader.tsx'), 'utf8');
const updatePanelSource = readFileSync(path.join(__dirname, 'components', 'AppUpdatePanel.tsx'), 'utf8');
const styles = readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

function cssBlock(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  assert.ok(match, `Missing CSS block for ${selector}`);

  return match[1];
}

test('app update action is passed into the day header instead of the side panel', () => {
  const sidePanelMatch = appSource.match(/<aside className="side-panel"[\s\S]*?<\/aside>/);

  assert.ok(sidePanelMatch, 'Missing side panel');
  assert.doesNotMatch(sidePanelMatch[0], /<AppUpdatePanel\s*\/>/);
  assert.match(
    appSource,
    /<DayHeader[\s\S]*?updateAction=\{<AppUpdatePanel onConfirmRequest=\{requestConfirmation\} \/>\}[\s\S]*?onPreviousDay=/,
  );
});

test('day header renders the update action before the previous-day button', () => {
  assert.match(dayHeaderSource, /updateAction\?: ReactNode;/);
  assert.match(
    dayHeaderSource,
    /<nav className="day-actions"[\s\S]*?\{updateAction\}[\s\S]*?<button type="button" onClick=\{onPreviousDay\}/,
  );
});

test('app update control is styled as a compact header button', () => {
  const updateButtonBlock = cssBlock('.update-check-button');

  assert.match(updatePanelSource, /return \(\s*<button/);
  assert.doesNotMatch(updatePanelSource, /panel-block app-update-panel/);
  assert.doesNotMatch(styles, /\.app-update-panel\s*\{/);
  assert.doesNotMatch(updateButtonBlock, /width:\s*100%;/);
  assert.match(updateButtonBlock, /white-space:\s*nowrap;/);
});

test('app update control uses short label and highlights pending updates', () => {
  assert.match(updatePanelSource, /\{isBusy \? '检查更新中' : '更新'\}/);
  assert.doesNotMatch(updatePanelSource, /'检查更新'/);
  assert.match(updatePanelSource, /hasPendingUpdate \? 'update-check-button primary-button' : 'update-check-button'/);
});
