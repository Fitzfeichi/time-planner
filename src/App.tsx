import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { AppUpdatePanel } from './components/AppUpdatePanel';
import { ConfirmDialog, type ConfirmDialogContent } from './components/ConfirmDialog';
import { CurrentTaskCard } from './components/CurrentTaskCard';
import { DayHeader } from './components/DayHeader';
import { ReviewPanel } from './components/ReviewPanel';
import { SlotEditor } from './components/SlotEditor';
import { TimeTable } from './components/TimeTable';
import {
  applyMergedRange,
  canCreateMergedRange,
  getMergedRangeForSlot,
  getMergedRangeSlotIds,
  hasMergedRangeConflict,
  removeMergedRangeForSlot,
  splitOneSlotFromMergedRangeEnd,
} from './lib/mergedRanges';
import {
  DEFAULT_NIGHT_FOLD_RANGE,
  expandNightFoldRangeForAdjacentSlot,
  isDefaultNightFoldRange,
  isNightFoldSlot,
  isSlotInNightFoldRange,
  shouldExpandNightFoldForSlots,
} from './lib/nightFold';
import { readMiniNeighborPreference } from './lib/miniNeighborPreference';
import { applyTaskTimingAdjustment, updateSlotPlanForDate } from './lib/planUpdates';
import { getTaskBlockNeighbors } from './lib/slotNeighbors';
import { moveSelectedSlotPlans } from './lib/slotMoves';
import { getDesktopBridge } from './lib/desktopBridge';
import { getTaskProgressPercent } from './lib/taskProgress';
import { createEmptyDayPlan, createTimeSlots, getCurrentSlotId } from './lib/timeSlots';
import type {
  DayPlan,
  MergedTimeRange,
  NightFoldRange,
  PersistedAppState,
  PlansByDate,
  SlotSelectionMode,
  SlotStatus,
  TimeSlot,
} from './types';

const STORAGE_KEY = 'time-manager-app-state';
const WORKSPACE_LAYOUT_STORAGE_KEY = 'time-manager-workspace-layout';
const STICKY_NOTE_STORAGE_KEY = 'time-manager-sticky-note-content';
const STORAGE_VERSION = 3;
const EXPECTED_SLOT_COUNT = 48;
const MINI_WINDOW_WIDTH = 260;
const MINI_WINDOW_RESIZE_THRESHOLD = 2;
const DEFAULT_SIDE_PANEL_WIDTH = 360;
const MIN_SIDE_PANEL_WIDTH = 300;
const MAX_SIDE_PANEL_WIDTH = 560;
const MIN_TIME_TABLE_WIDTH = 520;
const WORKSPACE_DIVIDER_WIDTH = 10;
const WORKSPACE_RESIZE_KEYBOARD_STEP = 24;
const SLOT_STATUSES: SlotStatus[] = ['empty', 'planned', 'done', 'changed'];
type AppView = 'main' | 'mini' | 'sticky-note';
type EditableSlotField = 'plan' | 'actual';
type NightFoldExpansionMode = 'auto' | 'expanded' | 'collapsed';

interface SlotEditorFocusRequest {
  field: EditableSlotField;
  requestId: number;
}

interface LegacyPersistedAppState {
  version: number;
  currentDate: string;
  selectedSlotId: string;
  dayPlan: DayPlan;
}

interface PersistedAppStateV2 {
  version: 2;
  currentDate: string;
  selectedSlotId: string;
  plansByDate: PlansByDate;
  showMiniNeighborTasks?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function padDatePart(value: number) {
  return value.toString().padStart(2, '0');
}

function getDateKey(date: Date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
}

function createDateFromKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return getDateKey(date) === dateKey ? date : null;
}

function isValidDateKey(value: unknown): value is string {
  return typeof value === 'string' && createDateFromKey(value) !== null;
}

function getPreviousDateKey(date: Date) {
  const previousDate = new Date(date);
  previousDate.setDate(date.getDate() - 1);
  return getDateKey(previousDate);
}

function getNextDateKey(date: Date) {
  const nextDate = new Date(date);
  nextDate.setDate(date.getDate() + 1);
  return getDateKey(nextDate);
}

function isValidSlotId(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('slot-')) {
    return false;
  }

  const slotIndex = Number(value.slice(5));
  return Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < EXPECTED_SLOT_COUNT;
}

function isSlotStatus(value: unknown): value is SlotStatus {
  return typeof value === 'string' && SLOT_STATUSES.includes(value as SlotStatus);
}

function isValidTimeSlot(value: unknown): value is TimeSlot {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.start === 'string' &&
    typeof value.end === 'string' &&
    typeof value.plan === 'string' &&
    typeof value.actual === 'string' &&
    isSlotStatus(value.status)
  );
}

function isValidMergedTimeRange(value: unknown): value is MergedTimeRange {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isValidSlotId(value.startSlotId) &&
    isValidSlotId(value.endSlotId)
  );
}

function isValidNightFoldRange(value: unknown): value is NightFoldRange {
  return (
    isRecord(value) &&
    isValidSlotId(value.startSlotId) &&
    isValidSlotId(value.endSlotId)
  );
}

function isValidDayPlan(value: unknown): value is DayPlan {
  return (
    isRecord(value) &&
    typeof value.review === 'string' &&
    Array.isArray(value.slots) &&
    value.slots.length === EXPECTED_SLOT_COUNT &&
    value.slots.every(isValidTimeSlot) &&
    (value.mergedRanges === undefined ||
      (Array.isArray(value.mergedRanges) && value.mergedRanges.every(isValidMergedTimeRange))) &&
    (value.nightFoldRange === undefined || isValidNightFoldRange(value.nightFoldRange))
  );
}

function isValidPlansByDate(value: unknown): value is PlansByDate {
  return (
    isRecord(value) &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([dateKey, dayPlan]) => isValidDateKey(dateKey) && isValidDayPlan(dayPlan),
    )
  );
}

function isValidSavedState(value: unknown): value is PersistedAppState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === STORAGE_VERSION &&
    isValidDateKey(value.currentDate) &&
    isValidSlotId(value.selectedSlotId) &&
    isValidPlansByDate(value.plansByDate) &&
    (value.showMiniNeighborTasks === undefined || typeof value.showMiniNeighborTasks === 'boolean')
  );
}

