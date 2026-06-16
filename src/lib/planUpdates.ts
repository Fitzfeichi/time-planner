import type { DayPlan, PlansByDate } from '../types.ts';
import { getMergedRangeForSlot, getMergedRangeSlotIds } from './mergedRanges.ts';
import { createEmptyDayPlan } from './timeSlots.ts';

export type TaskTimingAdjustmentDirection = 'advance' | 'defer';

function getTaskBlockSlotIds(dayPlan: DayPlan, slotId: string) {
  const slot = dayPlan.slots.find((item) => item.id === slotId);

  if (slot === undefined) {
    return [];
  }

  const mergedRange = getMergedRangeForSlot(dayPlan.slots, dayPlan.mergedRanges, slotId);

  return mergedRange === null ? [slotId] : getMergedRangeSlotIds(dayPlan.slots, mergedRange);
}

function getNextTaskBlockSlotIds(dayPlan: DayPlan, currentBlockSlotIds: string[]) {
  const currentBlockEndSlotId = currentBlockSlotIds[currentBlockSlotIds.length - 1];
  const currentBlockEndIndex = dayPlan.slots.findIndex((slot) => slot.id === currentBlockEndSlotId);
  const nextSlot = dayPlan.slots[currentBlockEndIndex + 1];

  return nextSlot === undefined ? [] : getTaskBlockSlotIds(dayPlan, nextSlot.id);
}

function getFirstPlanText(dayPlan: DayPlan, slotIds: string[]) {
  const slotIdSet = new Set(slotIds);
  const sourceSlot = dayPlan.slots.find((slot) => slotIdSet.has(slot.id) && slot.plan.trim());

  return sourceSlot?.plan.trim() ?? '';
}

function appendTaggedPlan(targetPlan: string, label: string, sourcePlan: string) {
  const taggedPlan = `【${label}】${sourcePlan}`;

  return targetPlan.trim() ? `${targetPlan}\n${taggedPlan}` : taggedPlan;
}

export function updateSlotPlanForDate(
  plansByDate: PlansByDate,
  dateKey: string,
  slotId: string,
  plan: string,
) {
  const dayPlan = plansByDate[dateKey] ?? createEmptyDayPlan();
  const mergedRange = getMergedRangeForSlot(dayPlan.slots, dayPlan.mergedRanges, slotId);
  const slotIdsToUpdate = new Set(
    mergedRange === null ? [slotId] : getMergedRangeSlotIds(dayPlan.slots, mergedRange),
  );

  return {
    ...plansByDate,
    [dateKey]: {
      ...dayPlan,
      slots: dayPlan.slots.map((slot) =>
        slotIdsToUpdate.has(slot.id)
          ? {
              ...slot,
              plan,
              status: slot.status === 'empty' && plan.trim() ? 'planned' : slot.status,
            }
          : slot,
      ),
    },
  };
}

export function applyTaskTimingAdjustment(
  plansByDate: PlansByDate,
  dateKey: string,
  currentSlotId: string,
  direction: TaskTimingAdjustmentDirection,
) {
  const dayPlan = plansByDate[dateKey] ?? createEmptyDayPlan();
  const currentBlockSlotIds = getTaskBlockSlotIds(dayPlan, currentSlotId);
  const nextBlockSlotIds = getNextTaskBlockSlotIds(dayPlan, currentBlockSlotIds);

  if (currentBlockSlotIds.length === 0 || nextBlockSlotIds.length === 0) {
    return plansByDate;
  }

  const sourceSlotIds = direction === 'advance' ? nextBlockSlotIds : currentBlockSlotIds;
  const targetSlotIds = direction === 'advance' ? currentBlockSlotIds : nextBlockSlotIds;
  const sourcePlan = getFirstPlanText(dayPlan, sourceSlotIds);

  if (!sourcePlan) {
    return plansByDate;
  }

  const targetPlan = getFirstPlanText(dayPlan, targetSlotIds);
  const nextTargetPlan = appendTaggedPlan(
    targetPlan,
    direction === 'advance' ? '提前' : '顺延',
    sourcePlan,
  );
  const sourceSlotIdSet = new Set(sourceSlotIds);
  const targetSlotIdSet = new Set(targetSlotIds);

  return {
    ...plansByDate,
    [dateKey]: {
      ...dayPlan,
      slots: dayPlan.slots.map((slot) => {
        if (targetSlotIdSet.has(slot.id)) {
          return {
            ...slot,
            plan: nextTargetPlan,
            status: slot.status === 'empty' ? 'planned' : slot.status,
          };
        }

        if (direction === 'advance' && sourceSlotIdSet.has(slot.id)) {
          return {
            ...slot,
            plan: '',
          };
        }

        return slot;
      }),
    },
  };
}
