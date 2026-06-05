const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const bridgeSource = readFileSync(path.join(__dirname, 'lib', 'desktopBridge.ts'), 'utf8');

test('sticky note opens close to the mini window', () => {
  assert.match(bridgeSource, /STICKY_NOTE_WINDOW_GAP = 0/);
});

test('sticky note placement uses the mini content area as the visual anchor', () => {
  assert.match(bridgeSource, /miniWindow\.innerPosition\(\)/);
  assert.match(bridgeSource, /miniWindow\.innerSize\(\)/);
  assert.doesNotMatch(bridgeSource, /miniWindow\.outerPosition\(\)/);
  assert.doesNotMatch(bridgeSource, /miniWindow\.outerSize\(\)/);
});

test('sticky note width matches the mini window and stays fixed', () => {
  assert.match(bridgeSource, /width: MINI_WINDOW_WIDTH/);
  assert.match(bridgeSource, /minWidth: MINI_WINDOW_WIDTH/);
  assert.match(bridgeSource, /maxWidth: MINI_WINDOW_WIDTH/);
  assert.doesNotMatch(bridgeSource, /STICKY_NOTE_WINDOW_MIN_WIDTH/);
  assert.doesNotMatch(bridgeSource, /STICKY_NOTE_WINDOW_DEFAULT_WIDTH/);
  assert.doesNotMatch(bridgeSource, /getStickyNoteLogicalWidth/);
});

test('sticky note height follows the mini window height', () => {
  assert.doesNotMatch(bridgeSource, /STICKY_NOTE_WINDOW_HEIGHT/);
  assert.match(bridgeSource, /STICKY_NOTE_VISIBLE_HEIGHT_ADJUSTMENT = 2/);
  assert.match(bridgeSource, /height:\s*miniLogicalSize\.height - STICKY_NOTE_VISIBLE_HEIGHT_ADJUSTMENT/);
  assert.match(bridgeSource, /height: stickyNotePlacement\.height/);
  assert.match(bridgeSource, /setSize\(new LogicalSize\(stickyNotePlacement\.width, stickyNotePlacement\.height\)\)/);
});

test('sticky note stays attached when the mini window moves or resizes', () => {
  assert.match(bridgeSource, /syncStickyNoteWindowWithMini/);
  assert.match(bridgeSource, /miniWindow\.onMoved\(syncStickyNoteWindow\)/);
  assert.match(bridgeSource, /miniWindow\.onResized\(syncStickyNoteWindow\)/);
  assert.doesNotMatch(bridgeSource, /stickyNoteWindow\.onResized\(syncStickyNoteWindow\)/);
  assert.match(bridgeSource, /cleanupStickyNoteWindowSync/);
});

test('sticky note always-on-top follows mini pin changes after opening', () => {
  assert.match(bridgeSource, /existingStickyNoteWindow\?\.setAlwaysOnTop\(shouldAlwaysOnTop\)/);
});
