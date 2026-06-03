import type { MergedTimeRange, TimeSlot } from '../types.js';

interface ApplyMergedRangeResult {
  didMerge: boolean;
  slots: TimeSlot[];
  mergedRanges: MergedTimeRange[];
}

function createRangeId(startSlotId: string, endSlotId: string) {
  return `merge-${startSlotId}-${endSlotId}`;
}

function getSlotNumber(slotId: string) {
  const match = /^slot-(\d+)$/.exec(slotId);
  return match === null ? null : Number(match[1]);
}

function getSlotIndexById(slots: TimeSlot[]) {
  return new Map(slots.map((slot, index) => [slot.id, index]));
}

function getSortedUniqueSlotIndexes(slots: TimeSlot[], slotIds: string[]) {
  const slotIndexById = getSlotIndexById(slots);

  return Array.from(new Set(slotIds))
    .map((slotId) => slotIndexById.get(slotId))
    .filter((index): index is number => index !== undefined)
    .sort((first, second) => first - second);
}

function rangeOverlapsSlotIds(
  slots: TimeSlot[],
  range: MergedTimeRange,
  slotIds: string[],
) {
  const rangeSlotIds = new Set(getMergedRangeSlotIds(slots, range));
  return slotIds.some((slotId) => rangeSlotIds.has(slotId));
}

export function getMergedRangeSlotIds(slots: TimeSlot[], range: MergedTimeRange) {
  const slotIndexById = getSlotIndexById(slots);
  const startIndex = slotIndexById.get(range.startSlotId);
  const endIndex = slotIndexById.get(range.endSlotId);

  if (startIndex === undefined || endIndex === undefined || startIndex > endIndex) {
    return [];
  }

  return slots.slice(startIndex, endIndex + 1).map((slot) => slot.id);
}

export function getMergedRangeForSlot(
  slots: TimeSlot[],
  mergedRanges: MergedTimeRange[] = [],
  slotId: string,
) {
  return (
    mergedRanges.find((range) => getMergedRangeSlotIds(slots, range).includes(slotId)) ?? null
  );
}

export function canCreateMergedRange(
  slots: TimeSlot[],
  mergedRanges: MergedTimeRange[] = [],
  selectedSlotIds: string[],
) {
  const selectedIndexes = getSortedUniqueSlotIndexes(slots, selectedSlotIds);

  if (selectedIndexes.length < 2) {
    return false;
  }

  const isContiguous = selectedIndexes.every((index, offset) => {
    if (offset === 0) {
      return true;
    }

    return index === selectedIndexes[offset - 1] + 1;
  });

  if (!isContiguous) {
    return false;
  }

  const selectedIds = selectedIndexes.map((index) => slots[index].id);
  return !mergedRanges.some((range) => rangeOverlapsSlotIds(slots, range, selectedIds));
}

export function hasMergedRangeConflict(
  slots: TimeSlot[],
  selectedSlotIds: string[],
  sourceSlotId: string,
) {
  const sourceSlot = slots.find((slot) => slot.id === sourceSlotId);

  if (sourceSlot === undefined) {
    return false;
  }

  return selectedSlotIds.some((slotId) => {
    const slot = slots.find((item) => item.id === slotId);

    return (
      slot !== undefined &&
      (slot.plan !== sourceSlot.plan ||
        slot.actual !== sourceSlot.actual ||
        slot.status !== sourceSlot.status)
    );
  });
}

export function applyMergedRange(
  slots: TimeSlot[],
  mergedRanges: MergedTimeRange[] = [],
  selectedSlotIds: string[],
  sourceSlotId: string,
): ApplyMergedRangeResult {
  if (!canCreateMergedRange(slots, mergedRanges, selectedSlotIds)) {
    return {
      didMerge: false,
      slots,
      mergedRanges,
    };
  }

  const selectedIndexes = getSortedUniqueSlotIndexes(slots, selectedSlotIds);
  const sourceSlot = slots.find((slot) => slot.id === sourceSlotId) ?? slots[selectedIndexes[0]];
  const selectedIndexSet = new Set(selectedIndexes);
  const startSlotId = slots[selectedIndexes[0]].id;
  const endSlotId = slots[selectedIndexes[selectedIndexes.length - 1]].id;
  const nextRange: MergedTimeRange = {
    id: createRangeId(startSlotId, endSlotId),
    startSlotId,
    endSlotId,
  };

  return {
    didMerge: true,
    slots: slots.map((slot, index) =>
      selectedIndexSet.has(index)
        ? {
            ...slot,
            plan: sourceSlot.plan,
            actual: sourceSlot.actual,
            status: sourceSlot.status,
          }
        : slot,
    ),
    mergedRanges: [...mergedRanges, nextRange],
  };
}

export function removeMergedRangeForSlot(
  mergedRanges: MergedTimeRange[] = [],
  slotId: string,
) {
  const slotNumber = getSlotNumber(slotId);

  if (slotNumber === null) {
    return mergedRanges;
  }

  return mergedRanges.filter((range) => {
    const startNumber = getSlotNumber(range.startSlotId);
    const endNumber = getSlotNumber(range.endSlotId);

    return (
      startNumber === null ||
      endNumber === null ||
      slotNumber < startNumber ||
      slotNumber > endNumber
    );
  });
}
