import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMergedRange,
  canCreateMergedRange,
  getMergedRangeSlotIds,
  hasMergedRangeConflict,
  removeMergedRangeForSlot,
  splitOneSlotFromMergedRangeEnd,
} from './mergedRanges.ts';
import { createTimeSlots } from './timeSlots.ts';
import type { MergedTimeRange, TimeSlot } from '../types.ts';

function createFilledSlots() {
  return createTimeSlots().map((slot): TimeSlot => {
    if (slot.id === 'slot-18') {
      return {
        ...slot,
        plan: '写报告',
        actual: '写了大纲',
        status: 'planned',
      };
    }

    if (slot.id === 'slot-19') {
      return {
        ...slot,
        plan: '旧内容',
        actual: '旧实际',
        status: 'changed',
      };
    }

    return slot;
  });
}

test('allows only contiguous multi-slot selections without existing merged ranges', () => {
  const slots = createTimeSlots();
  const ranges: MergedTimeRange[] = [
    { id: 'merge-slot-24-slot-25', startSlotId: 'slot-24', endSlotId: 'slot-25' },
  ];

  assert.equal(canCreateMergedRange(slots, [], ['slot-18', 'slot-19', 'slot-20']), true);
  assert.equal(canCreateMergedRange(slots, [], ['slot-18']), false);
  assert.equal(canCreateMergedRange(slots, [], ['slot-18', 'slot-20']), false);
  assert.equal(canCreateMergedRange(slots, ranges, ['slot-18', 'slot-20']), false);
});

test('creates a merged range and syncs all selected slots from the focused slot', () => {
  const slots = createFilledSlots();
  const result = applyMergedRange(slots, [], ['slot-18', 'slot-19', 'slot-20'], 'slot-18');

  assert.equal(result.didMerge, true);
  assert.deepEqual(result.mergedRanges, [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-20' },
  ]);
  assert.deepEqual(result.mergedSlotIds, ['slot-18', 'slot-19', 'slot-20']);
  assert.deepEqual(getMergedRangeSlotIds(result.slots, result.mergedRanges[0]), [
    'slot-18',
    'slot-19',
    'slot-20',
  ]);

  const mergedSlots = result.slots.slice(18, 21);
  assert.deepEqual(
    mergedSlots.map((slot) => [slot.plan, slot.actual, slot.status]),
    [
      ['写报告', '写了大纲', 'planned'],
      ['写报告', '写了大纲', 'planned'],
      ['写报告', '写了大纲', 'planned'],
    ],
  );
});

test('extends an existing merged range forward into adjacent slots', () => {
  const slots = createFilledSlots();
  const ranges: MergedTimeRange[] = [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-20' },
  ];

  const result = applyMergedRange(slots, ranges, ['slot-18', 'slot-21'], 'slot-18');

  assert.equal(canCreateMergedRange(slots, ranges, ['slot-18', 'slot-21']), true);
  assert.equal(result.didMerge, true);
  assert.deepEqual(result.mergedRanges, [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-21' },
  ]);
  assert.deepEqual(result.mergedSlotIds, ['slot-18', 'slot-19', 'slot-20', 'slot-21']);
  assert.equal(result.slots[21].plan, '写报告');
  assert.equal(result.slots[21].actual, '写了大纲');
  assert.equal(result.slots[21].status, 'planned');
});

test('extends an existing merged range backward into an adjacent slot', () => {
  const slots = createFilledSlots();
  const ranges: MergedTimeRange[] = [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-20' },
  ];

  const result = applyMergedRange(slots, ranges, ['slot-17', 'slot-18'], 'slot-18');

  assert.equal(result.didMerge, true);
  assert.deepEqual(result.mergedRanges, [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-17', endSlotId: 'slot-20' },
  ]);
  assert.deepEqual(result.mergedSlotIds, ['slot-17', 'slot-18', 'slot-19', 'slot-20']);
  assert.equal(result.slots[17].plan, '写报告');
});

test('extends an existing merged range into multiple adjacent slots at once', () => {
  const slots = createFilledSlots();
  const ranges: MergedTimeRange[] = [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-20' },
  ];

  const result = applyMergedRange(
    slots,
    ranges,
    ['slot-18', 'slot-19', 'slot-20', 'slot-21', 'slot-22', 'slot-23'],
    'slot-18',
  );

  assert.equal(result.didMerge, true);
  assert.deepEqual(result.mergedRanges, [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-23' },
  ]);
  assert.deepEqual(result.mergedSlotIds, [
    'slot-18',
    'slot-19',
    'slot-20',
    'slot-21',
    'slot-22',
    'slot-23',
  ]);
});

