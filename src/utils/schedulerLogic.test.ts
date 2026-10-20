import test from 'node:test';
import assert from 'node:assert/strict';
import {
  timeToMinutes,
  minutesToTime,
  calculateDurationMinutes,
  isTaskActiveAtTime,
  getTasksMatchingExactClockTime,
  sortTasksByClock,
  getEffectiveIntervalMinutes,
  buildNotificationDigestPayload,
  validateTaskInput,
  NOTIFICATION_TONES,
  type ScheduleTask,
  type CadenceConfig,
} from './schedulerLogic.ts';

const sampleConfig: CadenceConfig = {
  enabled: true,
  globalIntervalMinutes: 15,
  ringAtExactStartTime: true,
  includeCompletedInDigest: false,
  soundEnabled: true,
  selectedToneId: 'classic-alarm',
};

const sampleTasks: ScheduleTask[] = [
  {
    id: 't1',
    title: 'Afternoon Team Call',
    description: 'Daily sync',
    startTime: '14:00',
    endTime: '14:30',
    completed: false,
    notifyOnInterval: true,
  },
  {
    id: 't2',
    title: 'Morning Workout',
    description: 'Cardio session',
    startTime: '08:00',
    endTime: '08:45',
    completed: false,
    notifyOnInterval: true,
  },
  {
    id: 't3',
    title: 'Submit Project Slides',
    description: 'Send deck before lunch',
    startTime: '09:30',
    endTime: '11:00',
    completed: false,
    notifyOnInterval: true,
    toneId: 'zen-bowl',
  },
];

test('timeToMinutes and minutesToTime convert accurately', () => {
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('09:30'), 570);
  assert.equal(timeToMinutes('14:45'), 885);
  assert.equal(minutesToTime(570), '09:30');
  assert.equal(calculateDurationMinutes('09:15', '10:45'), 90);
});

test('sortTasksByClock orders tasks strictly by clock startTime', () => {
  const sorted = sortTasksByClock(sampleTasks, 'all');
  assert.deepEqual(
    sorted.map((t) => t.id),
    ['t2', 't3', 't1']
  );
});

test('isTaskActiveAtTime and getTasksMatchingExactClockTime match clock schedule', () => {
  assert.equal(isTaskActiveAtTime(sampleTasks[2], '10:00'), true);
  assert.equal(isTaskActiveAtTime(sampleTasks[2], '12:00'), false);

  const exactMatches = getTasksMatchingExactClockTime(sampleTasks, '09:30');
  assert.equal(exactMatches.length, 1);
  assert.equal(exactMatches[0].id, 't3');
});

test('getEffectiveIntervalMinutes uses global interval or custom alarm interval', () => {
  assert.equal(getEffectiveIntervalMinutes(sampleTasks[0], sampleConfig), 15);
  const customTask: ScheduleTask = { ...sampleTasks[0], customIntervalMinutes: 5 };
  assert.equal(getEffectiveIntervalMinutes(customTask, sampleConfig), 5);
});

test('buildNotificationDigestPayload highlights active or next upcoming clock task', () => {
  const digest = buildNotificationDigestPayload(sampleTasks, sampleConfig, '09:45:00', 'interval');
  assert.equal(digest.taskCount, 3);
  assert.ok(digest.title.includes('09:30 — Submit Project Slides'));
  assert.equal(digest.toneId, 'zen-bowl');
});

test('validateTaskInput catches empty titles and invalid time ranges', () => {
  const invalidTitle = validateTaskInput({
    title: ' ',
    startTime: '09:00',
    endTime: '10:00',
  });
  assert.equal(invalidTitle.valid, false);
  assert.ok(invalidTitle.errors.title);

  const invalidRange = validateTaskInput({
    title: 'Valid Task',
    startTime: '14:00',
    endTime: '13:00',
  });
  assert.equal(invalidRange.valid, false);
  assert.ok(invalidRange.errors.endTime);

  const valid = validateTaskInput({
    title: 'Evening Walk',
    startTime: '18:00',
    endTime: '18:45',
    customIntervalMinutes: 10,
  });
  assert.equal(valid.valid, true);
});

test('NOTIFICATION_TONES contains 6 distinct alarm tones', () => {
  assert.equal(NOTIFICATION_TONES.length, 6);
});
