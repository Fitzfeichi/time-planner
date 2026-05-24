import assert from 'node:assert/strict';
import test from 'node:test';
import { updateSlotPlanForDate } from './planUpdates.js';
import type { PlansByDate } from '../types.js';

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
