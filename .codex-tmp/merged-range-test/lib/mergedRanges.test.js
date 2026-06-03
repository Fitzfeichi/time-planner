import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMergedRange, canCreateMergedRange, getMergedRangeSlotIds, removeMergedRangeForSlot, } from './mergedRanges.js';
import { createTimeSlots } from './timeSlots.js';
function createFilledSlots() {
    return createTimeSlots().map((slot) => {
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
    const ranges = [
        { id: 'merge-slot-24-slot-25', startSlotId: 'slot-24', endSlotId: 'slot-25' },
    ];
    assert.equal(canCreateMergedRange(slots, [], ['slot-18', 'slot-19', 'slot-20']), true);
    assert.equal(canCreateMergedRange(slots, [], ['slot-18']), false);
    assert.equal(canCreateMergedRange(slots, [], ['slot-18', 'slot-20']), false);
    assert.equal(canCreateMergedRange(slots, ranges, ['slot-24', 'slot-25', 'slot-26']), false);
});
test('creates a merged range and syncs all selected slots from the focused slot', () => {
    const slots = createFilledSlots();
    const result = applyMergedRange(slots, [], ['slot-18', 'slot-19', 'slot-20'], 'slot-18');
    assert.equal(result.didMerge, true);
    assert.deepEqual(result.mergedRanges, [
        { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-20' },
    ]);
    assert.deepEqual(getMergedRangeSlotIds(result.slots, result.mergedRanges[0]), [
        'slot-18',
        'slot-19',
        'slot-20',
    ]);
    const mergedSlots = result.slots.slice(18, 21);
    assert.deepEqual(mergedSlots.map((slot) => [slot.plan, slot.actual, slot.status]), [
        ['写报告', '写了大纲', 'planned'],
        ['写报告', '写了大纲', 'planned'],
        ['写报告', '写了大纲', 'planned'],
    ]);
});
test('removes only the merged range metadata when splitting a merged task', () => {
    const slots = createFilledSlots();
    const ranges = [
        { id: 'merge-slot-18-slot-20', startSlotId: 'slot-18', endSlotId: 'slot-20' },
    ];
    const nextRanges = removeMergedRangeForSlot(ranges, 'slot-19');
    assert.deepEqual(nextRanges, []);
    assert.equal(slots[18].plan, '写报告');
    assert.equal(slots[19].plan, '旧内容');
});
