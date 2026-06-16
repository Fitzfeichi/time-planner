import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { getMergedRangeForSlot, getMergedRangeSlotIds } from '../lib/mergedRanges';
import {
  expandNightFoldRangeForAdjacentSlot,
  isDefaultNightFoldRange,
  isSlotInNightFoldRange,
} from '../lib/nightFold';
import { statusLabels } from '../lib/status';
import type { MergedTimeRange, NightFoldRange, SlotSelectionMode, TimeSlot } from '../types';

type DropIndicatorPosition = 'before' | 'after';
type DropIndicatorTarget = 'slot' | 'night-fold';
type EditableSlotField = 'plan' | 'actual';

interface DropIndicator {
  target: DropIndicatorTarget;
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
  dateKey: string;
  slots: TimeSlot[];
  daySlots: TimeSlot[];
  mergedRanges?: MergedTimeRange[];
  tomorrowDateKey?: string;
  tomorrowSlots?: TimeSlot[];
  tomorrowMergedRanges?: MergedTimeRange[];
  selectedSlotId: string;
  selectedSlotIds: string[];
  currentSlotId: string | null;
  isNightFoldExpanded: boolean;
  nightFoldRange: NightFoldRange;
  onSelectDatedSlot: (dateKey: string, slotId: string, mode: SlotSelectionMode) => void;
  onFocusDatedSlotEditorField: (
    dateKey: string,
    slotId: string,
    field: EditableSlotField,
  ) => void;
  onMoveSelectedPlans: (dragStartSlotId: string, insertIndex: number) => void;
  onFoldSlotIntoNight: (slotId: string) => void;
  onResetNightFoldRange: () => void;
  onExpandNightFold: () => void;
}

