import React, { useState, useEffect } from 'react';
import { Bell, Clock, Volume2, X } from 'lucide-react';
import {
  NOTIFICATION_TONES,
  minutesToTime,
  timeToMinutes,
  validateTaskInput,
  type NotificationToneId,
  type ScheduleTask,
} from '../utils/schedulerLogic';
import { playNotificationTone } from '../utils/pushService';

interface TaskFormModalProps {
  isOpen: boolean;
  initialTask?: ScheduleTask | null;
  defaultToneId: NotificationToneId;
  onClose: () => void;
  onSave: (taskData: Omit<ScheduleTask, 'id'>, existingId?: string) => void;
}

const QUICK_CUSTOM_INTERVALS: Array<{ label: string; value: string }> = [
  { label: 'Main Timer', value: '' },
  { label: 'Every 5m', value: '5' },
  { label: 'Every 15m', value: '15' },
  { label: 'Every 30m', value: '30' },
];

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  initialTask,
  defaultToneId,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [notifyOnInterval, setNotifyOnInterval] = useState(true);
  const [customIntervalStr, setCustomIntervalStr] = useState('');
  const [selectedTone, setSelectedTone] = useState<NotificationToneId>(defaultToneId);
  const [errors, setErrors] = useState<{
    title?: string;
    startTime?: string;
    endTime?: string;
    customIntervalMinutes?: string;
  }>({});

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description);
      setStartTime(initialTask.startTime);
      setEndTime(initialTask.endTime);
      setNotifyOnInterval(initialTask.notifyOnInterval);
      setCustomIntervalStr(
        initialTask.customIntervalMinutes ? String(initialTask.customIntervalMinutes) : ''
      );
      setSelectedTone(initialTask.toneId || defaultToneId);
    } else {
      const now = new Date();
      const nextMin = now.getHours() * 60 + now.getMinutes() + 1;
      const defaultStart = minutesToTime(nextMin);
      const defaultEnd = minutesToTime(Math.min(23 * 60 + 59, nextMin + 30));

      setTitle('');
      setDescription('');
      setStartTime(defaultStart);
      setEndTime(defaultEnd);
      setNotifyOnInterval(true);
      setCustomIntervalStr('');
      setSelectedTone(defaultToneId);
    }
    setErrors({});
  }, [initialTask, isOpen, defaultToneId]);

  if (!isOpen) return null;

  const handleSetOneMinuteFromNow = () => {
    const now = new Date();
    const startMins = now.getHours() * 60 + now.getMinutes() + 1;
    const endMins = Math.min(23 * 60 + 59, startMins + 30);
    setStartTime(minutesToTime(startMins));
    setEndTime(minutesToTime(endMins));
    setErrors((prev) => ({ ...prev, startTime: undefined, endTime: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCustom =
      customIntervalStr.trim() === '' ? null : Number(customIntervalStr.trim());

    // Automatically adjust endTime if user moved startTime past endTime
    let finalEndTime = endTime;
    if (timeToMinutes(finalEndTime) <= timeToMinutes(startTime)) {
      finalEndTime = minutesToTime(Math.min(23 * 60 + 59, timeToMinutes(startTime) + 30));
    }

    const validation = validateTaskInput({
      title,
      startTime,
      endTime: finalEndTime,
      customIntervalMinutes: parsedCustom,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    onSave(
      {
        title: title.trim(),
        description: description.trim(),
        startTime,
        endTime: finalEndTime,
        completed: initialTask ? initialTask.completed : false,
        notifyOnInterval,
        customIntervalMinutes: parsedCustom,
        toneId: selectedTone,
        lastNotifiedAt: initialTask?.lastNotifiedAt ?? null,
      },
      initialTask?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 sm:hidden" />

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-900" />
            <h2 id="task-modal-title" className="text-base font-bold text-slate-900">
              {initialTask?.id ? 'Edit Clock Alarm' : 'New Clock Alarm'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5 overflow-y-auto">
          {/* Phone Clock Time Picker */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                Alarm Clock Time (24h)
              </span>
              <button
                type="button"
                onClick={handleSetOneMinuteFromNow}
                className="text-xs font-semibold text-slate-900 underline hover:text-slate-700 whitespace-nowrap shrink-0"
              >
                Set for +1 min from now
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="task-start-time"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Ring / Start Time
                </label>
                <input
                  id="task-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setStartTime(nextStart);
                    if (timeToMinutes(endTime) <= timeToMinutes(nextStart)) {
                      setEndTime(
                        minutesToTime(Math.min(23 * 60 + 59, timeToMinutes(nextStart) + 30))
                      );
                    }
                    if (errors.startTime || errors.endTime) {
                      setErrors({ ...errors, startTime: undefined, endTime: undefined });
                    }
                  }}
                  className="w-full px-3 py-2.5 text-xl font-mono font-bold tabular-nums bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                {errors.startTime && (
                  <p role="alert" className="mt-1 text-xs text-red-600 font-medium">
                    {errors.startTime}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="task-end-time"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  End Time
                </label>
                <input
                  id="task-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    if (errors.endTime) setErrors({ ...errors, endTime: undefined });
                  }}
                  className="w-full px-3 py-2.5 text-xl font-mono font-bold tabular-nums bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                {errors.endTime && (
                  <p role="alert" className="mt-1 text-xs text-red-600 font-medium">
                    {errors.endTime}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Task Name */}
          <div>
            <label
              htmlFor="task-title-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Alarm Label / Task Name
            </label>
            <input
              id="task-title-input"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors({ ...errors, title: undefined });
              }}
              placeholder="e.g., Morning Workout, Submit Report, Take Medicine"
              className="w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {errors.title && (
              <p role="alert" className="mt-1.5 text-xs text-red-600 font-medium">
                {errors.title}
              </p>
            )}
          </div>

          {/* Notification Tone Selector + Preview Button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="task-tone-select"
                className="text-xs font-semibold text-slate-700"
              >
                Alarm Notification Tone
              </label>
              <button
                type="button"
                onClick={() => playNotificationTone(selectedTone)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:text-slate-700 underline whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Preview Tone
              </button>
            </div>
            <select
              id="task-tone-select"
              value={selectedTone}
              onChange={(e) => {
                const nextTone = e.target.value as NotificationToneId;
                setSelectedTone(nextTone);
                playNotificationTone(nextTone);
              }}
              className="min-h-[44px] w-full px-3.5 py-2.5 text-sm font-medium bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {NOTIFICATION_TONES.map((tone) => (
                <option key={tone.id} value={tone.id}>
                  {tone.name} — {tone.description}
                </option>
              ))}
            </select>
          </div>

          {/* Optional Note */}
          <div>
            <label
              htmlFor="task-notes-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Short Note (Optional)
            </label>
            <input
              id="task-notes-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown inside the notification popup..."
              className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Repeat Interval */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-semibold text-slate-800">
                  Alarm Switch
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifyOnInterval}
                aria-label="Include this task in scheduled push notifications"
                onClick={() => setNotifyOnInterval(!notifyOnInterval)}
                className={`min-h-[36px] px-3.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                  notifyOnInterval
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {notifyOnInterval ? 'Alarm ON' : 'Alarm OFF'}
              </button>
            </div>

            {notifyOnInterval && (
              <div>
                <div className="text-xs text-slate-500 mb-1.5">
                  Repeat Interval for This Alarm
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {QUICK_CUSTOM_INTERVALS.map((opt) => {
                    const active = customIntervalStr === opt.value;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setCustomIntervalStr(opt.value)}
                        className={`py-2 px-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              {initialTask?.id ? 'Save Alarm' : 'Add to Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
