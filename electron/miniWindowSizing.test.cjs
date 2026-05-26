const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MINI_WINDOW_WIDTH,
  MINI_WINDOW_MIN_WIDTH,
} = require('./miniWindowSizing.cjs');

test('mini window opens at its minimum width', () => {
  assert.equal(MINI_WINDOW_WIDTH, MINI_WINDOW_MIN_WIDTH);
});