function isValidSavedStateV2(value: unknown): value is PersistedAppStateV2 {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 2 &&
    isValidDateKey(value.currentDate) &&
    isValidSlotId(value.selectedSlotId) &&
    isValidPlansByDate(value.plansByDate) &&
    (value.showMiniNeighborTasks === undefined || typeof value.showMiniNeighborTasks === 'boolean')
  );
}

function isValidLegacySavedState(value: unknown): value is LegacyPersistedAppState {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.version !== 1 ||
    typeof value.currentDate !== 'string' ||
    !isValidSlotId(value.selectedSlotId) ||
    !isValidDayPlan(value.dayPlan)
  ) {
    return false;
  }

  const savedDate = new Date(value.currentDate);
  const hasSelectedSlot = value.dayPlan.slots.some((slot) => slot.id === value.selectedSlotId);

  return !Number.isNaN(savedDate.getTime()) && hasSelectedSlot;
}

function normalizeDayPlan(dayPlan: DayPlan): DayPlan {
  return {
    ...dayPlan,
    mergedRanges: dayPlan.mergedRanges ?? [],
  };
}

function normalizePlansByDate(plansByDate: PlansByDate) {
  return Object.fromEntries(
    Object.entries(plansByDate).map(([dateKey, dayPlan]) => [
      dateKey,
      normalizeDayPlan(dayPlan),
    ]),
  );
}

function migrateSavedStateV2(state: PersistedAppStateV2): PersistedAppState {
  return {
    ...state,
    version: STORAGE_VERSION,
    plansByDate: normalizePlansByDate(state.plansByDate),
  };
}

function migrateLegacySavedState(state: LegacyPersistedAppState): PersistedAppState {
  const today = new Date();
  const todayKey = getDateKey(today);
  const previousDateKey = getPreviousDateKey(today);

  return {
    version: STORAGE_VERSION,
    currentDate: todayKey,
    selectedSlotId: state.selectedSlotId,
    plansByDate: {
      [previousDateKey]: normalizeDayPlan(state.dayPlan),
    },
    showMiniNeighborTasks: false,
  };
}

function loadSavedState() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const savedValue = window.localStorage.getItem(STORAGE_KEY);
    if (savedValue === null) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(savedValue);
    if (isValidSavedState(parsedValue)) {
      return {
        ...parsedValue,
        plansByDate: normalizePlansByDate(parsedValue.plansByDate),
      };
    }

    if (isValidSavedStateV2(parsedValue)) {
      return migrateSavedStateV2(parsedValue);
    }

    if (isValidLegacySavedState(parsedValue)) {
      return migrateLegacySavedState(parsedValue);
    }

    return null;
  } catch {
    return null;
  }
}

function saveState(state: PersistedAppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable or full; the app should keep working in memory.
  }
}

function getMaxSidePanelWidth(workspaceWidth: number) {
  return Math.max(
    MIN_SIDE_PANEL_WIDTH,
    Math.min(MAX_SIDE_PANEL_WIDTH, workspaceWidth - MIN_TIME_TABLE_WIDTH - WORKSPACE_DIVIDER_WIDTH),
  );
}

function clampSidePanelWidth(width: number, workspaceWidth: number) {
  return Math.min(getMaxSidePanelWidth(workspaceWidth), Math.max(MIN_SIDE_PANEL_WIDTH, width));
}

function readSavedSidePanelWidth() {
  if (typeof window === 'undefined') {
    return DEFAULT_SIDE_PANEL_WIDTH;
  }

  try {
    const savedValue = window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY);

    if (savedValue === null) {
      return DEFAULT_SIDE_PANEL_WIDTH;
    }

    const parsedValue: unknown = JSON.parse(savedValue);

    if (
      isRecord(parsedValue) &&
      typeof parsedValue.sidePanelWidth === 'number' &&
      Number.isFinite(parsedValue.sidePanelWidth)
    ) {
      return Math.min(
        MAX_SIDE_PANEL_WIDTH,
        Math.max(MIN_SIDE_PANEL_WIDTH, parsedValue.sidePanelWidth),
      );
    }
  } catch {
    // Layout preferences are optional; invalid saved values should not block the planner.
  }

  return DEFAULT_SIDE_PANEL_WIDTH;
}

function saveSidePanelWidth(sidePanelWidth: number) {
  try {
    window.localStorage.setItem(
      WORKSPACE_LAYOUT_STORAGE_KEY,
      JSON.stringify({ sidePanelWidth }),
    );
  } catch {
    // localStorage may be unavailable or full; the default width remains usable.
  }
}

function getInitialAppView(): AppView {
  if (typeof window === 'undefined') {
    return 'main';
  }

  const view = new URLSearchParams(window.location.search).get('view');

  if (view === 'mini' || view === 'sticky-note') {
    return view;
  }

  return 'main';
}

