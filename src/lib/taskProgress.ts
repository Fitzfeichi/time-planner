interface TaskProgressRange {
  start: string;
  end: string;
}

function parseTimeToMinutes(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);

  if (match === null) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours === 24 && minutes === 0) {
    return 24 * 60;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function clampProgress(progress: number) {
  return Math.min(100, Math.max(0, progress));
}

export function getTaskProgressPercent(range: TaskProgressRange, now: Date) {
  const startMinutes = parseTimeToMinutes(range.start);
  const endMinutes = parseTimeToMinutes(range.end);

  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return 0;
  }

  const nowMinutes =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;
  const progress = ((nowMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;

  return clampProgress(progress);
}
