import { statusLabels } from '../lib/status';
import type { TimeSlot } from '../types';

interface CurrentTaskCardProps {
  slot: TimeSlot | null;
  now: Date;
  isViewingToday: boolean;
  compact?: boolean;
  onJumpToCurrent?: () => void;
  onOpenMiniWindow?: () => void;
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
}: CurrentTaskCardProps) {
  const hasPlan = Boolean(slot?.plan.trim());
  const hasActual = Boolean(slot?.actual.trim());

  return (
    <section className={compact ? 'current-task-card compact' : 'current-task-card'}>
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

      {!compact ? (
        <div className="current-task-actions">
          <button type="button" onClick={onJumpToCurrent}>
            跳到当前任务
          </button>
          <button type="button" className="primary-button" onClick={onOpenMiniWindow}>
            打开小窗
          </button>
        </div>
      ) : null}
    </section>
  );
}
