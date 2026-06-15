import type { MergedTimeRange, TimeSlot } from '../types.ts';

interface ApplyMergedRangeResult {
  didMerge: boolean;
  slots: TimeSlot[];
  mergedRanges: MergedTimeRange[];
  mergedSlotIds: string[];
}

interface SplitOneMergedRangeResult {
  didSplit: boolean;
  mergedRanges: MergedTimeRange[];
  remainingSlotIds: string[];
  detachedSlotId: string | null;
}

interface NormalizedMergeSelection {
  indexes: number[];
  slotIds: string[];
  existingRange: MergedTimeRange | null;
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

function isContiguousIndexes(indexes: number[]) {
  return indexes.every((index, offset) => {
    if (offset === 0) {
      return true;
    }

    return index === indexes[offset - 1] + 1;
  });
}

function isBlankSlot(slot: TimeSlot) {
  return slot.plan.trim() === '' && slot.actual.trim() === '' && slot.status === 'empty';
}

function getNormalizedMergeSelection(
  slots: TimeSlot[],
  mergedRanges: MergedTimeRange[] = [],
  selectedSlotIds: string[],
): NormalizedMergeSelection | null {
  const selectedIndexes = getSortedUniqueSlotIndexes(slots, selectedSlotIds);

  if (selectedIndexes.length < 2) {
    return null;
  }

  const slotIndexById = getSlotIndexById(slots);
  const expandedIndexSet = new Set<number>();
  const existingRangeIds = new Set<string>();

  selectedIndexes.forEach((index) => {
    const slot = slots[index];
    const mergedRange = getMergedRangeForSlot(slots, mergedRanges, slot.id);

    if (mergedRange === null) {
      expandedIndexSet.add(index);
      return;
    }

    existingRangeIds.add(mergedRange.id);
    getMergedRangeSlotIds(slots, mergedRange).forEach((rangeSlotId) => {
      const rangeSlotIndex = slotIndexById.get(rangeSlotId);

      if (rangeSlotIndex !== undefined) {
        expandedIndexSet.add(rangeSlotIndex);
      }
    });
  });

  if (existingRangeIds.size > 1) {
    return null;
  }

  const indexes = Array.from(expandedIndexSet).sort((first, second) => first - second);

  if (indexes.length < 2 || !isContiguousIndexes(indexes)) {
    return null;
  }

  const existingRangeId = Array.from(existingRangeIds)[0];
  const existingRange =
    existingRangeId === undefined
      ? null
      : mergedRanges.find((range) => range.id === existingRangeId) ?? null;

  return {
    indexes,
    slotIds: indexes.map((index) => slots[index].id),
    existingRange,
  };
}

function getMergeSourceSlot(
  slots: TimeSlot[],
  selection: NormalizedMergeSelection,
  sourceSlotId: string,
) {
  if (selection.existingRange !== null) {
    return (
      slots.find((slot) => slot.id === selection.existingRange?.startSlotId) ??
      slots[selection.indexes[0]]
    );
  }

  const selectedSlots = selection.indexes.map((index) => slots[index]);
  const plannedSlots = selectedSlots.filter((slot) => slot.plan.trim() !== '');

  return (
    (plannedSlots.length === 1 ? plannedSlots[0] : undefined) ??
    slots.find((slot) => slot.id === sourceSlotId) ??
    slots[selection.indexes[0]]
  );
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
  return getNormalizedMergeSelection(slots, mergedRanges, selectedSlotIds) !== null;
}

export function hasMergedRangeConflict(
  slots: TimeSlot[],
  mergedRanges: MergedTimeRange[] = [],
  selectedSlotIds: string[],
  sourceSlotId: string,
) {
  const selection = getNormalizedMergeSelection(slots, mergedRanges, selectedSlotIds);

  if (selection === null) {
    return false;
  }

  const sourceSlot = getMergeSourceSlot(slots, selection, sourceSlotId);
  const existingRangeSlotIds = new Set(
    selection.existingRange === null
      ? []
      : getMergedRangeSlotIds(slots, selection.existingRange),
  );

  return selection.slotIds.some((slotId) => {
    if (existingRangeSlotIds.has(slotId)) {
      return false;
    }

    const slot = slots.find((item) => item.id === slotId);

    return (
      slot !== undefined &&
      !isBlankSlot(slot) &&
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
  const selection = getNormalizedMergeSelection(slots, mergedRanges, selectedSlotIds);

  if (selection === null) {
    return {
      didMerge: false,
      slots,
      mergedRanges,
      mergedSlotIds: [],
    };
  }

  const sourceSlot = getMergeSourceSlot(slots, selection, sourceSlotId);
  const selectedIndexSet = new Set(selection.indexes);
  const startSlotId = slots[selection.indexes[0]].id;
  const endSlotId = slots[selection.indexes[selection.indexes.length - 1]].id;
  const nextRange: MergedTimeRange = {
    id: selection.existingRange?.id ?? createRangeId(startSlotId, endSlotId),
    startSlotId,
    endSlotId,
  };
  const nextMergedRanges =
    selection.existingRange === null
      ? [...mergedRanges, nextRange]
      : mergedRanges.map((range) => (range.id === selection.existingRange?.id ? nextRange : range));

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
    mergedRanges: nextMergedRanges,
    mergedSlotIds: selection.slotIds,
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

export function splitOneSlotFromMergedRangeEnd(
  slots: TimeSlot[],
  mergedRanges: MergedTimeRange[] = [],
  slotId: string,
): SplitOneMergedRangeResult {
  const mergedRange = getMergedRangeForSlot(slots, mergedRanges, slotId);

  if (mergedRange === null) {
    return {
      didSplit: false,
      mergedRanges,
      remainingSlotIds: [slotId],
      detachedSlotId: null,
    };
  }

  const rangeSlotIds = getMergedRangeSlotIds(slots, mergedRange);

  if (rangeSlotIds.length < 2) {
    return {
      didSplit: false,
      mergedRanges,
      remainingSlotIds: rangeSlotIds,
      detachedSlotId: null,
    };
  }

  const detachedSlotId = rangeSlotIds[rangeSlotIds.length - 1];
  const remainingSlotIds = rangeSlotIds.slice(0, -1);

  if (rangeSlotIds.length === 2) {
    return {
      didSplit: true,
      mergedRanges: removeMergedRangeForSlot(mergedRanges, slotId),
      remainingSlotIds: [remainingSlotIds[0]],
      detachedSlotId,
    };
  }

  const nextRange: MergedTimeRange = {
    ...mergedRange,
    endSlotId: remainingSlotIds[remainingSlotIds.length - 1],
  };

  return {
    didSplit: true,
    mergedRanges: mergedRanges.map((range) =>
      range.id === mergedRange.id ? nextRange : range,
    ),
    remainingSlotIds,
    detachedSlotId,
  };
}