export function TimeTable({
  dateKey,
  slots,
  daySlots,
  mergedRanges = [],
  tomorrowDateKey,
  tomorrowSlots,
  tomorrowMergedRanges = [],
  selectedSlotId,
  selectedSlotIds,
  currentSlotId,
  isNightFoldExpanded,
  nightFoldRange,
  onSelectDatedSlot,
  onFocusDatedSlotEditorField,
  onMoveSelectedPlans,
  onFoldSlotIntoNight,
  onResetNightFoldRange,
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
      target: 'slot',
      slotId,
      position,
      insertIndex,
    };
  }

  function getNightFoldDropIndicator(activeDraggedSlotId: string | null): DropIndicator | null {
    if (activeDraggedSlotId === null) {
      return null;
    }

    const draggedSlotIds = getDraggedSlotIds(activeDraggedSlotId);

    if (draggedSlotIds.length !== 1) {
      return null;
    }

    const draggedSlotId = draggedSlotIds[0];

    if (expandNightFoldRangeForAdjacentSlot(nightFoldRange, draggedSlotId) === null) {
      return null;
    }

    return {
      target: 'night-fold',
      slotId: draggedSlotId,
      position: 'after',
      insertIndex: -1,
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

  function handleSlotClick(event: MouseEvent<HTMLButtonElement>, rowDateKey: string, slotId: string) {
    if (didPointerDragRef.current) {
      didPointerDragRef.current = false;
      return;
    }

    onSelectDatedSlot(
      rowDateKey,
      slotId,
      rowDateKey === dateKey ? getSelectionMode(event) : 'replace',
    );
  }

  function getEditableFieldFromColumn(
    event: MouseEvent<HTMLButtonElement>,
  ): EditableSlotField | null {
    const planElement = event.currentTarget.querySelector<HTMLElement>('[data-edit-field="plan"]');
    const actualElement = event.currentTarget.querySelector<HTMLElement>(
      '[data-edit-field="actual"]',
    );
    const clientX = event.clientX;

    if (planElement !== null) {
      const planRect = planElement.getBoundingClientRect();

      if (clientX >= planRect.left && clientX <= planRect.right) {
        return 'plan';
      }
    }

    if (actualElement !== null) {
      const actualRect = actualElement.getBoundingClientRect();

      if (clientX >= actualRect.left && clientX <= actualRect.right) {
        return 'actual';
      }
    }

    return null;
  }

  function handleSlotDoubleClick(
    event: MouseEvent<HTMLButtonElement>,
    rowDateKey: string,
    slotId: string,
  ) {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const editableField = getEditableFieldFromColumn(event);

    if (editableField === null) {
      return;
    }

    onFocusDatedSlotEditorField(rowDateKey, slotId, editableField);
  }

  function getPointerTargetSlot(clientX: number, clientY: number) {
    const targetElement = document.elementFromPoint(clientX, clientY);

    if (!(targetElement instanceof HTMLElement)) {
      return null;
    }

    const nightFoldTarget = targetElement.closest<HTMLElement>('[data-night-fold-target="true"]');

    if (nightFoldTarget !== null) {
      return {
        slotId: 'night-fold',
        targetButton: null,
      };
    }

    const targetButton = targetElement.closest<HTMLButtonElement>('.slot-row[data-slot-id]');

    if (targetButton === null) {
      return null;
    }

    const slotId = targetButton.dataset.slotId;

    if (slotId === undefined || targetButton.dataset.dateKey !== dateKey) {
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

    if (targetSlot.targetButton === null) {
      return getNightFoldDropIndicator(pointerDrag.slotId);
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
        onSelectDatedSlot(dateKey, pointerDrag.slotId, 'replace');
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
        if (nextDropIndicator.target === 'night-fold') {
          onFoldSlotIntoNight(nextDropIndicator.slotId);
        } else {
          onMoveSelectedPlans(pointerDrag.slotId, nextDropIndicator.insertIndex);
        }
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

  function handleNightFoldKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    onExpandNightFold();
  }

  function handleResetNightFoldRange(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onResetNightFoldRange();
  }

  const rowGroups = [
    {
      dateKey,
      slots,
      daySlots,
      mergedRanges,
      timePrefix: '',
      canFoldNight: true,
      canDrag: true,
    },
    ...(tomorrowDateKey !== undefined && tomorrowSlots !== undefined
      ? [
          {
            dateKey: tomorrowDateKey,
            slots: tomorrowSlots,
            daySlots: tomorrowSlots,
            mergedRanges: tomorrowMergedRanges,
            timePrefix: '（明）',
            canFoldNight: false,
            canDrag: false,
          },
        ]
      : []),
  ];

  return (
    <section className="time-table" aria-label="一天时间表">
      <div className="table-head">
        <span>时间</span>
        <span>计划</span>
        <span>实际</span>
        <span>状态</span>
      </div>

      <div className="slot-list">
        {rowGroups.flatMap((row) =>
          row.slots.map((slot) => {
            const mergedRange = getMergedRangeForSlot(row.daySlots, row.mergedRanges, slot.id);
            const mergedRangeSlotIds =
              mergedRange === null ? [slot.id] : getMergedRangeSlotIds(row.daySlots, mergedRange);
            const isMergedRangeStart =
              mergedRange === null || mergedRange.startSlotId === slot.id;

            if (!isMergedRangeStart) {
              return null;
            }

            if (
              row.canFoldNight &&
              !isNightFoldExpanded &&
              isSlotInNightFoldRange(slot.id, nightFoldRange)
            ) {
              if (slot.id !== nightFoldRange.startSlotId) {
                return null;
              }

              const rangeEndSlot =
                slots.find((item) => item.id === nightFoldRange.endSlotId) ?? slot;
              const isCurrentFold =
                currentSlotId !== null && isSlotInNightFoldRange(currentSlotId, nightFoldRange);
              const isDropIntoNight = dropIndicator?.target === 'night-fold';
              const canResetNightFoldRange = !isDefaultNightFoldRange(nightFoldRange);

              return (
                <div
                  key={`${row.dateKey}-night-fold`}
                  data-date-key={row.dateKey}
                  data-night-fold-target="true"
                  role="button"
                  tabIndex={0}
                  className={[
                    'slot-row',
                    'night-fold-row',
                    isCurrentFold ? 'current' : '',
                    isDropIntoNight ? 'drop-into-night' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={onExpandNightFold}
                  onKeyDown={handleNightFoldKeyDown}
                >
                  <span className="slot-time">
                    {slot.start} - {rangeEndSlot.end}
                  </span>
                  <span className="slot-text">夜间时间已折叠</span>
                  <span className="slot-text">
                    {canResetNightFoldRange ? (
                      <button
                        type="button"
                        className="night-fold-reset-button"
                        onClick={handleResetNightFoldRange}
                      >
                        恢复默认
                      </button>
                    ) : (
                      '点击展开'
                    )}
                  </span>
                  <span className="status-pill">夜间</span>
                </div>
              );
            }

            const daySlot = row.daySlots.find((item) => item.id === slot.id) ?? slot;
            const rangeEndSlot =
              mergedRange === null
                ? daySlot
                : row.daySlots.find((item) => item.id === mergedRange.endSlotId) ?? daySlot;
            const displayEnd = mergedRange === null ? daySlot.end : rangeEndSlot.end;
            const isActiveDate = row.dateKey === dateKey;
            const isSelected =
              isActiveDate && mergedRangeSlotIds.some((slotId) => selectedSlotIds.includes(slotId));
            const isFocused = isActiveDate && mergedRangeSlotIds.includes(selectedSlotId);
            const isCurrent =
              isActiveDate && currentSlotId !== null && mergedRangeSlotIds.includes(currentSlotId);
            const isDraggingSelectedGroup =
              draggedSlotId !== null && selectedSlotIds.includes(draggedSlotId);
            const isDragging =
              row.canDrag &&
              (daySlot.id === draggedSlotId || (isDraggingSelectedGroup && isSelected));
            const isDropBefore =
              row.canDrag &&
              dropIndicator?.target === 'slot' &&
              dropIndicator.slotId === daySlot.id &&
              dropIndicator.position === 'before';
            const isDropAfter =
              row.canDrag &&
              dropIndicator?.target === 'slot' &&
              dropIndicator.slotId === daySlot.id &&
              dropIndicator.position === 'after';

            return (
              <button
                type="button"
                key={`${row.dateKey}-${slot.id}`}
                data-date-key={row.dateKey}
                data-slot-id={daySlot.id}
                aria-pressed={isSelected}
                className={[
                  'slot-row',
                  `status-${daySlot.status}`,
                  mergedRange === null ? '' : 'merged-range',
                  row.canDrag ? '' : 'next-day-row',
                  isSelected ? 'selected' : '',
                  isFocused ? 'focused' : '',
                  isCurrent ? 'current' : '',
                  isDragging ? 'dragging' : '',
                  isDropBefore ? 'drop-before' : '',
                  isDropAfter ? 'drop-after' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={(event) => handleSlotClick(event, row.dateKey, daySlot.id)}
                onDoubleClick={(event) => handleSlotDoubleClick(event, row.dateKey, daySlot.id)}
                onPointerDown={
                  row.canDrag ? (event) => handlePointerDown(event, daySlot.id) : undefined
                }
                onPointerMove={row.canDrag ? handlePointerMove : undefined}
                onPointerUp={row.canDrag ? handlePointerUp : undefined}
                onPointerCancel={row.canDrag ? handlePointerCancel : undefined}
              >
                <span className="slot-time">
                  <span className="slot-day-prefix">{row.timePrefix}</span>
                  <span className="slot-time-value">
                    {daySlot.start} - {displayEnd}
                  </span>
                </span>
                <span className="slot-text" data-edit-field="plan">
                  {daySlot.plan}
                </span>
                <span className="slot-text" data-edit-field="actual">
                  {daySlot.actual}
                </span>
                <span className="status-pill">{statusLabels[daySlot.status]}</span>
              </button>
            );
          }),
        )}
      </div>
    </section>
  );
}