function readStickyNoteContent() {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return window.localStorage.getItem(STICKY_NOTE_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveStickyNoteContent(content: string) {
  try {
    window.localStorage.setItem(STICKY_NOTE_STORAGE_KEY, content);
  } catch {
    // The sticky note should remain editable even if localStorage is unavailable.
  }
}

function getPlanForDate(plansByDate: PlansByDate, dateKey: string) {
  return normalizeDayPlan(plansByDate[dateKey] ?? createEmptyDayPlan());
}

function getSortedValidSlotIds(slots: TimeSlot[], slotIds: string[]) {
  const slotIndexById = new Map(slots.map((slot, index) => [slot.id, index]));

  return Array.from(new Set(slotIds))
    .filter((slotId) => slotIndexById.has(slotId))
    .sort((firstSlotId, secondSlotId) => {
      const firstIndex = slotIndexById.get(firstSlotId) ?? 0;
      const secondIndex = slotIndexById.get(secondSlotId) ?? 0;
      return firstIndex - secondIndex;
    });
}

function getSlotRangeIds(slots: TimeSlot[], firstSlotId: string, secondSlotId: string) {
  const firstIndex = slots.findIndex((slot) => slot.id === firstSlotId);
  const secondIndex = slots.findIndex((slot) => slot.id === secondSlotId);

  if (firstIndex === -1 || secondIndex === -1) {
    return null;
  }

  const startIndex = Math.min(firstIndex, secondIndex);
  const endIndex = Math.max(firstIndex, secondIndex);

  return slots.slice(startIndex, endIndex + 1).map((slot) => slot.id);
}

function getSlotWithRangeTime(
  slots: TimeSlot[],
  slot: TimeSlot | null,
  mergedRange: MergedTimeRange | null,
) {
  if (slot === null || mergedRange === null) {
    return slot;
  }

  const rangeSlotIds = getMergedRangeSlotIds(slots, mergedRange);
  const startSlot = slots.find((item) => item.id === rangeSlotIds[0]);
  const endSlot = slots.find((item) => item.id === rangeSlotIds[rangeSlotIds.length - 1]);

  if (startSlot === undefined || endSlot === undefined) {
    return slot;
  }

  return {
    ...slot,
    start: startSlot.start,
    end: endSlot.end,
  };
}

function getMergeConfirmationDetails(slots: TimeSlot[], selectedSlotIds: string[]) {
  const selectedSlots = slots.filter((slot) => selectedSlotIds.includes(slot.id));

  if (selectedSlots.length === 0) {
    return '';
  }

  const firstSlot = selectedSlots[0];
  const lastSlot = selectedSlots[selectedSlots.length - 1];

  return `将合并 ${firstSlot.start} - ${lastSlot.end}，共 ${selectedSlots.length} 个时间格。`;
}

function StickyNoteView() {
  const [content, setContent] = useState(readStickyNoteContent);

  useEffect(() => {
    document.body.classList.add('sticky-note-mode');

    return () => {
      document.body.classList.remove('sticky-note-mode');
    };
  }, []);

  useEffect(() => {
    saveStickyNoteContent(content);
  }, [content]);

  return (
    <main className="sticky-note-shell">
      <textarea
        className="sticky-note-input"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="在这里记录临时想法"
        aria-label="便利贴内容"
      />
    </main>
  );
}

export function App() {
  const initialView = getInitialAppView();

  if (initialView === 'sticky-note') {
    return <StickyNoteView />;
  }

  const isMiniView = initialView === 'mini';
  const slots = useMemo(() => createTimeSlots(), []);
  const savedState = useMemo(() => loadSavedState(), []);
  const initialNow = useMemo(() => new Date(), []);
  const initialDate = useMemo(() => {
    if (!isMiniView) {
      return initialNow;
    }

    if (savedState === null) {
      return initialNow;
    }

    return createDateFromKey(savedState.currentDate) ?? initialNow;
  }, [initialNow, isMiniView, savedState]);
  const desktopBridge = useMemo(() => getDesktopBridge(), []);
  const initialSelectedSlotId = isMiniView
    ? savedState?.selectedSlotId ?? slots[16].id
    : getCurrentSlotId(initialNow);
  const [currentDate, setCurrentDate] = useState(() => initialDate);
  const [plansByDate, setPlansByDate] = useState<PlansByDate>(
    () => savedState?.plansByDate ?? { [getDateKey(initialDate)]: createEmptyDayPlan() },
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string>(() => initialSelectedSlotId);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(() => [initialSelectedSlotId]);
  const [selectionAnchorSlotId, setSelectionAnchorSlotId] = useState<string>(
    () => initialSelectedSlotId,
  );
  const [slotEditorFocusRequest, setSlotEditorFocusRequest] =
    useState<SlotEditorFocusRequest | null>(null);
  const [now, setNow] = useState(() => initialNow);
  const [showMiniNeighborTasks, setShowMiniNeighborTasks] = useState(() =>
    readMiniNeighborPreference(savedState ?? {}),
  );
  const [isMiniAlwaysOnTop, setIsMiniAlwaysOnTop] = useState(false);
  const [isStickyNoteOpen, setIsStickyNoteOpen] = useState(false);
  const [nightFoldExpansionMode, setNightFoldExpansionMode] = useState<NightFoldExpansionMode>(
    () => (!isMiniView && isNightFoldSlot(initialSelectedSlotId) ? 'expanded' : 'auto'),
  );
  const hasAutoScrolledToCurrentSlot = useRef(false);
  const miniShellRef = useRef<HTMLElement | null>(null);
  const lastMiniWindowHeight = useRef(0);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const sidePanelRef = useRef<HTMLElement | null>(null);
  const [sidePanelWidth, setSidePanelWidth] = useState(readSavedSidePanelWidth);
  const [workspaceContentHeight, setWorkspaceContentHeight] = useState<number | null>(null);
  const [isWorkspaceResizing, setIsWorkspaceResizing] = useState(false);
  const [confirmationRequest, setConfirmationRequest] = useState<ConfirmDialogContent | null>(null);
  const confirmationResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const [historyStack, setHistoryStack] = useState<PlansByDate[]>([]);

  function saveToHistory() {
    setHistoryStack((previous) => [...previous, JSON.parse(JSON.stringify(plansByDate))]);
  }

  function undo() {
    if (historyStack.length === 0) {
      return;
    }

    const previousState = historyStack[historyStack.length - 1];
    setHistoryStack((previous) => previous.slice(0, -1));
    setPlansByDate(previousState);
  }

  const currentDateKey = getDateKey(currentDate);
  const todayDateKey = getDateKey(now);
  const nextDateKey = getNextDateKey(currentDate);
  const dayPlan = getPlanForDate(plansByDate, currentDateKey);
  const todayPlan = getPlanForDate(plansByDate, todayDateKey);
  const nextDayPlan = getPlanForDate(plansByDate, nextDateKey);
  const selectedSlot = dayPlan.slots.find((slot) => slot.id === selectedSlotId) ?? dayPlan.slots[0];
  const currentSlotId = getCurrentSlotId(now);
  const currentSlotNeighbors = getTaskBlockNeighbors(
    todayPlan.slots,
    currentSlotId,
    todayPlan.mergedRanges,
  );
  const selectedMergedRange = getMergedRangeForSlot(
    dayPlan.slots,
    dayPlan.mergedRanges,
    selectedSlot.id,
  );
  const selectedEditorSlot =
    getSlotWithRangeTime(dayPlan.slots, selectedSlot, selectedMergedRange) ?? selectedSlot;
  const currentMergedRange = getMergedRangeForSlot(
    todayPlan.slots,
    todayPlan.mergedRanges,
    currentSlotId,
  );
  const currentSlot = currentSlotNeighbors.current;
  const isViewingToday = currentDateKey === todayDateKey;
  const nightFoldRange = dayPlan.nightFoldRange ?? DEFAULT_NIGHT_FOLD_RANGE;
  const isNightFoldExpanded =
    nightFoldExpansionMode === 'expanded' ||
    (nightFoldExpansionMode !== 'collapsed' && shouldExpandNightFoldForSlots(dayPlan.slots));
  const currentVisibleSlotId =
    !isNightFoldExpanded && isViewingToday && isSlotInNightFoldRange(currentSlotId, nightFoldRange)
      ? nightFoldRange.startSlotId
      : currentMergedRange?.startSlotId ?? currentSlotId;
  const canMergeSelectedSlots = canCreateMergedRange(
    dayPlan.slots,
    dayPlan.mergedRanges,
    selectedSlotIds,
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, isMiniView ? 1000 : 30000);

    return () => window.clearInterval(intervalId);
  }, [isMiniView]);

  useEffect(() => {
    if (!isMiniView) {
      return;
    }

    document.body.classList.add('mini-mode');

    return () => {
      document.body.classList.remove('mini-mode');
    };
  }, [isMiniView]);

  useEffect(() => {
    if (!isMiniView || miniShellRef.current === null) {
      return;
    }

    const miniShell = miniShellRef.current;
    let resizeFrameId: number | null = null;

    function resizeMiniWindow() {
      if (resizeFrameId !== null) {
        window.cancelAnimationFrame(resizeFrameId);
      }

      resizeFrameId = window.requestAnimationFrame(() => {
        const nextHeight = Math.ceil(miniShell.scrollHeight);

        if (
          Math.abs(nextHeight - lastMiniWindowHeight.current) < MINI_WINDOW_RESIZE_THRESHOLD
        ) {
          return;
        }

        lastMiniWindowHeight.current = nextHeight;

        if (desktopBridge) {
          void desktopBridge.resizeMiniWindow(nextHeight);
          return;
        }

        try {
          window.resizeTo(MINI_WINDOW_WIDTH, nextHeight);
        } catch {
          // Some browsers block popup resizing; Tauri uses the desktop bridge above.
        }
      });
    }

    resizeMiniWindow();

    const resizeObserver = new ResizeObserver(resizeMiniWindow);
    resizeObserver.observe(miniShell);

    return () => {
      resizeObserver.disconnect();

      if (resizeFrameId !== null) {
        window.cancelAnimationFrame(resizeFrameId);
      }
    };
  }, [desktopBridge, isMiniView]);

  useEffect(() => {
    if (isNightFoldExpanded || !isSlotInNightFoldRange(selectedSlotId, nightFoldRange)) {
      return;
    }

    const rangeStartIndex = slots.findIndex((slot) => slot.id === nightFoldRange.startSlotId);
    const rangeEndIndex = slots.findIndex((slot) => slot.id === nightFoldRange.endSlotId);
    const nextVisibleSlot = slots[rangeEndIndex + 1] ?? slots[rangeStartIndex - 1] ?? slots[0];

    setSelectedSlotId(nextVisibleSlot.id);
    setSelectedSlotIds([nextVisibleSlot.id]);
    setSelectionAnchorSlotId(nextVisibleSlot.id);
  }, [isNightFoldExpanded, nightFoldRange, selectedSlotId, slots]);

  useEffect(() => {
    if (isMiniView || hasAutoScrolledToCurrentSlot.current) {
      return;
    }

    if (
      nightFoldExpansionMode !== 'collapsed' &&
      isNightFoldSlot(currentSlotId) &&
      !isNightFoldExpanded
    ) {
      setNightFoldExpansionMode('expanded');
      return;
    }

    hasAutoScrolledToCurrentSlot.current = true;

    scrollSlotListToSecondVisibleRow(todayDateKey, currentVisibleSlotId);
  }, [
    currentSlotId,
    currentVisibleSlotId,
    isMiniView,
    isNightFoldExpanded,
    nightFoldExpansionMode,
    todayDateKey,
  ]);

  useEffect(() => {
    setPlansByDate((previous) => {
      if (previous[currentDateKey]) {
        return previous;
      }

      return {
        ...previous,
        [currentDateKey]: createEmptyDayPlan(),
      };
    });
  }, [currentDateKey]);

  useEffect(() => {
    saveState({
      version: STORAGE_VERSION,
      currentDate: currentDateKey,
      selectedSlotId,
      plansByDate,
      showMiniNeighborTasks,
    });
  }, [currentDateKey, plansByDate, selectedSlotId, showMiniNeighborTasks]);

  useEffect(() => {
    saveSidePanelWidth(sidePanelWidth);
  }, [sidePanelWidth]);

  useEffect(() => {
    if (isMiniView || sidePanelRef.current === null) {
      return;
    }

    const sidePanelElement = sidePanelRef.current;
    let frameId: number | null = null;

    function syncWorkspaceContentHeight() {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        const nextHeight = Math.ceil(sidePanelElement.getBoundingClientRect().height);
        setWorkspaceContentHeight((previous) =>
          previous === nextHeight ? previous : nextHeight,
        );
      });
    }

    syncWorkspaceContentHeight();

    const resizeObserver = new ResizeObserver(syncWorkspaceContentHeight);
    resizeObserver.observe(sidePanelElement);
    window.addEventListener('resize', syncWorkspaceContentHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncWorkspaceContentHeight);

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [isMiniView]);

  useEffect(() => {
    if (!isWorkspaceResizing) {
      return;
    }

    document.body.classList.add('workspace-resizing');

    return () => {
      document.body.classList.remove('workspace-resizing');
    };
  }, [isWorkspaceResizing]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();
        undo();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [historyStack]);

  useEffect(() => {
    return () => {
      confirmationResolver.current?.(false);
      confirmationResolver.current = null;
    };
  }, []);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || event.newValue === null) {
        return;
      }

      try {
        const parsedValue: unknown = JSON.parse(event.newValue);
        if (!isValidSavedState(parsedValue)) {
          return;
        }

        const parsedCurrentDate = createDateFromKey(parsedValue.currentDate);
        if (parsedCurrentDate === null) {
          return;
        }

        setCurrentDate(parsedCurrentDate);
        setSelectedSlotId(parsedValue.selectedSlotId);
        setSelectedSlotIds([parsedValue.selectedSlotId]);
        setSelectionAnchorSlotId(parsedValue.selectedSlotId);
        setPlansByDate(parsedValue.plansByDate);
        setShowMiniNeighborTasks(readMiniNeighborPreference(parsedValue));
      } catch {
        // Ignore malformed external updates and keep the current window usable.
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  function updatePlanForCurrentDate(updater: (previous: DayPlan) => DayPlan) {
    setPlansByDate((previous) => {
      const previousDayPlan = getPlanForDate(previous, currentDateKey);

      return {
        ...previous,
        [currentDateKey]: updater(previousDayPlan),
      };
    });
  }

  function requestConfirmation(request: ConfirmDialogContent) {
    confirmationResolver.current?.(false);

    return new Promise<boolean>((resolve) => {
      confirmationResolver.current = resolve;
      setConfirmationRequest(request);
    });
  }

  function closeConfirmation(confirmed: boolean) {
    confirmationResolver.current?.(confirmed);
    confirmationResolver.current = null;
    setConfirmationRequest(null);
  }

  function updateSelectedSlot(nextSlot: TimeSlot) {
    const mergedRange = getMergedRangeForSlot(dayPlan.slots, dayPlan.mergedRanges, nextSlot.id);
    const slotIdsToUpdate = new Set(
      mergedRange === null
        ? [nextSlot.id]
        : getMergedRangeSlotIds(dayPlan.slots, mergedRange),
    );

    saveToHistory();
    updatePlanForCurrentDate((previous) => ({
      ...previous,
      slots: previous.slots.map((slot) =>
        slotIdsToUpdate.has(slot.id)
          ? {
              ...slot,
              plan: nextSlot.plan,
              actual: nextSlot.actual,
              status: nextSlot.status,
            }
          : slot,
      ),
    }));
  }

  function updateReview(review: string) {
    saveToHistory();
    updatePlanForCurrentDate((previous) => ({
      ...previous,
      review,
    }));
  }

  function updateCurrentSlotPlan(plan: string) {
    setPlansByDate((previous) =>
      updateSlotPlanForDate(previous, todayDateKey, currentSlotId, plan),
    );
  }

  function advanceCurrentTaskPlan() {
    saveToHistory();
    setPlansByDate((previous) =>
      applyTaskTimingAdjustment(previous, todayDateKey, currentSlotId, 'advance'),
    );
  }

  function deferCurrentTaskPlan() {
    saveToHistory();
    const targetSlotId = currentSlot?.plan.trim() ? currentSlotId : currentSlotNeighbors.previous?.id ?? currentSlotId;
    setPlansByDate((previous) =>
      applyTaskTimingAdjustment(previous, todayDateKey, targetSlotId, 'defer'),
    );
  }

  function toggleMiniNeighborTasks() {
    setShowMiniNeighborTasks((previous) => !previous);
  }

  function selectSlot(slotId: string, mode: SlotSelectionMode) {
    const hasSlot = dayPlan.slots.some((slot) => slot.id === slotId);

    if (!hasSlot) {
      return;
    }

    if (mode === 'replace') {
      setSelectedSlotId(slotId);
      setSelectedSlotIds([slotId]);
      setSelectionAnchorSlotId(slotId);
      return;
    }

    if (mode === 'range') {
      const anchorSlotId = dayPlan.slots.some((slot) => slot.id === selectionAnchorSlotId)
        ? selectionAnchorSlotId
        : selectedSlotId;
      const rangeSlotIds = getSlotRangeIds(dayPlan.slots, anchorSlotId, slotId);

      setSelectedSlotId(slotId);
      setSelectedSlotIds(rangeSlotIds ?? [slotId]);
      setSelectionAnchorSlotId(anchorSlotId);
      return;
    }

    const isAlreadySelected = selectedSlotIds.includes(slotId);
    const nextSelectedSlotIds =
      isAlreadySelected && selectedSlotIds.length > 1
        ? selectedSlotIds.filter((selectedSlotId) => selectedSlotId !== slotId)
        : getSortedValidSlotIds(dayPlan.slots, [...selectedSlotIds, slotId]);
    const nextFocusedSlotId = nextSelectedSlotIds.includes(slotId)
      ? slotId
      : nextSelectedSlotIds[0];

    setSelectedSlotId(nextFocusedSlotId);
    setSelectedSlotIds(nextSelectedSlotIds);
    setSelectionAnchorSlotId(nextFocusedSlotId);
  }

  function selectDatedSlot(dateKey: string, slotId: string, mode: SlotSelectionMode) {
    if (dateKey === currentDateKey) {
      selectSlot(slotId, mode);
      return;
    }

    const date = createDateFromKey(dateKey);

    if (date === null) {
      return;
    }

    setCurrentDate(date);
    setSelectedSlotId(slotId);
    setSelectedSlotIds([slotId]);
    setSelectionAnchorSlotId(slotId);
    setNightFoldExpansionMode(isNightFoldSlot(slotId) ? 'expanded' : 'auto');
  }

  function focusDatedSlotEditorField(dateKey: string, slotId: string, field: EditableSlotField) {
    selectDatedSlot(dateKey, slotId, 'replace');
    setSlotEditorFocusRequest((previous) => ({
      field,
      requestId: (previous?.requestId ?? 0) + 1,
    }));
  }

  function moveSelectedPlans(dragStartSlotId: string, insertIndex: number) {
    const sourceSlotIds = selectedSlotIds.includes(dragStartSlotId)
      ? selectedSlotIds
      : [dragStartSlotId];
    const moveResult = moveSelectedSlotPlans(
      dayPlan.slots,
      sourceSlotIds,
      insertIndex,
      dayPlan.mergedRanges,
    );

    if (!moveResult.didMove) {
      return;
    }

    saveToHistory();
    updatePlanForCurrentDate((previous) => ({
      ...previous,
      slots: moveResult.slots,
      mergedRanges: moveResult.mergedRanges,
    }));
    setSelectedSlotId(moveResult.movedSlotIds[0]);
    setSelectedSlotIds(moveResult.movedSlotIds);
    setSelectionAnchorSlotId(moveResult.movedSlotIds[0]);
  }

  function foldSlotIntoNight(slotId: string) {
    const nextRange = expandNightFoldRangeForAdjacentSlot(nightFoldRange, slotId);

    if (nextRange === null) {
      return;
    }

    saveToHistory();
    updatePlanForCurrentDate((previous) => ({
      ...previous,
      nightFoldRange: isDefaultNightFoldRange(nextRange) ? undefined : nextRange,
    }));
    setNightFoldExpansionMode('auto');
  }

  function resetNightFoldRange() {
    saveToHistory();
    updatePlanForCurrentDate((previous) => {
      if (previous.nightFoldRange === undefined) {
        return previous;
      }

      return {
        ...previous,
        nightFoldRange: undefined,
      };
    });
    setNightFoldExpansionMode('auto');
  }

  function collapseNightFold() {
    setNightFoldExpansionMode('collapsed');
  }

  function applySelectedSlotMerge() {
    const mergeResult = applyMergedRange(
      dayPlan.slots,
      dayPlan.mergedRanges,
      selectedSlotIds,
      selectedSlotId,
    );

    if (!mergeResult.didMerge) {
      return;
    }

    saveToHistory();
    updatePlanForCurrentDate((previous) => ({
      ...previous,
      slots: mergeResult.slots,
      mergedRanges: mergeResult.mergedRanges,
    }));
    setSelectedSlotIds(mergeResult.mergedSlotIds);
    setSelectionAnchorSlotId(mergeResult.mergedSlotIds[0]);
  }

  async function mergeSelectedSlots() {
    if (!canMergeSelectedSlots) {
      return;
    }

    if (
      hasMergedRangeConflict(
        dayPlan.slots,
        dayPlan.mergedRanges,
        selectedSlotIds,
        selectedSlotId,
      )
    ) {
      const shouldMerge = await requestConfirmation({
        title: '合并前确认',
        message:
          '这些时间格里已有不同内容。合并后会以当前右侧正在编辑的时间格为准，覆盖这一段的计划、实际和状态。',
        details: getMergeConfirmationDetails(dayPlan.slots, selectedSlotIds),
        confirmLabel: '继续合并',
        cancelLabel: '取消',
        tone: 'warning',
      });

      if (!shouldMerge) {
        return;
      }
    }

    applySelectedSlotMerge();
  }

  function splitOneMergedSlot() {
    if (selectedMergedRange === null) {
      return;
    }

    const splitResult = splitOneSlotFromMergedRangeEnd(
      dayPlan.slots,
      dayPlan.mergedRanges,
      selectedSlotId,
    );

    if (!splitResult.didSplit) {
      return;
    }

    saveToHistory();
    updatePlanForCurrentDate((previous) => ({
      ...previous,
      mergedRanges: splitResult.mergedRanges,
    }));

    const nextSelectedSlotId = splitResult.remainingSlotIds[0] ?? selectedSlotId;
    setSelectedSlotId(nextSelectedSlotId);
    setSelectedSlotIds(splitResult.remainingSlotIds);
    setSelectionAnchorSlotId(nextSelectedSlotId);
  }

  function splitAllSelectedMergedRange() {
    if (selectedMergedRange === null) {
      return;
    }

    saveToHistory();
    updatePlanForCurrentDate((previous) => ({
      ...previous,
      mergedRanges: removeMergedRangeForSlot(previous.mergedRanges, selectedSlotId),
    }));
    setSelectedSlotIds([selectedSlotId]);
    setSelectionAnchorSlotId(selectedSlotId);
  }

  function moveDate(offset: number) {
    setNightFoldExpansionMode('auto');
    setCurrentDate((previous) => {
      const next = new Date(previous);
      next.setDate(previous.getDate() + offset);
      return next;
    });
  }

  function goToday() {
    setNightFoldExpansionMode('auto');
    setCurrentDate(new Date());
  }

  function jumpToCurrentSlot() {
    setCurrentDate(new Date());
    setSelectedSlotId(currentSlotId);
    setSelectedSlotIds([currentSlotId]);
    setSelectionAnchorSlotId(currentSlotId);

    if (isNightFoldSlot(currentSlotId)) {
      setNightFoldExpansionMode('expanded');
    }

    scrollSlotListToSecondVisibleRow(todayDateKey, currentVisibleSlotId);
  }

  function scrollSlotListToSecondVisibleRow(dateKey: string, slotId: string) {
    window.requestAnimationFrame(() => {
      const workspaceElement = workspaceRef.current;

      if (workspaceElement === null) {
        return;
      }

      const listElement = workspaceElement.querySelector<HTMLElement>('.slot-list');
      const slotElement = workspaceElement.querySelector<HTMLElement>(
        `[data-date-key="${dateKey}"][data-slot-id="${slotId}"]`,
      );

      if (listElement === null || slotElement === null) {
        return;
      }

      const listRect = listElement.getBoundingClientRect();
      const slotRect = slotElement.getBoundingClientRect();
      const secondVisibleRowOffset = slotRect.height;

      listElement.scrollTop += slotRect.top - listRect.top - secondVisibleRowOffset;
    });
  }

  function getWorkspaceWidth() {
    return workspaceRef.current?.getBoundingClientRect().width ?? 1440;
  }

  function updateSidePanelWidthFromPointer(clientX: number) {
    const workspaceElement = workspaceRef.current;

    if (workspaceElement === null) {
      return;
    }

    const workspaceRect = workspaceElement.getBoundingClientRect();
    const nextWidth = workspaceRect.right - clientX;

    setSidePanelWidth(clampSidePanelWidth(nextWidth, workspaceRect.width));
  }

  function startWorkspaceResize(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsWorkspaceResizing(true);
    updateSidePanelWidthFromPointer(event.clientX);
  }

  function resizeWorkspace(event: PointerEvent<HTMLButtonElement>) {
    if (!isWorkspaceResizing) {
      return;
    }

    event.preventDefault();
    updateSidePanelWidthFromPointer(event.clientX);
  }

  function stopWorkspaceResize(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsWorkspaceResizing(false);
  }

  function nudgeSidePanelWidth(delta: number) {
    setSidePanelWidth((previous) =>
      clampSidePanelWidth(previous + delta, getWorkspaceWidth()),
    );
  }

  function handleWorkspaceDividerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      nudgeSidePanelWidth(WORKSPACE_RESIZE_KEYBOARD_STEP);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      nudgeSidePanelWidth(-WORKSPACE_RESIZE_KEYBOARD_STEP);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setSidePanelWidth(MIN_SIDE_PANEL_WIDTH);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setSidePanelWidth(getMaxSidePanelWidth(getWorkspaceWidth()));
    }
  }

  async function openMiniWindow() {
    if (desktopBridge) {
      await desktopBridge.openMiniWindow();
      return;
    }

    const miniUrl = new URL(window.location.href);
    miniUrl.searchParams.set('view', 'mini');

    window.open(
      miniUrl.toString(),
      'time-manager-current-task',
      `popup=yes,width=${MINI_WINDOW_WIDTH},height=230,left=980,top=80`,
    );
  }

  async function openMainWindow() {
    if (desktopBridge) {
      await desktopBridge.openMainWindow();
      return;
    }

    const mainUrl = new URL(window.location.href);
    mainUrl.searchParams.delete('view');

    const openedWindow = window.open(
      mainUrl.toString(),
      'time-manager-main',
      'popup=yes,width=1180,height=760,left=80,top=60',
    );

    if (openedWindow === null) {
      window.location.href = mainUrl.toString();
    }
  }

  async function toggleMiniAlwaysOnTop() {
    const nextAlwaysOnTop = !isMiniAlwaysOnTop;

    if (!desktopBridge?.setMiniAlwaysOnTop) {
      return;
    }

    const appliedAlwaysOnTop = await desktopBridge.setMiniAlwaysOnTop(nextAlwaysOnTop);
    setIsMiniAlwaysOnTop(appliedAlwaysOnTop);
  }

  async function toggleStickyNoteWindow() {
    if (!desktopBridge?.toggleStickyNoteWindow) {
      return;
    }

    const nextIsStickyNoteOpen = await desktopBridge.toggleStickyNoteWindow(isMiniAlwaysOnTop);
    setIsStickyNoteOpen(nextIsStickyNoteOpen);
  }

  async function minimizeMiniWindow() {
    await desktopBridge?.minimizeMiniWindow();
  }

  async function closeMiniWindow() {
    await desktopBridge?.closeMiniWindow();
  }

  const workspaceStyle = {
    '--side-panel-width': `${sidePanelWidth}px`,
    ...(workspaceContentHeight === null
      ? {}
      : { '--workspace-content-height': `${workspaceContentHeight}px` }),
  } as CSSProperties;
  const canAdvanceCurrentTaskPlan = Boolean(currentSlotNeighbors.next?.plan.trim());
  const canDeferCurrentTaskPlan = Boolean(
    (currentSlotNeighbors.current?.plan.trim() || currentSlotNeighbors.previous?.plan.trim()) && currentSlotNeighbors.next,
  );

  if (isMiniView) {
    const canSetMiniAlwaysOnTop = Boolean(desktopBridge?.setMiniAlwaysOnTop);
    const canToggleStickyNote = Boolean(desktopBridge?.toggleStickyNoteWindow);
    const currentTaskProgressPercent =
      currentSlot === null ? 0 : getTaskProgressPercent(currentSlot, now);

    return (
      <main className="mini-shell" ref={miniShellRef}>
        <div className="mini-titlebar">
          <button
            type="button"
            className="mini-title-button mini-back-button"
            aria-label="打开大窗口"
            title="打开大窗口"
            onClick={openMainWindow}
          >
            <span className="mini-back-icon" aria-hidden="true" />
          </button>
          <div className="mini-title-actions">
            <button
              type="button"
              className={`mini-title-button mini-neighbor-title-button${
                showMiniNeighborTasks ? ' active' : ''
              }`}
              aria-label={showMiniNeighborTasks ? '隐藏前后任务' : '显示前后任务'}
              aria-pressed={showMiniNeighborTasks}
              title={showMiniNeighborTasks ? '隐藏前后任务' : '显示前后任务'}
              onClick={toggleMiniNeighborTasks}
            >
              <svg
                className="mini-neighbor-title-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.3}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M8 5.5h8" opacity="0.48" />
                <path d="M5.5 12h13" />
                <path d="M8 18.5h8" opacity="0.48" />
              </svg>
            </button>
            {canToggleStickyNote ? (
              <button
                type="button"
                className={`mini-title-button mini-sticky-note-button${
                  isStickyNoteOpen ? ' active' : ''
                }`}
                aria-label={isStickyNoteOpen ? '关闭便利贴' : '打开便利贴'}
                aria-pressed={isStickyNoteOpen}
                title={isStickyNoteOpen ? '关闭便利贴' : '打开便利贴'}
                onClick={toggleStickyNoteWindow}
              >
                <img src="/minimal_sticky_note_icon.svg" alt="" aria-hidden="true" />
              </button>
            ) : null}
            {canSetMiniAlwaysOnTop ? (
              <button
                type="button"
                className={`mini-title-button mini-pin-button${isMiniAlwaysOnTop ? ' active' : ''}`}
                aria-label={isMiniAlwaysOnTop ? '取消置顶' : '置顶小窗'}
                aria-pressed={isMiniAlwaysOnTop}
                title={isMiniAlwaysOnTop ? '取消置顶' : '置顶小窗'}
                onClick={toggleMiniAlwaysOnTop}
              >
                <svg
                  className="mini-pin-icon"
                  viewBox="0 0 487 691"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="34"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M 337 41 L 296 27 L 263 21 L 217 23 L 203 27 L 179 41 L 167 55 L 160 70 L 157 84 L 157 100 L 160 115 L 168 135 L 182 157 L 197 175 L 136 283 L 90 294 L 63 308 L 38 330 L 25 351 L 20 368 L 20 380 L 27 394 L 62 423 L 121 460 L 62 654 L 61 666 L 67 671 L 76 669 L 184 491 L 242 513 L 290 525 L 312 524 L 320 520 L 332 508 L 345 478 L 347 445 L 339 410 L 328 385 L 319 372 L 370 255 L 408 252 L 434 242 L 454 225 L 463 209 L 467 193 L 466 169 L 461 152 L 444 122 L 430 105 L 399 77 L 372 59 Z M 95 601 L 97 601 Z M 140 470 L 165 482 L 166 485 L 97 601 L 96 598 L 137 471 Z M 211 188 L 249 215 L 285 234 L 318 246 L 350 254 L 301 367 L 302 379 L 318 407 L 328 443 L 328 467 L 325 481 L 316 498 L 304 507 L 288 506 L 256 498 L 215 484 L 166 463 L 128 443 L 86 417 L 51 391 L 40 380 L 38 375 L 39 367 L 46 351 L 56 338 L 70 326 L 98 311 L 124 304 L 139 303 L 148 298 Z M 182 66 L 194 53 L 208 45 L 226 40 L 258 39 L 296 46 L 327 57 L 352 69 L 374 82 L 401 103 L 421 123 L 435 142 L 444 160 L 449 181 L 448 195 L 443 208 L 434 219 L 419 229 L 404 234 L 382 237 L 346 234 L 322 228 L 274 208 L 226 176 L 202 152 L 189 134 L 180 116 L 175 95 L 176 81 Z"
                  />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              className="mini-title-button mini-minimize-button"
              aria-label="最小化小窗"
              title="最小化小窗"
              onClick={minimizeMiniWindow}
            >
              <span aria-hidden="true" />
            </button>
            <button
              type="button"
              className="mini-title-button mini-close-button"
              aria-label="关闭小窗"
              title="关闭小窗"
              onClick={closeMiniWindow}
            >
              <span aria-hidden="true" />
            </button>
          </div>
        </div>
        <div
          className="mini-task-progress"
          role="progressbar"
          aria-label="当前任务进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(currentTaskProgressPercent)}
        >
          <div
            className="mini-task-progress-fill"
            style={{ width: `${currentTaskProgressPercent}%` }}
          />
        </div>
        <CurrentTaskCard
          slot={currentSlot}
          previousSlot={currentSlotNeighbors.previous}
          nextSlot={currentSlotNeighbors.next}
          showMiniNeighborTasks={showMiniNeighborTasks}
          now={now}
          isViewingToday={true}
          compact
          onPlanChange={updateCurrentSlotPlan}
          canAdvancePlan={canAdvanceCurrentTaskPlan}
          canDeferPlan={canDeferCurrentTaskPlan}
          onAdvancePlan={advanceCurrentTaskPlan}
          onDeferPlan={deferCurrentTaskPlan}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <DayHeader
        date={currentDate}
        isViewingToday={isViewingToday}
        nightFoldAction={
          <button
            type="button"
            className="night-fold-toggle-button"
            onClick={
              isNightFoldExpanded ? collapseNightFold : () => setNightFoldExpansionMode('expanded')
            }
          >
            {isNightFoldExpanded ? '夜间时间收起' : '夜间时间展开'}
          </button>
        }
        updateAction={<AppUpdatePanel onConfirmRequest={requestConfirmation} />}
        onPreviousDay={() => moveDate(-1)}
        onNextDay={() => moveDate(1)}
        onToday={goToday}
      />

      <section
        className={`workspace${isWorkspaceResizing ? ' is-resizing' : ''}`}
        ref={workspaceRef}
        style={workspaceStyle}
      >
        <TimeTable
          dateKey={currentDateKey}
          slots={slots}
          daySlots={dayPlan.slots}
          mergedRanges={dayPlan.mergedRanges}
          tomorrowDateKey={isViewingToday ? nextDateKey : undefined}
          tomorrowSlots={isViewingToday ? nextDayPlan.slots : undefined}
          tomorrowMergedRanges={isViewingToday ? nextDayPlan.mergedRanges : undefined}
          selectedSlotId={selectedSlot.id}
          selectedSlotIds={selectedSlotIds}
          currentSlotId={isViewingToday ? currentSlotId : null}
          isNightFoldExpanded={isNightFoldExpanded}
          nightFoldRange={nightFoldRange}
          onSelectDatedSlot={selectDatedSlot}
          onFocusDatedSlotEditorField={focusDatedSlotEditorField}
          onMoveSelectedPlans={moveSelectedPlans}
          onFoldSlotIntoNight={foldSlotIntoNight}
          onResetNightFoldRange={resetNightFoldRange}
        />

        <button
          type="button"
          className="workspace-divider"
          role="separator"
          aria-label="调整时间表和规划栏宽度"
          aria-orientation="vertical"
          aria-valuemin={MIN_SIDE_PANEL_WIDTH}
          aria-valuemax={MAX_SIDE_PANEL_WIDTH}
          aria-valuenow={Math.round(sidePanelWidth)}
          onPointerDown={startWorkspaceResize}
          onPointerMove={resizeWorkspace}
          onPointerUp={stopWorkspaceResize}
          onPointerCancel={stopWorkspaceResize}
          onLostPointerCapture={() => setIsWorkspaceResizing(false)}
          onKeyDown={handleWorkspaceDividerKeyDown}
        />

        <aside className="side-panel" ref={sidePanelRef}>
          <CurrentTaskCard
            slot={currentSlot}
            now={now}
            isViewingToday={isViewingToday}
            onJumpToCurrent={jumpToCurrentSlot}
            onOpenMiniWindow={openMiniWindow}
            canAdvancePlan={canAdvanceCurrentTaskPlan}
            canDeferPlan={canDeferCurrentTaskPlan}
            onAdvancePlan={advanceCurrentTaskPlan}
            onDeferPlan={deferCurrentTaskPlan}
          />
          <SlotEditor
            slot={selectedEditorSlot}
            focusRequest={slotEditorFocusRequest}
            selectedSlotCount={selectedSlotIds.length}
            canMergeSelectedSlots={canMergeSelectedSlots}
            canSplitMergedRange={selectedMergedRange !== null}
            onMergeSelectedSlots={mergeSelectedSlots}
            onSplitOneMergedSlot={splitOneMergedSlot}
            onSplitAllMergedRange={splitAllSelectedMergedRange}
            onChange={updateSelectedSlot}
          />
          <ReviewPanel value={dayPlan.review} onChange={updateReview} />
        </aside>
      </section>

      {confirmationRequest ? (
        <ConfirmDialog
          request={confirmationRequest}
          onConfirm={() => closeConfirmation(true)}
          onCancel={() => closeConfirmation(false)}
        />
      ) : null}
    </main>
  );
}
