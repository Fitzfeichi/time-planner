import assert from 'node:assert/strict';
import test from 'node:test';
import { readMiniNeighborPreference } from './miniNeighborPreference.ts';

test('defaults mini neighbor tasks to hidden for old saved state', () => {
  assert.equal(readMiniNeighborPreference({}), false);
});

test('reads saved mini neighbor task preference when present', () => {
  assert.equal(readMiniNeighborPreference({ showMiniNeighborTasks: true }), true);
  assert.equal(readMiniNeighborPreference({ showMiniNeighborTasks: false }), false);
});
