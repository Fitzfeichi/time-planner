import assert from 'node:assert/strict';
import test from 'node:test';
import { getTaskProgressPercent } from './taskProgress.ts';

function dateAt(time: string) {
  return new Date(`2026-06-04T${time}:00`);
}

test('returns halfway progress for a half-hour task block', () => {
  const progress = getTaskProgressPercent(
    { start: '11:00', end: '11:30' },
    dateAt('11:15'),
  );

  assert.equal(progress, 50);
});

test('returns halfway progress for a one-hour merged task block', () => {
  const progress = getTaskProgressPercent(
    { start: '11:00', end: '12:00' },
    dateAt('11:30'),
  );

  assert.equal(progress, 50);
});

test('clamps progress before and after the task block', () => {
  assert.equal(
    getTaskProgressPercent({ start: '11:00', end: '11:30' }, dateAt('10:59')),
    0,
  );
  assert.equal(
    getTaskProgressPercent({ start: '11:00', end: '11:30' }, dateAt('11:31')),
    100,
  );
});

test('handles a task block ending at 24:00', () => {
  const progress = getTaskProgressPercent(
    { start: '23:30', end: '24:00' },
    dateAt('23:45'),
  );

  assert.equal(progress, 50);
});
