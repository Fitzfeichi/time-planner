import type { MergedTimeRange, TimeSlot } from '../types';

export interface MoveSelectedSlotPlansResult {
  didMove: boolean;
  mergedRanges: MergedTimeRange[];
  movedSlotIds: string[];
  slots: TimeSlot[];
}

interface MovableSlotPayload {
  plan: string;
  rangeId: string | null;
  status: TimeSlot['status'];
}

function getSlotIndexById(slots: TimeSlot[]) {
  return new Map(slots.map((slot, index) => [slot.id, index]));
}

function getRangeSlotIndexes(slots: TimeSlot[], range: MergedTimeRange) {
  const slotIndexById = getSlotIndexById(slots);
  const startIndex = slotIndexById.get(range.startSlotId);
  const endIndex = slotIndexById.get(range.endSlotId);

  if (startIndex === undefined || endIndex === undefined || startIndex > endIndex) {
    return [];
  }

  return Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => startIndex + offset);
}

function getExpandedSelectedIndices(
  slots: TimeSlot[],
  selectedSlotIds: string[],
  mergedRanges: MergedTimeRange[],
) {
  const slotIndexById = getSlotIndexById(slots);
  const selectedIndexSet = new Set<number>();

  selectedSlotIds.forEach((slotId) => {
    const slotIndex = slotIndexById.get(slotId);

    if (slotIndex === undefined) {
      return;
    }

    const mergedRange = mergedRanges.find((range) =>
      getRangeSlotIndexes(slots, range).includes(slotIndex),
    );

    if (mergedRange === undefined) {
      selectedIndexSet.add(slotIndex);
      return;
    }

    getRangeSlotIndexes(slots, mergedRange).forEach((rangeSlotIndex) => {
      selectedIndexSet.add(rangeSlotIndex);
    });
  });

  return Array.from(selectedIndexSet).sort((first, second) => first - second);
}

function getRangeIdBySlotIndex(slots: TimeSlot[], mergedRanges: MergedTimeRange[]) {
  const rangeIdBySlotIndex = new Map<number, string>();

  mergedRanges.forEach((range) => {
    getRangeSlotIndexes(slots, range).forEach((slotIndex) => {
      rangeIdBySlotIndex.set(slotIndex, range.id);
    });
  });

  return rangeIdBySlotIndex;
}

function moveMergedRanges(
  slots: TimeSlot[],
  mergedRanges: MergedTimeRange[],
  nextPayloads: MovableSlotPayload[],
) {
  return mergedRanges.map((range) => {
    const nextRangeIndexes = nextPayloads
      .map((payload, index) => (payload.rangeId === range.id ? index : null))
      .filter((index): index is number => index !== null);

    if (nextRangeIndexes.length === 0) {
      return range;
    }

    return {
      ...range,
      startSlotId: slots[nextRangeIndexes[0]].id,
      endSlotId: slots[nextRangeIndexes[nextRangeIndexes.length - 1]].id,
    };
  });
}

export function moveSelectedSlotPlans(
  slots: TimeSlot[],
  selectedSlotIds: string[],
  insertIndex: number,
  mergedRanges: MergedTimeRange[] = [],
): MoveSelectedSlotPlansResult {
  const clampedInsertIndex = Math.max(0, Math.min(insertIndex, slots.length));
  const selectedIndices = getExpandedSelectedIndices(slots, selectedSlotIds, mergedRanges);

  const selectedBoundaryIndexes = new Set(
    selectedIndices.flatMap((selectedIndex) => [selectedIndex, selectedIndex + 1]),
  );

  if (selectedIndices.length === 0 || selectedBoundaryIndexes.has(clampedInsertIndex)) {
    return {
      didMove: false,
      mergedRanges,
      movedSlotIds: selectedIndices.map((index) => slots[index].id),
      slots,
    };
  }

  const selectedIndexSet = new Set(selectedIndices);
  const rangeIdBySlotIndex = getRangeIdBySlotIndex(slots, mergedRanges);
  const payloads = slots.map(
    (slot, index): MovableSlotPayload => ({
      plan: slot.plan,
      rangeId: rangeIdBySlotIndex.get(index) ?? null,
      status: slot.status,
    }),
  );
  const selectedPayloads = selectedIndices.map((index) => payloads[index]);
  const remainingPayloads = payloads
    .filter((_, index) => !selectedIndexSet.has(index))
    .map((payload) => payload);
  const destinationStartIndex = Math.min(
    clampedInsertIndex,
    slots.length - selectedIndices.length,
  );
  const destinationIndices = Array.from(
    { length: selectedIndices.length },
    (_, offset) => destinationStartIndex + offset,
  );
  const destinationIndexSet = new Set(destinationIndices);
  const nextPayloads: MovableSlotPayload[] = [];
  let selectedPayloadIndex = 0;
  let remainingPayloadIndex = 0;

  slots.forEach((_, index) => {
    if (destinationIndexSet.has(index)) {
      nextPayloads.push(selectedPayloads[selectedPayloadIndex]);
      selectedPayloadIndex += 1;
      return;
    }

    nextPayloads.push(remainingPayloads[remainingPayloadIndex]);
    remainingPayloadIndex += 1;
  });

  const nextSlots = slots.map((slot, index) => {
    const payload = nextPayloads[index];

    return {
      ...slot,
      plan: payload.plan,
      status: payload.status,
    };
  });

  return {
    didMove: true,
    mergedRanges: moveMergedRanges(slots, mergedRanges, nextPayloads),
    movedSlotIds: destinationIndices.map((index) => slots[index].id),
    slots: nextSlots,
  };
}