test('rejects selections that touch two existing merged ranges', () => {
  const slots = createTimeSlots();
  const ranges: MergedTimeRange[] = [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-20' },
    { id: 'merge-slot-23-slot-24', startSlotId: 'slot-23', endSlotId: 'slot-24' },
  ];

  assert.equal(
    canCreateMergedRange(slots, ranges, [
      'slot-18',
      'slot-19',
      'slot-20',
      'slot-21',
      'slot-22',
      'slot-23',
      'slot-24',
    ]),
    false,
  );
});

test('does not treat blank added slots as merge conflicts', () => {
  const slots = createFilledSlots();
  const ranges: MergedTimeRange[] = [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-20' },
  ];

  assert.equal(
    hasMergedRangeConflict(slots, ranges, ['slot-18', 'slot-21'], 'slot-18'),
    false,
  );
});

test('treats filled added slots as merge conflicts', () => {
  const slots = createFilledSlots().map((slot): TimeSlot => {
    if (slot.id === 'slot-21') {
      return {
        ...slot,
        plan: '临时事项',
        actual: '',
        status: 'planned',
      };
    }

    return slot;
  });
  const ranges: MergedTimeRange[] = [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-20' },
  ];

  assert.equal(
    hasMergedRangeConflict(slots, ranges, ['slot-18', 'slot-21'], 'slot-18'),
    true,
  );
});

test('keeps the only non-empty planned slot when the focused slot is blank', () => {
  const slots = createTimeSlots().map((slot): TimeSlot => {
    if (slot.id === 'slot-18') {
      return {
        ...slot,
        plan: '写报告',
        actual: '写了大纲',
        status: 'planned',
      };
    }

    return slot;
  });

  const result = applyMergedRange(slots, [], ['slot-18', 'slot-19', 'slot-20'], 'slot-20');

  assert.equal(result.didMerge, true);
  assert.deepEqual(
    result.slots.slice(18, 21).map((slot) => [slot.plan, slot.actual, slot.status]),
    [
      ['写报告', '写了大纲', 'planned'],
      ['写报告', '写了大纲', 'planned'],
      ['写报告', '写了大纲', 'planned'],
    ],
  );
});

test('still uses the focused slot when multiple selected slots have plans', () => {
  const slots = createFilledSlots();
  const result = applyMergedRange(slots, [], ['slot-18', 'slot-19', 'slot-20'], 'slot-20');

  assert.equal(result.didMerge, true);
  assert.deepEqual(
    result.slots.slice(18, 21).map((slot) => [slot.plan, slot.actual, slot.status]),
    [
      ['', '', 'empty'],
      ['', '', 'empty'],
      ['', '', 'empty'],
    ],
  );
});

test('removes only the merged range metadata when splitting a merged task', () => {
  const slots = createFilledSlots();
  const ranges: MergedTimeRange[] = [
    { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-20' },
  ];

  const nextRanges = removeMergedRangeForSlot(ranges, 'slot-19');

  assert.deepEqual(nextRanges, []);
  assert.equal(slots[18].plan, '写报告');
  assert.equal(slots[19].plan, '旧内容');
});

test('splits one slot from the end of a merged range', () => {
  const slots = createFilledSlots();
  const ranges: MergedTimeRange[] = [
    { id: 'merge-slot-18-slot-21', startSlotId: 'slot-18', endSlotId: 'slot-21' },
  ];

  const result = splitOneSlotFromMergedRangeEnd(slots, ranges, 'slot-18');

  assert.equal(result.didSplit, true);
  assert.equal(result.detachedSlotId, 'slot-21');
  assert.deepEqual(result.remainingSlotIds, ['slot-18', 'slot-19', 'slot-20']);
  assert.deepEqual(result.mergedRanges, [
    { id: 'merge-slot-18-slot-21', startSlotId: 'slot-18', endSlotId: 'slot-20' },
  ]);
  assert.equal(slots[21].plan, '');
});

test('splitting one slot from a two-slot merged range removes the range metadata', () => {
  const slots = createFilledSlots();
  const ranges: MergedTimeRange[] = [
    { id: 'merge-slot-18-slot-19', startSlotId: 'slot-18', endSlotId: 'slot-19' },
  ];

  const result = splitOneSlotFromMergedRangeEnd(slots, ranges, 'slot-18');

  assert.equal(result.didSplit, true);
  assert.equal(result.detachedSlotId, 'slot-19');
  assert.deepEqual(result.remainingSlotIds, ['slot-18']);
  assert.deepEqual(result.mergedRanges, []);
  assert.equal(slots[18].plan, '写报告');
  assert.equal(slots[19].plan, '旧内容');
});
