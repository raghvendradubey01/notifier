export type NotificationToneId =
  | 'classic-alarm'
  | 'morning-chime'
  | 'marimba-pulse'
  | 'radar-beacon'
  | 'zen-bowl'
  | 'urgent-buzzer';

export interface NotificationToneMeta {
  id: NotificationToneId;
  name: string;
  description: string;
  durationLabel: string;
}

export const NOTIFICATION_TONES: NotificationToneMeta[] = [
  {
    id: 'classic-alarm',
    name: 'Classic Digital Alarm',
    description: 'Crisp four-pulse bedside clock beep pattern',
    durationLabel: '2.0s',
  },
  {
    id: 'morning-chime',
    name: 'Morning Crystal Chime',
    description: 'Bright ascending five-note harmonic arpeggio',
    durationLabel: '1.8s',
  },
  {
    id: 'marimba-pulse',
    name: 'Warm Marimba',
    description: 'Percussive wooden melodic sequence',
    durationLabel: '1.6s',
  },
  {
    id: 'radar-beacon',
    name: 'Radar Beacon',
    description: 'Modern smartphone dual-tone wake sweep',
    durationLabel: '1.9s',
  },
  {
    id: 'zen-bowl',
    name: 'Tibetan Zen Bowl',
    description: 'Deep resonant harmonic singing bowl chime',
    durationLabel: '2.5s',
  },
  {
    id: 'urgent-buzzer',
    name: 'Twin Bell Ringer',
    description: 'Energetic alternating desk clock bell ring',
    durationLabel: '1.8s',
  },
];

export interface ScheduleTask {
  id: string;
  title: string;
  description: string;
  startTime: string; // HH:mm in 24-hour format, e.g. "09:30"
  endTime: string;   // HH:mm in 24-hour format, e.g. "10:30"
  completed: boolean;
  notifyOnInterval: boolean;
  customIntervalMinutes?: number | null; // Optional per-alarm interval override
  toneId?: NotificationToneId | null;    // Optional per-alarm tone override
  lastNotifiedAt?: string | null;        // HH:mm when last rung
}

export interface CadenceConfig {
  enabled: boolean;
  globalIntervalMinutes: number; // e.g., 1, 5, 15, 30, 45, 60
  ringAtExactStartTime: boolean; // Automatically ring when clock hits a task's startTime
  includeCompletedInDigest: boolean;
  soundEnabled: boolean;
  selectedToneId: NotificationToneId;
}

export interface NotificationDigestPayload {
  id: string;
  title: string;
  body: string;
  dispatchedAt: string; // HH:mm:ss
  intervalMinutes: number;
  triggerType: 'interval' | 'clock-match' | 'manual-digest' | 'single-alarm';
  toneId: NotificationToneId;
  taskCount: number;
  featuredTasks: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
  }>;
}

/**
 * Converts "HH:mm" time string into minutes since midnight (0 - 1439).
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr.trim())) {
    return 0;
  }
  const [hoursStr, minutesStr] = timeStr.trim().split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return Math.max(0, Math.min(23 * 60 + 59, hours * 60 + minutes));
}

/**
 * Formats minutes since midnight into "HH:mm".
 */
export function minutesToTime(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Calculates duration in minutes between startTime and endTime.
 */
export function calculateDurationMinutes(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end >= start) {
    return end - start;
  }
  return 1440 - start + end;
}

/**
 * Checks whether a task is currently active at currentTimeStr ("HH:mm").
 */
export function isTaskActiveAtTime(task: ScheduleTask, currentTimeStr: string): boolean {
  if (task.completed) return false;
  const now = timeToMinutes(currentTimeStr);
  const start = timeToMinutes(task.startTime);
  const end = timeToMinutes(task.endTime);
  if (end >= start) {
    return now >= start && now <= end;
  }
  return now >= start || now <= end;
}

/**
 * Finds tasks whose exact startTime matches currentTimeStr ("HH:mm") and haven't rung at this minute yet.
 */
export function getTasksMatchingExactClockTime(
  tasks: ScheduleTask[],
  currentTimeStr: string
): ScheduleTask[] {
  return tasks.filter(
    (task) =>
      !task.completed &&
      task.notifyOnInterval &&
      task.startTime === currentTimeStr &&
      task.lastNotifiedAt !== currentTimeStr
  );
}

/**
 * Sorts tasks strictly by clock schedule order (chronological by startTime, with active/upcoming first if desired).
 */
export function sortTasksByClock(
  tasks: ScheduleTask[],
  filterMode: 'all' | 'upcoming' | 'completed' = 'all'
): ScheduleTask[] {
  const filtered = tasks.filter((t) => {
    if (filterMode === 'upcoming') return !t.completed;
    if (filterMode === 'completed') return t.completed;
    return true;
  });

  return [...filtered].sort((a, b) => {
    const timeDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (timeDiff !== 0) return timeDiff;
    return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
  });
}

