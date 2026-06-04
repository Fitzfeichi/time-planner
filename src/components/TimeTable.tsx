import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { getMergedRangeForSlot, getMergedRangeSlotIds } from '../lib/mergedRanges';
import { isNightFoldSlot } from '../lib/nightFold';
import { statusLabels } from '../lib/status';
import type { MergedTimeRange, SlotSelectionMode, TimeSlot } from '../types';

type DropIndicatorPosition = 'before' | 'after';

interface DropIndicator {
  slotId: string;
  position: DropIndicatorPosition;
  insertIndex: number;
}

interface PointerDragState {
  isDragging: boolean;
  pointerId: number;
  slotId: string;
  startX: number;
  startY: number;
}

interface TimeTableProps {
  slots: TimeSlot[];
  daySlots: TimeSlot[];
  mergedRanges?: MergedTimeRange[];
  selectedSlotId: string;
  selectedSlotIds: string[];
  currentSlotId: string | null;
  isNightFoldExpanded: boolean;
  onSelectSlot: (slotId: string, mode: SlotSelectionMode) => void;
  onEditSlotPlan: (slotId: string) => void;
  onMoveSelectedPlans: (dragStartSlotId: string, insertIndex: number) => void;
  onExpandNightFold: () => void;
}

export function TimeTable({
  slots,
  daySlots,
  mergedRanges = [],
  selectedSlotId,
  selectedSlotIds,
  currentSlotId,
  isNightFoldExpanded,
  onSelectSlot,
  onEditSlotPlan,
  onMoveSelectedPlans,
  onExpandNightFold,
}: TimeTableProps) {
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const didPointerDragRef = useRef(false);

  function clearDragState() {
    setDraggedSlotId(null);
    setDropIndicator(null);
    pointerDragRef.current = null;
  }

  function scrollListNearEdge(sourceElement: HTMLElement, clientY: number) {
    const listElement = sourceElement.closest('.slot-list');

    if (!(listElement instanceof HTMLElement)) {
      return;
    }

    const edgeSize = 56;
    const scrollStep = 12;
    const listRect = listElement.getBoundingClientRect();
    const distanceFromTop = clientY - listRect.top;
    const distanceFromBottom = listRect.bottom - clientY;

    if (distanceFromTop < edgeSize) {
      listElement.scrollTop -= scrollStep;
    } else if (distanceFromBottom < edgeSize) {
      listElement.scrollTop += scrollStep;
    }
  }

  function getSlotIndex(slotId: string) {
    return slots.findIndex((slot) => slot.id === slotId);
  }

  function getSlotIdsForSlot(slotId: string) {
    const mergedRange = getMergedRangeForSlot(daySlots, mergedRanges, slotId);

    return mergedRange === null ? [slotId] : getMergedRangeSlotIds(daySlots, mergedRange);
  }

  function getDraggedSlotIds(slotId: string) {
    const sourceSlotIds = selectedSlotIds.includes(slotId) ? selectedSlotIds : [slotId];

    return Array.from(new Set(sourceSlotIds.flatMap(getSlotIdsForSlot))).sort(
      (firstSlotId, secondSlotId) => getSlotIndex(firstSlotId) - getSlotIndex(secondSlotId),
    );
  }

  function isInsertInsideDraggedSelection(insertIndex: number, slotId: string) {
    const draggedSlotIds = getDraggedSlotIds(slotId);
    const selectedBoundaryIndexes = new Set<number>();

    draggedSlotIds.forEach((draggedSlotId) => {
      const selectedIndex = getSlotIndex(draggedSlotId);

      if (selectedIndex !== -1) {
        selectedBoundaryIndexes.add(selectedIndex);
        selectedBoundaryIndexes.add(selectedIndex + 1);
      }
    });

    return selectedBoundaryIndexes.has(insertIndex);
  }

  function getDropIndicator(
    targetElement: HTMLButtonElement,
    slotId: string,
    clientY: number,
    activeDraggedSlotId = draggedSlotId,
  ): DropIndicator | null {
    if (activeDraggedSlotId === null) {
      return null;
    }

    const targetSlotIds = getSlotIdsForSlot(slotId);
    const targetStartIndex = getSlotIndex(targetSlotIds[0]);
    const targetEndIndex = getSlotIndex(targetSlotIds[targetSlotIds.length - 1]);

    if (targetStartIndex === -1 || targetEndIndex === -1) {
      return null;
    }

    const rowRect = targetElement.getBoundingClientRect();
    const position: DropIndicatorPosition =
      clientY < rowRect.top + rowRect.height / 2 ? 'before' : 'after';
    const insertIndex = position === 'after' ? targetEndIndex + 1 : targetStartIndex;

    if (isInsertInsideDraggedSelection(insertIndex, activeDraggedSlotId)) {
      return null;
    }

    return {
      slotId,
      position,
      insertIndex,
    };
  }

  function getSelectionMode(event: MouseEvent<HTMLButtonElement>): SlotSelectionMode {
    if (event.shiftKey) {
      return 'range';
    }

    if (event.ctrlKey || event.metaKey) {
      return 'toggle';
    }

    return 'replace';
  }

  function handleSlotClick(event: MouseEvent<HTMLButtonElement>, slotId: string) {
    if (didPointerDragRef.current) {
      didPointerDragRef.current = false;
      return;
    }

    onSelectSlot(slotId, getSelectionMode(event));
  }

  function handleSlotDoubleClick(event: MouseEvent<HTMLButtonElement>, slotId: string) {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      return;
    }

    onEditSlotPlan(slotId);
  }

  function getPointerTargetSlot(clientX: number, clientY: number) {
    const targetElement = document.elementFromPoint(clientX, clientY);

    if (!(targetElement instanceof HTMLElement)) {
      return null;
    }

    const targetButton = targetElement.closest<HTMLButtonElement>('.slot-row[data-slot-id]');

    if (targetButton === null) {
      return null;
    }

    const slotId = targetButton.dataset.slotId;

    if (slotId === undefined) {
      return null;
    }

    return {
      slotId,
      targetButton,
    };
  }

  function getPointerDropIndicator(event: PointerEvent<HTMLButtonElement>) {
    const pointerDrag = pointerDragRef.current;

    if (pointerDrag === null) {
      return null;
    }

    const targetSlot = getPointerTargetSlot(event.clientX, event.clientY);

    if (targetSlot === null) {
      return null;
    }

    return getDropIndicator(
      targetSlot.targetButton,
      targetSlot.slotId,
      event.clientY,
      pointerDrag.slotId,
    );
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, slotId: string) {
    if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey) {
      return;
    }

    pointerDragRef.current = {
      isDragging: false,
      pointerId: event.pointerId,
      slotId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const pointerDrag = pointerDragRef.current;

    if (pointerDrag === null || pointerDrag.pointerId !== event.pointerId) {
      return;
    }

    const dragDistance = Math.hypot(
      event.clientX - pointerDrag.startX,
      event.clientY - pointerDrag.startY,
    );

    if (!pointerDrag.isDragging && dragDistance < 6) {
      return;
    }

    if (!pointerDrag.isDragging) {
      pointerDrag.isDragging = true;
      didPointerDragRef.current = true;

      if (!selectedSlotIds.includes(pointerDrag.slotId)) {
        onSelectSlot(pointerDrag.slotId, 'replace');
      }

      setDraggedSlotId(pointerDrag.slotId);
    }

    event.preventDefault();
    setDropIndicator(getPointerDropIndicator(event));
    scrollListNearEdge(event.currentTarget, event.clientY);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const pointerDrag = pointerDragRef.current;

    if (pointerDrag === null || pointerDrag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (pointerDrag.isDragging) {
      event.preventDefault();
      const nextDropIndicator = getPointerDropIndicator(event);

      if (nextDropIndicator !== null) {
        onMoveSelectedPlans(pointerDrag.slotId, nextDropIndicator.insertIndex);
      }

      window.setTimeout(() => {
        didPointerDragRef.current = false;
      }, 0);
    }

    clearDragState();
  }

  function handlePointerCancel(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    clearDragState();
  }

  return (
    <section className="time-table" aria-label="一天时间表">
      <div className="table-head">
        <span>时间</span>
        <span>计划</span>
        <span>实际</span>
        <span>状态</span>
      </div>

      <div className="slot-list">
        {slots.map((slot) => {
          const mergedRange = getMergedRangeForSlot(daySlots, mergedRanges, slot.id);
          const mergedRangeSlotIds =
            mergedRange === null ? [slot.id] : getMergedRangeSlotIds(daySlots, mergedRange);
          const isMergedRangeStart =
            mergedRange === null || mergedRange.startSlotId === slot.id;

          if (!isMergedRangeStart) {
            return null;
          }

          if (!isNightFoldExpanded && isNightFoldSlot(slot.id)) {
            if (slot.id !== 'slot-1') {
              return null;
            }

            const isCurrentFold = currentSlotId !== null && isNightFoldSlot(currentSlotId);

            return (
              <button
                type="button"
                key="night-fold"
                className={['slot-row', 'night-fold-row', isCurrentFold ? 'current' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={onExpandNightFold}
              >
                <span className="slot-time">00:30 - 08:00</span>
                <span className="slot-text">夜间时间已折叠</span>
                <span className="slot-text">点击展开</span>
                <span className="status-pill">夜间</span>
              </button>
            );
          }

          const daySlot = daySlots.find((item) => item.id === slot.id) ?? slot;
          const rangeEndSlot =
            mergedRange === null
              ? daySlot
              : daySlots.find((item) => item.id === mergedRange.endSlotId) ?? daySlot;
          const displayEnd = mergedRange === null ? daySlot.end : rangeEndSlot.end;
          const isSelected = mergedRangeSlotIds.some((slotId) => selectedSlotIds.includes(slotId));
          const isFocused = mergedRangeSlotIds.includes(selectedSlotId);
          const isCurrent = currentSlotId !== null && mergedRangeSlotIds.includes(currentSlotId);
          const isDraggingSelectedGroup =
            draggedSlotId !== null && selectedSlotIds.includes(draggedSlotId);
          const isDragging =
            daySlot.id === draggedSlotId || (isDraggingSelectedGroup && isSelected);
          const isDropBefore =
            dropIndicator?.slotId === daySlot.id && dropIndicator.position === 'before';
          const isDropAfter =
            dropIndicator?.slotId === daySlot.id && dropIndicator.position === 'after';

          return (
            <button
              type="button"
              key={slot.id}
              data-slot-id={daySlot.id}
              aria-pressed={isSelected}
              className={[
                'slot-row',
                `status-${daySlot.status}`,
                mergedRange === null ? '' : 'merged-range',
                isSelected ? 'selected' : '',
                isFocused ? 'focused' : '',
                isCurrent ? 'current' : '',
                isDragging ? 'dragging' : '',
                isDropBefore ? 'drop-before' : '',
                isDropAfter ? 'drop-after' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={(event) => handleSlotClick(event, daySlot.id)}
              onDoubleClick={(event) => handleSlotDoubleClick(event, daySlot.id)}
              onPointerDown={(event) => handlePointerDown(event, daySlot.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
            >
              <span className="slot-time">
                {daySlot.start} - {displayEnd}
              </span>
              <span className="slot-text">{daySlot.plan}</span>
              <span className="slot-text">{daySlot.actual}</span>
              <span className="status-pill">{statusLabels[daySlot.status]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
