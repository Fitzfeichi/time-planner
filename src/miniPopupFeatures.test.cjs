const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appSource = readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');
const currentTaskCardSource = readFileSync(
  path.join(__dirname, 'components', 'CurrentTaskCard.tsx'),
  'utf8',
);
const stickyNoteIcon = readFileSync(
  path.join(__dirname, '..', 'public', 'minimal_sticky_note_icon.svg'),
  'utf8',
);

test('browser mini popup uses the compact mini window size', () => {
  assert.match(appSource, /MINI_WINDOW_WIDTH = 260/);
  assert.match(appSource, /popup=yes,width=\$\{MINI_WINDOW_WIDTH\},height=230/);
});

test('mini view exposes a sticky note button and separate note route', () => {
  assert.match(appSource, /STICKY_NOTE_STORAGE_KEY = 'time-manager-sticky-note-content'/);
  assert.match(appSource, /view === 'sticky-note'/);
  assert.match(appSource, /mini-sticky-note-button/);
  assert.match(appSource, /toggleStickyNoteWindow/);
});

test('mini view exposes neighbor task toggle before the sticky note button', () => {
  const neighborButtonIndex = appSource.indexOf('mini-neighbor-title-button');
  const stickyNoteButtonIndex = appSource.indexOf('mini-sticky-note-button');

  assert.notEqual(neighborButtonIndex, -1);
  assert.notEqual(stickyNoteButtonIndex, -1);
  assert.ok(neighborButtonIndex < stickyNoteButtonIndex);
  assert.match(appSource, /aria-label=\{showMiniNeighborTasks \? '隐藏前后任务' : '显示前后任务'\}/);
  assert.match(appSource, /aria-pressed=\{showMiniNeighborTasks\}/);
  assert.match(appSource, /onClick=\{toggleMiniNeighborTasks\}/);
});

test('mini current task time and timing buttons share one header-side row', () => {
  const sidePanelIndex = currentTaskCardSource.indexOf('className="mini-task-side"');
  const timingRowIndex = currentTaskCardSource.indexOf('className="mini-task-timing-row"');
  const compactBodyIndex = currentTaskCardSource.indexOf(
    'className="current-task-body mini-task-body"',
  );
  const miniPlanInputIndex = currentTaskCardSource.indexOf(
    'className="mini-task-plan-input"',
    compactBodyIndex,
  );
  const timingRowSource = currentTaskCardSource.slice(timingRowIndex, compactBodyIndex);
  const compactBodyBeforeInput = currentTaskCardSource.slice(compactBodyIndex, miniPlanInputIndex);

  assert.notEqual(sidePanelIndex, -1);
  assert.notEqual(timingRowIndex, -1);
  assert.notEqual(compactBodyIndex, -1);
  assert.notEqual(miniPlanInputIndex, -1);
  assert.ok(sidePanelIndex < timingRowIndex);
  assert.ok(timingRowIndex < compactBodyIndex);
  assert.match(
    currentTaskCardSource,
    /className="mini-task-side"[\s\S]*status-pill status-inline[\s\S]*<\/div>\s*<\/div>\s*<div className="mini-task-timing-row"/,
  );
  assert.match(timingRowSource, /current-task-time/);
  assert.match(timingRowSource, /\{slot\.start\} - \{slot\.end\}/);
  assert.match(timingRowSource, /renderTimingButtons\(\)/);
  assert.doesNotMatch(compactBodyBeforeInput, /current-task-time/);
  assert.doesNotMatch(compactBodyBeforeInput, /\{timingActions\}/);
});

test('main current task time shares one row with timing buttons and has no neighbor toggle', () => {
  const mainBranchIndex = currentTaskCardSource.indexOf('<section className="current-task-card">');
  const mainTimingRowIndex = currentTaskCardSource.indexOf(
    'className="current-task-timing-row"',
    mainBranchIndex,
  );
  const mainActionsIndex = currentTaskCardSource.indexOf(
    'className="current-task-actions"',
    mainBranchIndex,
  );
  const mainBodyIndex = currentTaskCardSource.indexOf('className="current-task-body"', mainBranchIndex);
  const mainBodySource = currentTaskCardSource.slice(mainBodyIndex, mainActionsIndex);

  assert.notEqual(mainBranchIndex, -1);
  assert.notEqual(mainTimingRowIndex, -1);
  assert.notEqual(mainActionsIndex, -1);
  assert.ok(mainBodyIndex < mainTimingRowIndex);
  assert.ok(mainTimingRowIndex < mainActionsIndex);
  assert.match(mainBodySource, /current-task-time/);
  assert.match(mainBodySource, /\{timingActions\}/);
  assert.doesNotMatch(mainBodySource, /mini-neighbor-toggle/);
});

test('sticky note button icon uses a slightly heavier outline', () => {
  assert.match(stickyNoteIcon, /stroke-width="50"/);
  assert.match(stickyNoteIcon, /stroke-linecap="round"/);
  assert.match(stickyNoteIcon, /stroke-linejoin="round"/);
});
