const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sourceRoot = __dirname;
const confirmDialogPath = path.join(sourceRoot, 'components', 'ConfirmDialog.tsx');
const appSource = readFileSync(path.join(sourceRoot, 'App.tsx'), 'utf8');
const updatePanelSource = readFileSync(
  path.join(sourceRoot, 'components', 'AppUpdatePanel.tsx'),
  'utf8',
);
const confirmDialogSource = existsSync(confirmDialogPath)
  ? readFileSync(confirmDialogPath, 'utf8')
  : '';
const styles = readFileSync(path.join(sourceRoot, 'styles.css'), 'utf8');

test('all confirmation prompts use the shared in-app dialog', () => {
  assert.ok(existsSync(confirmDialogPath), 'Missing shared ConfirmDialog component');
  assert.doesNotMatch(appSource, /window\.confirm/);
  assert.doesNotMatch(updatePanelSource, /window\.alert/);
  assert.doesNotMatch(updatePanelSource, /window\.confirm/);
  assert.match(appSource, /<ConfirmDialog/);
  assert.match(updatePanelSource, /onConfirmRequest/);
  assert.match(confirmDialogSource, /interface ConfirmDialogProps/);
});

test('merge conflict confirmation shows affected time range details', () => {
  assert.match(appSource, /getMergeConfirmationDetails/);
  assert.match(appSource, /details:\s*getMergeConfirmationDetails/);
  assert.match(appSource, /confirmLabel:\s*'继续合并'/);
});

test('confirmation dialog has centered overlay styles', () => {
  assert.match(styles, /\.confirm-overlay\s*\{/);
  assert.match(styles, /place-items:\s*center;/);
  assert.match(styles, /\.confirm-dialog\s*\{/);
  assert.match(styles, /\.confirm-dialog-actions\s*\{/);
});

test('manual no-update feedback uses the shared dialog with a single action', () => {
  assert.match(confirmDialogSource, /cancelLabel\?: string \| null;/);
  assert.match(confirmDialogSource, /\{request\.cancelLabel !== null \? \(/);
  assert.match(updatePanelSource, /message:\s*'暂无更新，敬请期待~'/);
  assert.match(updatePanelSource, /cancelLabel:\s*null/);
});

test('startup update check only marks pending updates instead of opening confirmation', () => {
  assert.match(updatePanelSource, /setPendingUpdate\(update\)/);
  assert.match(updatePanelSource, /if \(source === 'startup'\)/);
  assert.match(updatePanelSource, /return;/);
});
