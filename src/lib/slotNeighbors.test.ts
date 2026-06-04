import assert from 'node:assert/strict';
import test from 'node:test';
import { createTimeSlots } from './timeSlots.js';
import { getSlotNeighbors, getTaskBlockNeighbors } from './slotNeighbors.js';
import type { MergedTimeRange } from '../types.js';

test('finds previous current and next slots for a middle slot', () => {
  const slots = createTimeSlots();
  const neighbors = getSlotNeighbors(slots, 'slot-16');

  assert.equal(neighbors.previous?.id, 'slot-15');
  assert.equal(neighbors.current?.id, 'slot-16');
  assert.equal(neighbors.next?.id, 'slot-17');
});

test('leaves missing neighbors empty at the day boundaries', () => {
  const slots = createTimeSlots();

  assert.equal(getSlotNeighbors(slots, 'slot-0').previous, null);
  assert.equal(getSlotNeighbors(slots, 'slot-47').next, null);
});

test('shows a merged next task as one complete task block', () => {
  const slots = createTimeSlots();
  const mergedRanges: MergedTimeRange[] = [
    { id: 'merge-slot-22-slot-23', startSlotId: 'slot-22', endSlotId: 'slot-23' },
  ];
  const neighbors = getTaskBlockNeighbors(slots, 'slot-21', mergedRanges);

  assert.equal(neighbors.current?.start, '10:30');
  assert.equal(neighbors.current?.end, '11:00');
  assert.equal(neighbors.next?.start, '11:00');
  assert.equal(neighbors.next?.end, '12:00');
});

test('uses task blocks when the current slot is inside a merged range', () => {
  const slots = createTimeSlots();
  const mergedRanges: MergedTimeRange[] = [
    { id: 'merge-slot-22-slot-23', startSlotId: 'slot-22', endSlotId: 'slot-23' },
  ];
  const neighbors = getTaskBlockNeighbors(slots, 'slot-23', mergedRanges);

  assert.equal(neighbors.previous?.start, '10:30');
  assert.equal(neighbors.previous?.end, '11:00');
  assert.equal(neighbors.current?.start, '11:00');
  assert.equal(neighbors.current?.end, '12:00');
  assert.equal(neighbors.next?.start, '12:00');
  assert.equal(neighbors.next?.end, '12:30');
});

test('leaves missing task block neighbors empty at the day boundaries', () => {
  const slots = createTimeSlots();

  assert.equal(getTaskBlockNeighbors(slots, 'slot-0').previous, null);
  assert.equal(getTaskBlockNeighbors(slots, 'slot-47').next, null);
});
