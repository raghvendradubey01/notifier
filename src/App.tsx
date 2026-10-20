/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  Edit3,
  History,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sliders,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  NOTIFICATION_TONES,
  buildNotificationDigestPayload,
  getEffectiveIntervalMinutes,
  getTasksMatchingExactClockTime,
  isTaskActiveAtTime,
  sortTasksByClock,
  type CadenceConfig,
  type NotificationDigestPayload,
  type NotificationToneId,
  type ScheduleTask,
} from './utils/schedulerLogic';
import {
  INITIAL_CADENCE_CONFIG,
  INITIAL_DISPATCH_LOGS,
  INITIAL_SCHEDULE_TASKS,
} from './utils/seedData';
import {
  getBrowserNotificationPermission,
  playNotificationTone,
  requestBrowserNotificationPermission,
  sendBrowserPushNotification,
  type BrowserPermissionState,
} from './utils/pushService';
import { PushToastBanner } from './components/PushToastBanner';
import { TaskFormModal } from './components/TaskFormModal';
import { CadenceSettingsPanel } from './components/CadenceSettingsPanel';
import { DispatchLogView } from './components/DispatchLogView';

type ActiveTab = 'alarms' | 'timer' | 'history';
type ClockFilterMode = 'all' | 'upcoming' | 'completed';

const STORAGE_KEYS = {
  TASKS: 'cadence_clock_tasks_v3',
  CONFIG: 'cadence_clock_config_v3',
  LOGS: 'cadence_clock_logs_v3',
};

