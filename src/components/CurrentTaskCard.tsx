import { statusLabels } from '../lib/status';
import type { TimeSlot } from '../types';

interface CurrentTaskCardProps {
  slot: TimeSlot | null;
  now: Date;
  isViewingToday: boolean;
  compact?: boolean;
  onJumpToCurrent?: () => void;
  onOpenMiniWindow?: () => void;
  onPlanChange?: (plan: string) => void;
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
});

export function CurrentTaskCard({
  slot,
  now,
  isViewingToday,
  compact = false,
  onJumpToCurrent,
  onOpenMiniWindow,
  onPlanChange,
}: CurrentTaskCardProps) {
  const hasPlan = Boolean(slot?.plan.trim());
  const hasActual = Boolean(slot?.actual.trim());

  if (compact) {
    return (
      <section className="current-task-card compact">
        {slot && isViewingToday ? (
          <>
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
                rows={4}
              />
            </div>
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

      <div className="current-task-actions">
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
