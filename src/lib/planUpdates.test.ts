import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTaskTimingAdjustment, updateSlotPlanForDate } from './planUpdates.ts';
import type { PlansByDate, SlotStatus, TimeSlot } from '../types.ts';

function createSlot(index: number, plan = '', status: SlotStatus = 'planned'): TimeSlot {
  const startHour = Math.floor(index / 2).toString().padStart(2, '0');
  const startMinute = index % 2 === 0 ? '00' : '30';
  const endIndex = index + 1;
  const endHour = Math.floor(endIndex / 2).toString().padStart(2, '0');
  const endMinute = endIndex % 2 === 0 ? '00' : '30';

  return {
    id: `slot-${index}`,
    start: `${startHour}:${startMinute}`,
    end: `${endHour}:${endMinute}`,
    plan,
    actual: '',
    status,
  };
}

test('updates only the matching slot plan for the target date', () => {
  const plansByDate: PlansByDate = {
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

  const nextPlansByDate = updateSlotPlanForDate(
    plansByDate,
    '2026-05-24',
    'slot-0',
    '小窗新计划',
  );

  assert.equal(nextPlansByDate['2026-05-24'].slots[0].plan, '小窗新计划');
  assert.equal(nextPlansByDate['2026-05-24'].slots[1].plan, '保留');
  assert.equal(nextPlansByDate['2026-05-25'].slots[0].plan, '明天计划');
});

test('marks an empty slot as planned when a plan is added', () => {
  const plansByDate: PlansByDate = {
    '2026-05-24': {
      review: '',
      slots: [
        { id: 'slot-0', start: '00:00', end: '00:30', plan: '', actual: '', status: 'empty' },
      ],
    },
  };

  const nextPlansByDate = updateSlotPlanForDate(
    plansByDate,
    '2026-05-24',
    'slot-0',
    '小窗新计划',
  );

  assert.equal(nextPlansByDate['2026-05-24'].slots[0].status, 'planned');
});

test('keeps a manual status when a plan is changed', () => {
  const plansByDate: PlansByDate = {
    '2026-05-24': {
      review: '',
      slots: [
        { id: 'slot-0', start: '00:00', end: '00:30', plan: '旧计划', actual: '', status: 'done' },
      ],
    },
  };

  const nextPlansByDate = updateSlotPlanForDate(
    plansByDate,
    '2026-05-24',
    'slot-0',
    '小窗新计划',
  );

  assert.equal(nextPlansByDate['2026-05-24'].slots[0].status, 'done');
});

test('keeps planned status when a plan is cleared', () => {
  const plansByDate: PlansByDate = {
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
  const plansByDate: PlansByDate = {
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

  const nextPlansByDate = updateSlotPlanForDate(
    plansByDate,
    '2026-05-24',
    'slot-1',
    '合并任务新计划',
  );

  assert.equal(nextPlansByDate['2026-05-24'].slots[0].plan, '合并任务新计划');
  assert.equal(nextPlansByDate['2026-05-24'].slots[1].plan, '合并任务新计划');
  assert.equal(nextPlansByDate['2026-05-24'].slots[2].plan, '保留');
});

test('advances the next task plan into the current task and clears the next task', () => {
  const plansByDate: PlansByDate = {
    '2026-05-24': {
      review: '',
      slots: [createSlot(20, '当前任务'), createSlot(21, '下一任务')],
    },
  };

  const nextPlansByDate = applyTaskTimingAdjustment(
    plansByDate,
    '2026-05-24',
    'slot-20',
    'advance',
  );

  assert.equal(nextPlansByDate['2026-05-24'].slots[0].plan, '当前任务\n【提前】下一任务');
  assert.equal(nextPlansByDate['2026-05-24'].slots[1].plan, '');
});

test('defers the current task plan into the next task without clearing the current task', () => {
  const plansByDate: PlansByDate = {
    '2026-05-24': {
      review: '',
      slots: [createSlot(20, '当前任务'), createSlot(21, '下一任务')],
    },
  };

  const nextPlansByDate = applyTaskTimingAdjustment(
    plansByDate,
    '2026-05-24',
    'slot-20',
    'defer',
  );

  assert.equal(nextPlansByDate['2026-05-24'].slots[0].plan, '当前任务');
  assert.equal(nextPlansByDate['2026-05-24'].slots[1].plan, '下一任务\n【顺延】当前任务');
});

test('marks an empty target task as planned when timing adjustment adds a plan', () => {
  const plansByDate: PlansByDate = {
    '2026-05-24': {
      review: '',
      slots: [createSlot(20, '', 'empty'), createSlot(21, '下一任务')],
    },
  };

  const nextPlansByDate = applyTaskTimingAdjustment(
    plansByDate,
    '2026-05-24',
    'slot-20',
    'advance',
  );

  assert.equal(nextPlansByDate['2026-05-24'].slots[0].plan, '【提前】下一任务');
  assert.equal(nextPlansByDate['2026-05-24'].slots[0].status, 'planned');
  assert.equal(nextPlansByDate['2026-05-24'].slots[1].status, 'planned');
});

test('applies timing adjustments to whole merged task blocks', () => {
  const plansByDate: PlansByDate = {
    '2026-05-24': {
      review: '',
      mergedRanges: [
        { id: 'merge-slot-20-slot-21', startSlotId: 'slot-20', endSlotId: 'slot-21' },
        { id: 'merge-slot-22-slot-23', startSlotId: 'slot-22', endSlotId: 'slot-23' },
      ],
      slots: [
        createSlot(20, '当前任务'),
        createSlot(21, '当前任务'),
        createSlot(22, '下一任务'),
        createSlot(23, '下一任务'),
      ],
    },
  };

  const nextPlansByDate = applyTaskTimingAdjustment(
    plansByDate,
    '2026-05-24',
    'slot-21',
    'advance',
  );

  assert.deepEqual(
    nextPlansByDate['2026-05-24'].slots.map((slot) => slot.plan),
    ['当前任务\n【提前】下一任务', '当前任务\n【提前】下一任务', '', ''],
  );
});

test('leaves plans unchanged when timing adjustment has no source plan', () => {
  const plansByDate: PlansByDate = {
    '2026-05-24': {
      review: '',
      slots: [createSlot(20, '当前任务'), createSlot(21, '')],
    },
  };

  const nextPlansByDate = applyTaskTimingAdjustment(
    plansByDate,
    '2026-05-24',
    'slot-20',
    'advance',
  );

  assert.deepEqual(nextPlansByDate, plansByDate);
});
