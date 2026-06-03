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
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
});

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
}: CurrentTaskCardProps) {
  const hasPlan = Boolean(slot?.plan.trim());
  const hasActual = Boolean(slot?.actual.trim());

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
                <span className={`status-pill status-inline status-${slot.status}`}>
                  {statusLabels[slot.status]}
                </span>
              </div>

              <div className="current-task-body mini-task-body">
                <span className="current-task-time">
                  {slot.start} - {slot.end}
                </span>
                <textarea
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
