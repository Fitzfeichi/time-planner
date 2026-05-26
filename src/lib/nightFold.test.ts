import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isNightFoldSlot,
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