export default function App() {
  const [tasks, setTasks] = useState<ScheduleTask[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to seed data
    }
    return INITIAL_SCHEDULE_TASKS;
  });

  const [config, setConfig] = useState<CadenceConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (saved) {
        return { ...INITIAL_CADENCE_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return INITIAL_CADENCE_CONFIG;
  });

  const [dispatchLogs, setDispatchLogs] = useState<NotificationDigestPayload[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback
    }
    return INITIAL_DISPATCH_LOGS;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('alarms');
  const [clockFilter, setClockFilter] = useState<ClockFilterMode>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduleTask | null>(null);
  const [liveNotification, setLiveNotification] =
    useState<NotificationDigestPayload | null>(null);
  const [browserPermission, setBrowserPermission] = useState<BrowserPermissionState>(() =>
    getBrowserNotificationPermission()
  );

  const formatNow = useCallback(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return { hhmm: `${hh}:${mm}`, hhmmss: `${hh}:${mm}:${ss}` };
  }, []);

  const [currentTimeStr, setCurrentTimeStr] = useState<string>(() => formatNow().hhmm);
  const [currentSecondsStr, setCurrentSecondsStr] = useState<string>(
    () => formatNow().hhmmss.slice(6, 8)
  );
  const [secondsUntilNextPush, setSecondsUntilNextPush] = useState<number>(
    config.globalIntervalMinutes * 60
  );

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch {
      // Ignore
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    } catch {
      // Ignore
    }
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(dispatchLogs));
    } catch {
      // Ignore
    }
  }, [dispatchLogs]);

  // Trigger a full schedule digest push notification
  const triggerScheduleDigest = useCallback(
    (triggerType: NotificationDigestPayload['triggerType'] = 'manual-digest') => {
      const { hhmmss } = formatNow();
      const payload = buildNotificationDigestPayload(
        tasks,
        config,
        hhmmss,
        triggerType
      );

      setLiveNotification(payload);
      setDispatchLogs((prev) => [payload, ...prev.slice(0, 49)]);

      const featuredIds = new Set(payload.featuredTasks.map((f) => f.id));
      const shortTime = hhmmss.slice(0, 5);
      setTasks((prev) =>
        prev.map((t) =>
          featuredIds.has(t.id) ? { ...t, lastNotifiedAt: shortTime } : t
        )
      );

      if (config.soundEnabled) {
        playNotificationTone(payload.toneId);
      }
      sendBrowserPushNotification(payload);
      setSecondsUntilNextPush(config.globalIntervalMinutes * 60);
    },
    [tasks, config, formatNow]
  );

  // Trigger a single clock alarm push notification
  const triggerSingleTaskPush = useCallback(
    (
      task: ScheduleTask,
      triggerType: NotificationDigestPayload['triggerType'] = 'single-alarm'
    ) => {
      const { hhmmss } = formatNow();
      const effectiveMins = getEffectiveIntervalMinutes(task, config);
      const toneToPlay = task.toneId || config.selectedToneId;

      const payload: NotificationDigestPayload = {
        id: `push-single-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `⏰ ${task.startTime} — ${task.title}`,
        body:
          task.description ||
          `Clock alarm scheduled ${task.startTime}–${task.endTime} (Repeat every ${effectiveMins}m).`,
        dispatchedAt: hhmmss,
        intervalMinutes: effectiveMins,
        triggerType,
        toneId: toneToPlay,
        taskCount: 1,
        featuredTasks: [
          {
            id: task.id,
            title: task.title,
            startTime: task.startTime,
            endTime: task.endTime,
          },
        ],
      };

      setLiveNotification(payload);
      setDispatchLogs((prev) => [payload, ...prev.slice(0, 49)]);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, lastNotifiedAt: hhmmss.slice(0, 5) } : t
        )
      );

      if (config.soundEnabled) {
        playNotificationTone(toneToPlay);
      }
      sendBrowserPushNotification(payload);
    },
    [config, formatNow]
  );

  // Keep latest references in refs so our 1-second clock loop never resets when tasks/logs change
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const configRef = useRef(config);
  configRef.current = config;

  const triggerDigestRef = useRef(triggerScheduleDigest);
  triggerDigestRef.current = triggerScheduleDigest;

  const triggerSingleRef = useRef(triggerSingleTaskPush);
  triggerSingleRef.current = triggerSingleTaskPush;

  // Stable 1-second master clock & countdown interval
  useEffect(() => {
    const timer = window.setInterval(() => {
      const { hhmm, hhmmss } = formatNow();
      setCurrentTimeStr(hhmm);
      setCurrentSecondsStr(hhmmss.slice(6, 8));

      const currentCfg = configRef.current;
      if (!currentCfg.enabled) return;

      // 1. Check if any task's exact startTime matches current HH:mm
      if (currentCfg.ringAtExactStartTime) {
        const dueClockAlarms = getTasksMatchingExactClockTime(
          tasksRef.current,
          hhmm
        );
        if (dueClockAlarms.length > 0) {
          triggerSingleRef.current(dueClockAlarms[0], 'clock-match');
        }
      }

      // 2. Tick down interval reminder countdown
      setSecondsUntilNextPush((prev) => {
        if (prev <= 1) {
          triggerDigestRef.current('interval');
          return Math.max(1, currentCfg.globalIntervalMinutes) * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [formatNow]);

  const handleToggleComplete = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleToggleAlarmSwitch = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, notifyOnInterval: !t.notifyOnInterval } : t
      )
    );
  };

  const handleSetTaskTone = (taskId: string, toneId: NotificationToneId) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, toneId } : t))
    );
    playNotificationTone(toneId);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleSaveTask = (
    taskData: Omit<ScheduleTask, 'id'>,
    existingId?: string
  ) => {
    if (existingId) {
      setTasks((prev) =>
        prev.map((t) => (t.id === existingId ? { ...taskData, id: existingId } : t))
      );
    } else {
      const newTask: ScheduleTask = {
        ...taskData,
        id: `task-${Date.now()}`,
      };
      setTasks((prev) => [newTask, ...prev]);
    }
  };

  const handleOpenNewTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleUpdateConfig = (patch: Partial<CadenceConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      if (
        patch.globalIntervalMinutes !== undefined &&
        patch.globalIntervalMinutes !== prev.globalIntervalMinutes
      ) {
        setSecondsUntilNextPush(Math.max(1, patch.globalIntervalMinutes) * 60);
      }
      return next;
    });
  };

  const handleRequestPermission = async () => {
    const res = await requestBrowserNotificationPermission();
    setBrowserPermission(res);
  };

  const handleRestoreSampleSchedule = () => {
    setTasks(INITIAL_SCHEDULE_TASKS);
    setConfig(INITIAL_CADENCE_CONFIG);
    setSecondsUntilNextPush(INITIAL_CADENCE_CONFIG.globalIntervalMinutes * 60);
    setClockFilter('all');
  };

  const sortedTasks = useMemo(
    () => sortTasksByClock(tasks, clockFilter),
    [tasks, clockFilter]
  );

  const activeAlarmsCount = tasks.filter(
    (t) => !t.completed && t.notifyOnInterval
  ).length;

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Calculate SVG progress ring offset for the phone clock dial
  const totalIntervalSeconds = Math.max(60, config.globalIntervalMinutes * 60);
  const progressFraction = Math.min(
    1,
    Math.max(0, 1 - secondsUntilNextPush / totalIntervalSeconds)
  );
  const ringRadius = 86;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringStrokeDashoffset = ringCircumference * (1 - progressFraction);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/80 text-slate-900 pb-20 md:pb-10">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (Single-Line Nav Links) — Zone 3 (1 Primary CTA) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        <a
          href="#alarms"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('alarms');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Cadence Clock
        </a>

        <nav
          aria-label="Primary Workspace Views"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => setActiveTab('alarms')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'alarms'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Clock Alarms
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timer')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'timer'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Timer & Tones
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'history'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            History
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleOpenNewTask}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Alarm
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6">
        {activeTab === 'alarms' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Mobile Phone Clock Face, Interval Presets & Quick Tone Selector */}
            <section
              aria-label="Live Clock and Push Reminder Timer"
              className="lg:col-span-5 bg-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-sm space-y-6"
            >
              {/* Top Digital Clock Readout + Active/Pause Switch */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    Current Clock Time
                  </div>
                  <div className="text-2xl font-mono font-bold text-white tabular-nums mt-0.5">
                    {currentTimeStr}
                    <span className="text-sm text-slate-400">:{currentSecondsStr}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleUpdateConfig({ enabled: !config.enabled })}
                  aria-label={
                    config.enabled
                      ? 'Pause interval notifications'
                      : 'Resume interval notifications'
                  }
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-full border border-slate-700 transition-colors whitespace-nowrap shrink-0"
                >
                  {config.enabled ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-amber-400" />
                      Clock Active
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      Clock Paused
                    </>
                  )}
                </button>
              </div>

              {/* Circular Phone Clock Dial & Next Push Countdown */}
              <div className="flex flex-col items-center justify-center py-1">
                <div className="relative w-52 h-52 flex items-center justify-center">
                  <svg
                    className="w-full h-full -rotate-90"
                    viewBox="0 0 200 200"
                    aria-hidden="true"
                  >
                    <circle
                      cx="100"
                      cy="100"
                      r={ringRadius}
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="10"
                    />
                    <circle
                      cx="100"
                      cy="100"
                      r={ringRadius}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringStrokeDashoffset}
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                    <span className="text-[11px] font-mono text-amber-300 uppercase tracking-wider">
                      Next Ring In
                    </span>
                    <div
                      data-testid="countdown-display"
                      className="text-4xl font-mono font-bold text-white tabular-nums tracking-tight mt-1"
                    >
                      {config.enabled
                        ? formatCountdown(secondsUntilNextPush)
                        : 'PAUSED'}
                    </div>
                    <span className="text-xs text-slate-400 mt-1">
                      Every {config.globalIntervalMinutes} min
                    </span>
                  </div>
                </div>
              </div>

              {/* One-Tap Clock Interval Presets (including 1m Quick Test!) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Repeat Notification Timer:</span>
                  <span className="font-mono text-amber-300">
                    {activeAlarmsCount} alarms ON
                  </span>
                </div>
                <div
                  className="grid grid-cols-5 gap-1.5"
                  role="group"
                  aria-label="Quick Push Interval"
                >
                  {[1, 5, 15, 30, 60].map((mins) => {
                    const active = config.globalIntervalMinutes === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() =>
                          handleUpdateConfig({ globalIntervalMinutes: mins })
                        }
                        aria-pressed={active}
                        className={`min-h-[42px] py-2 text-xs font-mono font-bold rounded-xl border transition-colors tabular-nums whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-amber-400 text-slate-950 border-amber-400'
                            : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        {mins}m
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Notification Tone Picker right on the Clock Card */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="clock-card-tone-select"
                    className="text-xs font-semibold text-slate-300"
                  >
                    Notification Tone
                  </label>
                  <button
                    type="button"
                    onClick={() => playNotificationTone(config.selectedToneId)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Test Tone
                  </button>
                </div>
                <select
                  id="clock-card-tone-select"
                  aria-label="Select Global Notification Tone"
                  value={config.selectedToneId}
                  onChange={(e) => {
                    const nextTone = e.target.value as NotificationToneId;
                    handleUpdateConfig({ selectedToneId: nextTone, soundEnabled: true });
                    playNotificationTone(nextTone);
                  }}
                  className="min-h-[40px] w-full px-3 py-2 text-xs font-semibold bg-slate-900 text-white border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {NOTIFICATION_TONES.map((tone) => (
                    <option key={tone.id} value={tone.id}>
                      {tone.name} ({tone.durationLabel})
                    </option>
                  ))}
                </select>
              </div>

              {/* Primary Action: Ring Schedule Now */}
              <div className="pt-1 space-y-2.5">
                <button
                  type="button"
                  onClick={() => triggerScheduleDigest('manual-digest')}
                  className="min-h-[48px] w-full py-3 px-4 text-sm font-bold text-slate-950 bg-white hover:bg-slate-100 rounded-2xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Bell className="w-4 h-4" />
                  Ring Schedule Now
                </button>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Rings at start time & every {config.globalIntervalMinutes}m</span>
                  <button
                    type="button"
                    onClick={handleRestoreSampleSchedule}
                    className="inline-flex items-center gap-1 text-slate-300 hover:text-white underline whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Demo
                  </button>
                </div>
              </div>
            </section>

            {/* RIGHT COLUMN: Phone Alarm-Style Schedule Cards (Strictly by Clock Time) */}
            <section
              aria-label="Daily Schedule Alarms"
              className="lg:col-span-7 space-y-4"
            >
              {/* Clean Clock Schedule Header & Filter Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-base font-bold text-slate-900">
                    Today’s Clock Schedule
                  </h1>
                  <p className="text-xs text-slate-500">
                    Ordered by clock time. Turn any alarm switch ON to get notifications.
                  </p>
                </div>

                {/* Simple Clock Filter Buttons */}
                <div
                  role="group"
                  aria-label="Filter Clock Alarms"
                  className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
                >
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'upcoming', label: 'Active' },
                      { id: 'completed', label: 'Done' },
                    ] as const
                  ).map((tab) => {
                    const active = clockFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setClockFilter(tab.id)}
                        className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Alarm-Style Task Cards */}
              {sortedTasks.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                  <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                  <h2 className="text-base font-bold text-slate-900">
                    No Clock Alarms Here
                  </h2>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Add a new clock alarm for your daily schedule.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    {clockFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setClockFilter('all')}
                        className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                      >
                        Show All Alarms
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenNewTask}
                      className="min-h-[44px] px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
                    >
                      + New Alarm
                    </button>
                  </div>
                </div>
              ) : (
                <div data-testid="schedule-task-list" className="space-y-3">
                  {sortedTasks.map((task) => {
                    const effectiveMins = getEffectiveIntervalMinutes(
                      task,
                      config
                    );
                    const isCurrentlyActive = isTaskActiveAtTime(
                      task,
                      currentTimeStr
                    );
                    const effectiveToneId = task.toneId || config.selectedToneId;

                    return (
                      <article
                        key={task.id}
                        className={`bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 transition-all ${
                          task.completed ? 'opacity-60 bg-slate-50/70' : ''
                        }`}
                      >
                        {/* Top Row: Large Phone-Alarm Time + Task Title + Alarm ON/OFF Switch */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            {/* Done Check Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleComplete(task.id)}
                              aria-label={
                                task.completed
                                  ? `Mark '${task.title}' as incomplete`
                                  : `Mark '${task.title}' as complete`
                              }
                              className="min-h-[44px] min-w-[44px] -ml-1 -mt-1 flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors shrink-0"
                            >
                              {task.completed ? (
                                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                              ) : (
                                <Circle className="w-6 h-6" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              {/* Big Alarm Clock Time Readout */}
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span
                                  className={`text-2xl sm:text-3xl font-mono font-bold tracking-tight tabular-nums ${
                                    task.completed
                                      ? 'line-through text-slate-400'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {task.startTime}
                                </span>
                                <span className="text-xs font-mono text-slate-400 tabular-nums">
                                  to {task.endTime}
                                </span>
                                {isCurrentlyActive && (
                                  <span className="text-xs font-mono font-bold text-emerald-700">
                                    · ACTIVE NOW
                                  </span>
                                )}
                              </div>

                              {/* Task Title */}
                              <h3
                                className={`text-sm sm:text-base font-bold mt-1 ${
                                  task.completed
                                    ? 'line-through text-slate-500'
                                    : 'text-slate-900'
                                }`}
                              >
                                {task.title}
                              </h3>

                              {task.description && (
                                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                  {task.description}
                                </p>
                              )}

                              {/* Clean Unboxed Clock Metadata */}
                              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 font-mono tabular-nums">
                                <span>
                                  {task.notifyOnInterval
                                    ? `Rings at ${task.startTime} & every ${effectiveMins}m`
                                    : 'Alarm muted'}
                                </span>
                                {task.lastNotifiedAt && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>Last rang {task.lastNotifiedAt}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Phone-Style Alarm ON/OFF Toggle Switch */}
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={task.notifyOnInterval}
                              aria-label={`Toggle push alarm for '${task.title}'`}
                              onClick={() => handleToggleAlarmSwitch(task.id)}
                              className={`min-h-[36px] w-14 rounded-full p-1 transition-colors flex items-center ${
                                task.notifyOnInterval && !task.completed
                                  ? 'bg-emerald-600 justify-end'
                                  : 'bg-slate-200 justify-start'
                              }`}
                            >
                              <span className="w-6 h-6 rounded-full bg-white shadow-xs block" />
                            </button>
                            <span className="text-[11px] font-mono text-slate-400">
                              {task.notifyOnInterval ? 'ON' : 'OFF'}
                            </span>
                          </div>
                        </div>

                        {/* Bottom Action Row: Notification Tone Picker + Ring Now + Edit/Delete */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <label
                              htmlFor={`tone-select-${task.id}`}
                              className="text-xs font-medium text-slate-500"
                            >
                              Tone:
                            </label>
                            <select
                              id={`tone-select-${task.id}`}
                              aria-label={`Select notification tone for '${task.title}'`}
                              value={effectiveToneId}
                              onChange={(e) =>
                                handleSetTaskTone(
                                  task.id,
                                  e.target.value as NotificationToneId
                                )
                              }
                              className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                            >
                              {NOTIFICATION_TONES.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => triggerSingleTaskPush(task, 'single-alarm')}
                              aria-label={`Ring alarm now for '${task.title}'`}
                              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                            >
                              <Bell className="w-3.5 h-3.5" />
                              Ring Now
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingTask(task);
                                setIsModalOpen(true);
                              }}
                              aria-label={`Edit '${task.title}'`}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              aria-label={`Delete '${task.title}'`}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'timer' && (
          <CadenceSettingsPanel
            config={config}
            tasks={tasks}
            currentTimeStr={currentTimeStr}
            secondsUntilNextPush={secondsUntilNextPush}
            browserPermission={browserPermission}
            onUpdateConfig={handleUpdateConfig}
            onRequestBrowserPermission={handleRequestPermission}
            onTriggerDigestNow={() => triggerScheduleDigest('manual-digest')}
          />
        )}

        {activeTab === 'history' && (
          <DispatchLogView
            logs={dispatchLogs}
            onTriggerDigestNow={() => triggerScheduleDigest('manual-digest')}
            onClearLogs={() => setDispatchLogs([])}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 items-center h-16 px-2"
      >
        <button
          type="button"
          onClick={() => setActiveTab('alarms')}
          className={`flex flex-col items-center justify-center h-full transition-colors ${
            activeTab === 'alarms' ? 'text-slate-900 font-bold' : 'text-slate-500'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[11px] mt-1">Alarms</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timer')}
          className={`flex flex-col items-center justify-center h-full transition-colors ${
            activeTab === 'timer' ? 'text-slate-900 font-bold' : 'text-slate-500'
          }`}
        >
          <Sliders className="w-5 h-5" />
          <span className="text-[11px] mt-1">Tones & Timer</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center h-full transition-colors ${
            activeTab === 'history' ? 'text-slate-900 font-bold' : 'text-slate-500'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[11px] mt-1">History</span>
        </button>

        <button
          type="button"
          onClick={handleOpenNewTask}
          className="flex flex-col items-center justify-center h-full text-slate-900 font-bold"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[11px] mt-1">New Alarm</span>
        </button>
      </nav>

      {/* Add / Edit Clock Alarm Modal */}
      <TaskFormModal
        isOpen={isModalOpen}
        initialTask={editingTask}
        defaultToneId={config.selectedToneId}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
      />

      {/* Live Push Notification Toast Banner */}
      <PushToastBanner
        notification={liveNotification}
        onDismiss={() => setLiveNotification(null)}
        onCompleteTask={handleToggleComplete}
        onSnooze={(mins) => {
          setSecondsUntilNextPush(mins * 60);
          setLiveNotification(null);
        }}
      />
    </div>
  );
}
