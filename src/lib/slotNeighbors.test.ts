import assert from 'node:assert/strict';
import test from 'node:test';
import { createTimeSlots } from './timeSlots.js';
import { getSlotNeighbors } from './slotNeighbors.js';

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
