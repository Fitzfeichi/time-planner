import assert from 'node:assert/strict';
import test from 'node:test';
import { moveSelectedSlotPlans } from './slotMoves.js';
import { createTimeSlots } from './timeSlots.js';
import type { MergedTimeRange, SlotStatus, TimeSlot } from '../types.js';

function createSlotsWithPayloads() {
  return createTimeSlots().map((slot, index): TimeSlot => ({
    ...slot,
    plan: `计划 ${index}`,
    actual: `实际 ${index}`,
    status: (index % 2 === 0 ? 'planned' : 'done') as SlotStatus,
  }));
}

test('moves plan and status for a single slot while keeping actual content in place', () => {
  const slots = createSlotsWithPayloads();
  const result = moveSelectedSlotPlans(slots, ['slot-1'], 4);

  assert.equal(result.didMove, true);
  assert.deepEqual(result.movedSlotIds, ['slot-4']);
  assert.equal(result.slots[4].plan, '计划 1');
  assert.equal(result.slots[4].status, 'done');
  assert.equal(result.slots[4].actual, '实际 4');
});

test('moves plan and status for multiple selected slots', () => {
  const slots = createSlotsWithPayloads();
  const result = moveSelectedSlotPlans(slots, ['slot-1', 'slot-2'], 5);

  assert.equal(result.didMove, true);
  assert.deepEqual(result.movedSlotIds, ['slot-5', 'slot-6']);
  assert.deepEqual(
    result.slots.slice(5, 7).map((slot) => [slot.plan, slot.status, slot.actual]),
    [
      ['计划 1', 'done', '实际 5'],
      ['计划 2', 'planned', '实际 6'],
    ],
  );
});

test('moves a merged range as one block and carries its merged range metadata', () => {
  const slots = createSlotsWithPayloads();
  const mergedRanges: MergedTimeRange[] = [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-20' },
  ];

  const result = moveSelectedSlotPlans(slots, ['slot-18'], 28, mergedRanges);

  assert.equal(result.didMove, true);
  assert.deepEqual(result.movedSlotIds, ['slot-28', 'slot-29', 'slot-30']);
  assert.deepEqual(result.mergedRanges, [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-28', endSlotId: 'slot-30' },
  ]);
  assert.deepEqual(
    result.slots.slice(28, 31).map((slot) => [slot.plan, slot.status, slot.actual]),
    [
      ['计划 18', 'planned', '实际 28'],
      ['计划 19', 'done', '实际 29'],
      ['计划 20', 'planned', '实际 30'],
    ],
  );
});

test('does not insert a merged block inside itself', () => {
  const slots = createSlotsWithPayloads();
  const mergedRanges: MergedTimeRange[] = [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-20' },
  ];

  const result = moveSelectedSlotPlans(slots, ['slot-18'], 19, mergedRanges);

  assert.equal(result.didMove, false);
  assert.deepEqual(result.movedSlotIds, ['slot-18', 'slot-19', 'slot-20']);
  assert.deepEqual(result.mergedRanges, mergedRanges);
  assert.equal(result.slots, slots);
});

test('keeps another merged range intact when a merged block lands on its original boundary', () => {
  const slots = createSlotsWithPayloads();
  const mergedRanges: MergedTimeRange[] = [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-20' },
    { id: 'merge-slot-24-slot-25', startSlotId: 'slot-24', endSlotId: 'slot-25' },
  ];

  const result = moveSelectedSlotPlans(slots, ['slot-18'], 24, mergedRanges);

  assert.equal(result.didMove, true);
  assert.deepEqual(result.mergedRanges, [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-24', endSlotId: 'slot-26' },
    { id: 'merge-slot-24-slot-25', startSlotId: 'slot-21', endSlotId: 'slot-22' },
  ]);
  assert.deepEqual(
    result.slots.slice(21, 27).map((slot) => slot.plan),
    ['计划 24', '计划 25', '计划 26', '计划 18', '计划 19', '计划 20'],
  );
});
