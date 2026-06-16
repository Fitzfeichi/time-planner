import { useLayoutEffect, useRef } from 'react';
import { statusLabels } from '../lib/status';
import type { TimeSlot } from '../types';

interface CurrentTaskCardProps {
  slot: TimeSlot | null;
  previousSlot?: TimeSlot | null;
  nextSlot?: TimeSlot | null;
  now: Date;
  isViewingToday: boolean;
  compact?: boolean;
  showMiniNeighborTasks?: boolean;
  onJumpToCurrent?: () => void;
  onOpenMiniWindow?: () => void;
  onPlanChange?: (plan: string) => void;
  onToggleMiniNeighborTasks?: () => void;
  canAdvancePlan?: boolean;
  canDeferPlan?: boolean;
  onAdvancePlan?: () => void;
  onDeferPlan?: () => void;
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
});
const MINI_PLAN_INPUT_MAX_HEIGHT = 360;

interface MiniTaskPreviewProps {
  label: string;
  slot: TimeSlot | null | undefined;
  emptyText: string;
}

function MiniTaskPreview({ label, slot, emptyText }: MiniTaskPreviewProps) {
  const planText = slot?.plan.trim() || '未填写计划';

  return (
    <div className="mini-neighbor-task">
      <div className="mini-neighbor-meta">
        <span className="mini-neighbor-label">{label}</span>
        {slot ? (
          <>
            <span className="mini-neighbor-time">
              {slot.start} - {slot.end}
            </span>
            <span className={`status-pill status-inline status-${slot.status}`}>
              {statusLabels[slot.status]}
            </span>
          </>
        ) : null}
      </div>
      <p className={slot?.plan.trim() ? 'mini-neighbor-summary' : 'mini-neighbor-summary muted'}>
        {slot ? planText : emptyText}
      </p>
    </div>
  );
}

export function CurrentTaskCard({
  slot,
  previousSlot,
  nextSlot,
  now,
  isViewingToday,
  compact = false,
  showMiniNeighborTasks = false,
  onJumpToCurrent,
  onOpenMiniWindow,
  onPlanChange,
  onToggleMiniNeighborTasks,
  canAdvancePlan = false,
  canDeferPlan = false,
  onAdvancePlan,
  onDeferPlan,
}: CurrentTaskCardProps) {
  const miniPlanInputRef = useRef<HTMLTextAreaElement | null>(null);
  const hasPlan = Boolean(slot?.plan.trim());
  const hasActual = Boolean(slot?.actual.trim());
  const showTimingActions = Boolean(onAdvancePlan || onDeferPlan);

  function renderTimingButtons() {
    return (
      <>
        <button
          type="button"
          disabled={!canAdvancePlan}
          title="把下一段计划追加到当前段，并清空下一段计划"
          aria-label="提前：把下一段计划追加到当前段，并清空下一段计划"
          onClick={onAdvancePlan}
        >
          提前
        </button>
        <button
          type="button"
          disabled={!canDeferPlan}
          title="把当前段计划追加到下一段，当前段计划保留"
          aria-label="顺延：把当前段计划追加到下一段，当前段计划保留"
          onClick={onDeferPlan}
        >
          顺延
        </button>
      </>
    );
  }

  const timingActions = showTimingActions ? (
    <div className="current-task-timing-actions" aria-label="调整当前任务计划">
      {renderTimingButtons()}
    </div>
  ) : null;

  useLayoutEffect(() => {
    if (!compact || miniPlanInputRef.current === null) {
      return;
    }

    const planInput = miniPlanInputRef.current;
    planInput.style.height = '0px';
    const nextHeight = Math.min(planInput.scrollHeight, MINI_PLAN_INPUT_MAX_HEIGHT);
    planInput.style.height = `${nextHeight}px`;
    planInput.style.overflowY =
      planInput.scrollHeight > MINI_PLAN_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [compact, showMiniNeighborTasks, slot?.plan]);

  if (compact) {
    return (
      <section
        className={`current-task-card compact${showMiniNeighborTasks ? ' with-neighbors' : ''}`}
      >
        {slot && isViewingToday ? (
          <>
            {showMiniNeighborTasks ? (
              <MiniTaskPreview label="上一段" slot={previousSlot} emptyText="已经是当天第一段" />
            ) : null}

            <div className="mini-current-task">
              <div className="mini-task-head">
                <strong>{timeFormatter.format(now)}</strong>
                <div className="mini-task-side">
                  <span className={`status-pill status-inline status-${slot.status}`}>
                    {statusLabels[slot.status]}
                  </span>
                </div>
              </div>

              <div className="mini-task-timing-row" aria-label="当前任务时间和调整按钮">
                <span className="current-task-time">
                  {slot.start} - {slot.end}
                </span>
                {showTimingActions ? renderTimingButtons() : null}
              </div>

              <div className="current-task-body mini-task-body">
                <textarea
                  ref={miniPlanInputRef}
                  className="mini-task-plan-input"
                  value={slot.plan}
                  onChange={(event) => onPlanChange?.(event.target.value)}
                  placeholder="这个时间格还没有填写计划"
                  aria-label="当前任务计划内容"
                  rows={showMiniNeighborTasks ? 3 : 4}
                />
              </div>
            </div>

            {showMiniNeighborTasks ? (
              <MiniTaskPreview label="下一段" slot={nextSlot} emptyText="已经是当天最后一段" />
            ) : null}
          </>
        ) : (
          <p className="current-task-empty">请回到今天后查看当前任务。</p>
        )}
      </section>
    );
  }

  return (
    <section className="current-task-card">
      <div className="current-task-head">
        <div>
          <p>当前任务</p>
          <strong>{timeFormatter.format(now)}</strong>
        </div>
        {slot && isViewingToday ? (
          <span className={`status-pill status-inline status-${slot.status}`}>
            {statusLabels[slot.status]}
          </span>
        ) : null}
      </div>

      {slot && isViewingToday ? (
        <div className="current-task-body">
          <span className="current-task-time">
            {slot.start} - {slot.end}
          </span>
          <p className={hasPlan ? 'current-task-text' : 'current-task-text muted'}>
            {hasPlan ? slot.plan : '这个时间格还没有填写计划'}
          </p>
          {hasActual ? <p className="current-task-actual">实际：{slot.actual}</p> : null}
          {timingActions}
        </div>
      ) : (
        <p className="current-task-empty">当前任务只跟随今天显示。请回到今天后再查看当前半小时任务。</p>
      )}

      <div className="current-task-actions with-toggle">
        <button
          type="button"
          className="mini-neighbor-toggle"
          aria-pressed={showMiniNeighborTasks}
          onClick={onToggleMiniNeighborTasks}
        >
          {showMiniNeighborTasks ? '隐藏前后任务' : '显示前后任务'}
        </button>
        <button type="button" onClick={onJumpToCurrent}>
          跳到当前任务
        </button>
        <button type="button" className="primary-button" onClick={onOpenMiniWindow}>
          打开小窗
        </button>
      </div>
    </section>
  );
}
