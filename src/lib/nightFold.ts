import type { NightFoldRange, TimeSlot } from '../types';

const NIGHT_FOLD_START_INDEX = 1;
const NIGHT_FOLD_END_INDEX = 15;

export const DEFAULT_NIGHT_FOLD_RANGE: NightFoldRange = {
  startSlotId: `slot-${NIGHT_FOLD_START_INDEX}`,
  endSlotId: `slot-${NIGHT_FOLD_END_INDEX}`,
};

function getSlotIndex(slotId: string) {
  if (!slotId.startsWith('slot-')) {
    return null;
  }

  const slotIndex = Number(slotId.slice(5));

  return Number.isInteger(slotIndex) ? slotIndex : null;
}

function getNightFoldRangeIndexes(range: NightFoldRange) {
  const startIndex = getSlotIndex(range.startSlotId);
  const endIndex = getSlotIndex(range.endSlotId);

  if (startIndex === null || endIndex === null || startIndex > endIndex) {
    return null;
  }

  return { startIndex, endIndex };
}

export function isNightFoldSlot(slotId: string) {
  return isSlotInNightFoldRange(slotId, DEFAULT_NIGHT_FOLD_RANGE);
}

export function isSlotInNightFoldRange(slotId: string, range: NightFoldRange) {
  const slotIndex = getSlotIndex(slotId);
  const rangeIndexes = getNightFoldRangeIndexes(range);

  return (
    slotIndex !== null &&
    rangeIndexes !== null &&
    slotIndex >= rangeIndexes.startIndex &&
    slotIndex <= rangeIndexes.endIndex
  );
}

export function expandNightFoldRangeForAdjacentSlot(range: NightFoldRange, slotId: string) {
  const slotIndex = getSlotIndex(slotId);
  const rangeIndexes = getNightFoldRangeIndexes(range);

  if (slotIndex === null || rangeIndexes === null) {
    return null;
  }

  if (slotIndex === rangeIndexes.startIndex - 1) {
    return {
      ...range,
      startSlotId: slotId,
    };
  }

  if (slotIndex === rangeIndexes.endIndex + 1) {
    return {
      ...range,
      endSlotId: slotId,
    };
  }

  return null;
}

export function isDefaultNightFoldRange(range: NightFoldRange) {
  return (
    range.startSlotId === DEFAULT_NIGHT_FOLD_RANGE.startSlotId &&
    range.endSlotId === DEFAULT_NIGHT_FOLD_RANGE.endSlotId
  );
}

export function shouldExpandNightFoldForSlots(slots: TimeSlot[]) {
  return slots.some(
    (slot) =>
      isNightFoldSlot(slot.id) && (slot.plan.trim().length > 0 || slot.actual.trim().length > 0),
  );
}
