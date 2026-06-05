const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appSource = readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');
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

test('sticky note button icon uses a slightly heavier outline', () => {
  assert.match(stickyNoteIcon, /stroke-width="50"/);
  assert.match(stickyNoteIcon, /stroke-linecap="round"/);
  assert.match(stickyNoteIcon, /stroke-linejoin="round"/);
});
