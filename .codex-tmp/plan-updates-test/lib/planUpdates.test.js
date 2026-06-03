import assert from 'node:assert/strict';
import test from 'node:test';
import { updateSlotPlanForDate } from './planUpdates.js';
test('updates only the matching slot plan for the target date', () => {
    const plansByDate = {
        '2026-05-24': {
            review: '',
            slots: [
                { id: 'slot-0', start: '00:00', end: '00:30', plan: '旧计划', actual: '', status: 'planned' },
                { id: 'slot-1', start: '00:30', end: '01:00', plan: '保留', actual: '', status: 'planned' },
            ],
        },
        '2026-05-25': {
            review: '',
            slots: [
                { id: 'slot-0', start: '00:00', end: '00:30', plan: '明天计划', actual: '', status: 'planned' },
            ],
        },
    };
    const nextPlansByDate = updateSlotPlanForDate(plansByDate, '2026-05-24', 'slot-0', '小窗新计划');
    assert.equal(nextPlansByDate['2026-05-24'].slots[0].plan, '小窗新计划');
    assert.equal(nextPlansByDate['2026-05-24'].slots[1].plan, '保留');
    assert.equal(nextPlansByDate['2026-05-25'].slots[0].plan, '明天计划');
});
test('marks an empty slot as planned when a plan is added', () => {
    const plansByDate = {
        '2026-05-24': {
            review: '',
            slots: [
                { id: 'slot-0', start: '00:00', end: '00:30', plan: '', actual: '', status: 'empty' },
            ],
        },
    };
    const nextPlansByDate = updateSlotPlanForDate(plansByDate, '2026-05-24', 'slot-0', '小窗新计划');
    assert.equal(nextPlansByDate['2026-05-24'].slots[0].status, 'planned');
});
test('keeps a manual status when a plan is changed', () => {
    const plansByDate = {
        '2026-05-24': {
            review: '',
            slots: [
                { id: 'slot-0', start: '00:00', end: '00:30', plan: '旧计划', actual: '', status: 'done' },
            ],
        },
    };
    const nextPlansByDate = updateSlotPlanForDate(plansByDate, '2026-05-24', 'slot-0', '小窗新计划');
    assert.equal(nextPlansByDate['2026-05-24'].slots[0].status, 'done');
});
test('keeps planned status when a plan is cleared', () => {
    const plansByDate = {
        '2026-05-24': {
            review: '',
            slots: [
                { id: 'slot-0', start: '00:00', end: '00:30', plan: '旧计划', actual: '', status: 'planned' },
            ],
        },
    };
    const nextPlansByDate = updateSlotPlanForDate(plansByDate, '2026-05-24', 'slot-0', '');
    assert.equal(nextPlansByDate['2026-05-24'].slots[0].status, 'planned');
});
test('updates every slot in the merged range when a merged slot plan changes', () => {
    const plansByDate = {
        '2026-05-24': {
            review: '',
            mergedRanges: [
                { id: 'merge-slot-0-slot-1', startSlotId: 'slot-0', endSlotId: 'slot-1' },
            ],
            slots: [
                { id: 'slot-0', start: '00:00', end: '00:30', plan: '旧计划', actual: '', status: 'planned' },
                { id: 'slot-1', start: '00:30', end: '01:00', plan: '旧计划', actual: '', status: 'planned' },
                { id: 'slot-2', start: '01:00', end: '01:30', plan: '保留', actual: '', status: 'planned' },
            ],
        },
    };
    const nextPlansByDate = updateSlotPlanForDate(plansByDate, '2026-05-24', 'slot-1', '合并任务新计划');
    assert.equal(nextPlansByDate['2026-05-24'].slots[0].plan, '合并任务新计划');
    assert.equal(nextPlansByDate['2026-05-24'].slots[1].plan, '合并任务新计划');
    assert.equal(nextPlansByDate['2026-05-24'].slots[2].plan, '保留');
});
