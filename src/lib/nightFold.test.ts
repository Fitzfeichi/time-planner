import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_NIGHT_FOLD_RANGE,
  expandNightFoldRangeForAdjacentSlot,
  isDefaultNightFoldRange,
  isNightFoldSlot,
  isSlotInNightFoldRange,
  shouldExpandNightFoldForSlots,
} from './nightFold.ts';
import type { TimeSlot } from '../types.ts';

function createSlot(id: string, plan = '', actual = ''): TimeSlot {
  return {
    id,
    start: '',
    end: '',
    plan,
    actual,
    status: 'empty',
  };
}

test('folds 00:30 to 08:00 but keeps 00:00 visible', () => {
  assert.equal(isNightFoldSlot('slot-0'), false);
  assert.equal(isNightFoldSlot('slot-1'), true);
  assert.equal(isNightFoldSlot('slot-15'), true);
  assert.equal(isNightFoldSlot('slot-16'), false);
});

test('checks slots against a custom night fold range', () => {
  const range = { startSlotId: 'slot-0', endSlotId: 'slot-16' };

  assert.equal(isSlotInNightFoldRange('slot-0', range), true);
  assert.equal(isSlotInNightFoldRange('slot-16', range), true);
  assert.equal(isSlotInNightFoldRange('slot-17', range), false);
});

test('expands night fold range only for adjacent boundary slots', () => {
  assert.deepEqual(
    expandNightFoldRangeForAdjacentSlot(DEFAULT_NIGHT_FOLD_RANGE, 'slot-0'),
    { startSlotId: 'slot-0', endSlotId: 'slot-15' },
  );
  assert.deepEqual(
    expandNightFoldRangeForAdjacentSlot(DEFAULT_NIGHT_FOLD_RANGE, 'slot-16'),
    { startSlotId: 'slot-1', endSlotId: 'slot-16' },
  );
  assert.equal(expandNightFoldRangeForAdjacentSlot(DEFAULT_NIGHT_FOLD_RANGE, 'slot-3'), null);
  assert.equal(expandNightFoldRangeForAdjacentSlot(DEFAULT_NIGHT_FOLD_RANGE, 'slot-18'), null);
  assert.equal(expandNightFoldRangeForAdjacentSlot(DEFAULT_NIGHT_FOLD_RANGE, 'bad-slot'), null);
});

test('detects whether a range is the default night fold range', () => {
  assert.equal(isDefaultNightFoldRange(DEFAULT_NIGHT_FOLD_RANGE), true);
  assert.equal(
    isDefaultNightFoldRange({ startSlotId: 'slot-0', endSlotId: 'slot-15' }),
    false,
  );
});

test('expands night fold when folded slots have plan or actual content', () => {
  assert.equal(shouldExpandNightFoldForSlots([createSlot('slot-1', '熬夜写报告')]), true);
  assert.equal(shouldExpandNightFoldForSlots([createSlot('slot-3', '', '实际加班')]), true);
});

test('does not expand night fold for status-only or daytime content', () => {
  assert.equal(
    shouldExpandNightFoldForSlots([
      { ...createSlot('slot-1'), status: 'planned' },
      createSlot('slot-16', '早上工作'),
    ]),
    false,
  );
});

test('auto expands only for the default night fold range content', () => {
  assert.equal(
    shouldExpandNightFoldForSlots([
      createSlot('slot-0', '提前休息'),
      createSlot('slot-16', '晚起'),
    ]),
    false,
  );
});