/**
 * Computes effective push interval in minutes for a given task and global CadenceConfig.
 */
export function getEffectiveIntervalMinutes(
  task: ScheduleTask,
  config: CadenceConfig
): number {
  if (task.customIntervalMinutes && task.customIntervalMinutes >= 1) {
    return task.customIntervalMinutes;
  }
  return Math.max(1, config.globalIntervalMinutes);
}

/**
 * Filters tasks that should be included in the next scheduled push notification digest,
 * ordered chronologically by clock time (with currently active or next upcoming task first).
 */
export function getTasksForPushDigest(
  tasks: ScheduleTask[],
  config: CadenceConfig,
  currentTimeStr: string = '09:00'
): ScheduleTask[] {
  const eligible = tasks.filter((task) => {
    if (!task.notifyOnInterval) return false;
    if (!config.includeCompletedInDigest && task.completed) return false;
    return true;
  });

  const nowMins = timeToMinutes(currentTimeStr);

  // Order so currently active or upcoming tasks relative to currentTimeStr appear first,
  // followed by earlier uncompleted tasks today.
  return [...eligible].sort((a, b) => {
    const aActive = isTaskActiveAtTime(a, currentTimeStr);
    const bActive = isTaskActiveAtTime(b, currentTimeStr);
    if (aActive !== bActive) return aActive ? -1 : 1;

    const aStart = timeToMinutes(a.startTime);
    const bStart = timeToMinutes(b.startTime);
    const aUpcoming = aStart >= nowMins;
    const bUpcoming = bStart >= nowMins;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;

    return aStart - bStart;
  });
}

/**
 * Builds the human-readable push notification payload for the user's clock schedule digest.
 */
export function buildNotificationDigestPayload(
  tasks: ScheduleTask[],
  config: CadenceConfig,
  currentTimeStr: string,
  triggerType: NotificationDigestPayload['triggerType'] = 'interval'
): NotificationDigestPayload {
  const shortTime = currentTimeStr.slice(0, 5);
  const matchingTasks = getTasksForPushDigest(tasks, config, shortTime);

  const featured = matchingTasks.slice(0, 3).map((t) => ({
    id: t.id,
    title: t.title,
    startTime: t.startTime,
    endTime: t.endTime,
  }));

  let title = `Clock Schedule Reminder · Every ${config.globalIntervalMinutes}m`;
  let body = 'No active alarms turned on for your schedule.';
  let toneId: NotificationToneId = config.selectedToneId;

  if (matchingTasks.length > 0) {
    const lead = matchingTasks[0];
    if (lead.toneId) {
      toneId = lead.toneId;
    }
    title = `⏰ ${lead.startTime} — ${lead.title}`;

    const summaryLines = featured.map(
      (item) => `${item.startTime}–${item.endTime} ${item.title}`
    );
    const remaining = matchingTasks.length - featured.length;
    body =
      remaining > 0
        ? `${summaryLines.join(' · ')} (+${remaining} more on schedule)`
        : summaryLines.join(' · ');
  }

  return {
    id: `push-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    body,
    dispatchedAt: currentTimeStr,
    intervalMinutes: config.globalIntervalMinutes,
    triggerType,
    toneId,
    taskCount: matchingTasks.length,
    featuredTasks: featured,
  };
}

export interface TaskValidationResult {
  valid: boolean;
  errors: {
    title?: string;
    startTime?: string;
    endTime?: string;
    customIntervalMinutes?: string;
  };
}

/**
 * Validates new or edited clock alarm input before saving.
 */
export function validateTaskInput(input: {
  title: string;
  startTime: string;
  endTime: string;
  customIntervalMinutes?: number | null;
}): TaskValidationResult {
  const errors: TaskValidationResult['errors'] = {};

  if (!input.title || input.title.trim().length < 2) {
    errors.title = 'Please enter a task name (at least 2 characters).';
  }

  if (!input.startTime || !/^\d{2}:\d{2}$/.test(input.startTime.trim())) {
    errors.startTime = 'Enter a valid start time (HH:mm).';
  }

  if (!input.endTime || !/^\d{2}:\d{2}$/.test(input.endTime.trim())) {
    errors.endTime = 'Enter a valid end time (HH:mm).';
  }

  if (
    !errors.startTime &&
    !errors.endTime &&
    timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)
  ) {
    errors.endTime = 'End time must be after start time.';
  }

  if (
    input.customIntervalMinutes !== undefined &&
    input.customIntervalMinutes !== null &&
    (Number.isNaN(Number(input.customIntervalMinutes)) ||
      Number(input.customIntervalMinutes) < 1 ||
      Number(input.customIntervalMinutes) > 480)
  ) {
    errors.customIntervalMinutes = 'Custom interval must be between 1 and 480 minutes.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
