import React, { useState } from 'react';
import { Bell, Volume2, VolumeX, Play, Check } from 'lucide-react';
import {
  NOTIFICATION_TONES,
  buildNotificationDigestPayload,
  type CadenceConfig,
  type NotificationToneId,
  type ScheduleTask,
} from '../utils/schedulerLogic';
import {
  playNotificationTone,
  type BrowserPermissionState,
} from '../utils/pushService';

interface CadenceSettingsPanelProps {
  config: CadenceConfig;
  tasks: ScheduleTask[];
  currentTimeStr: string;
  secondsUntilNextPush: number;
  browserPermission: BrowserPermissionState;
  onUpdateConfig: (patch: Partial<CadenceConfig>) => void;
  onRequestBrowserPermission: () => void;
  onTriggerDigestNow: () => void;
}

const PRESET_INTERVALS = [
  { mins: 1, label: 'Every 1m' },
  { mins: 5, label: 'Every 5m' },
  { mins: 15, label: 'Every 15m' },
  { mins: 30, label: 'Every 30m' },
  { mins: 45, label: 'Every 45m' },
  { mins: 60, label: 'Every 60m' },
];

export const CadenceSettingsPanel: React.FC<CadenceSettingsPanelProps> = ({
  config,
  tasks,
  currentTimeStr,
  secondsUntilNextPush,
  browserPermission,
  onUpdateConfig,
  onRequestBrowserPermission,
  onTriggerDigestNow,
}) => {
  const [customMinutesInput, setCustomMinutesInput] = useState(
    String(config.globalIntervalMinutes)
  );

  const previewPayload = buildNotificationDigestPayload(
    tasks,
    config,
    currentTimeStr,
    'interval'
  );

  const formatCountdown = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleApplyCustomMinutes = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(customMinutesInput);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 480) {
      onUpdateConfig({ globalIntervalMinutes: Math.round(parsed) });
    }
  };

  const handleSelectTone = (toneId: NotificationToneId) => {
    onUpdateConfig({ selectedToneId: toneId, soundEnabled: true });
    playNotificationTone(toneId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Clock Timer & Notification Tones
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Set how often your clock schedule rings and pick your favorite alarm tone.
          </p>
        </div>

        <button
          type="button"
          onClick={onTriggerDigestNow}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          <Play className="w-4 h-4" />
          Ring Schedule Now
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 6 Notification Tones Library */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Choose Notification Tone (6 Tones)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tap any tone below to select it and hear an instant preview.
                </p>
              </div>
              <button
                type="button"
                onClick={() => playNotificationTone(config.selectedToneId)}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-4 h-4" />
                Play Current Tone
              </button>
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              role="radiogroup"
              aria-label="Notification Tones"
            >
              {NOTIFICATION_TONES.map((tone) => {
                const isSelected = config.selectedToneId === tone.id;
                return (
                  <button
                    key={tone.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectTone(tone.id)}
                    className={`min-h-[68px] p-4 rounded-2xl border text-left flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <Volume2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-amber-400' : 'text-slate-500'
                          }`}
                        />
                        <span className="truncate">{tone.name}</span>
                      </div>
                      <p
                        className={`text-[11px] mt-1 leading-snug ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {tone.description}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-mono tabular-nums shrink-0 ${
                        isSelected ? 'text-amber-300 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {isSelected ? 'ACTIVE' : tone.durationLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Clock Interval Selection */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Repeat Notification Interval
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  How often should the clock push your active schedule reminders?
                </p>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-[11px] text-slate-500">NEXT RING</div>
                <div className="text-xl font-bold text-slate-900">
                  {config.enabled ? formatCountdown(secondsUntilNextPush) : 'Paused'}
                </div>
              </div>
            </div>

            <div
              className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
              role="group"
              aria-label="Preset Notification Intervals"
            >
              {PRESET_INTERVALS.map(({ mins, label }) => {
                const isSelected = config.globalIntervalMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      onUpdateConfig({ globalIntervalMinutes: mins });
                      setCustomMinutesInput(String(mins));
                    }}
                    aria-pressed={isSelected}
                    className={`min-h-[48px] px-4 py-2.5 text-xs font-mono font-bold rounded-xl border transition-colors tabular-nums whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <form
              onSubmit={handleApplyCustomMinutes}
              className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3"
            >
              <label
                htmlFor="custom-cadence-minutes"
                className="text-xs font-semibold text-slate-700"
              >
                Or set custom minutes (1–480):
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="custom-cadence-minutes"
                  type="number"
                  min={1}
                  max={480}
                  value={customMinutesInput}
                  onChange={(e) => setCustomMinutesInput(e.target.value)}
                  className="min-h-[44px] w-24 px-3 py-2 text-sm font-mono font-bold tabular-nums bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Set Timer
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Right Column: Clock Trigger Settings & Next Reminder Preview */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Clock Behavior & Channels
            </h3>

            <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-100">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Ring at Exact Start Time
                </div>
                <div className="text-xs text-slate-500">
                  Automatically ring when the clock hits a task’s scheduled start time.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.ringAtExactStartTime}
                onClick={() =>
                  onUpdateConfig({
                    ringAtExactStartTime: !config.ringAtExactStartTime,
                  })
                }
                className={`min-h-[40px] px-4 py-1.5 text-xs font-bold rounded-full transition-colors whitespace-nowrap shrink-0 ${
                  config.ringAtExactStartTime
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {config.ringAtExactStartTime ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-100">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Alarm Sound
                </div>
                <div className="text-xs text-slate-500">
                  Play your selected notification tone when an alarm triggers.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateConfig({ soundEnabled: !config.soundEnabled })}
                aria-label={config.soundEnabled ? 'Mute sound chime' : 'Enable sound chime'}
                className={`min-h-[40px] px-4 py-1.5 text-xs font-bold rounded-full inline-flex items-center gap-1.5 transition-colors ${
                  config.soundEnabled
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {config.soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5" /> Sound ON
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5" /> Muted
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 py-2">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Browser Push Notifications
                </div>
                <div className="text-xs text-slate-500">
                  Status: {browserPermission.toUpperCase()}
                </div>
              </div>

              {browserPermission === 'granted' ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <Check className="w-4 h-4" />
                  Enabled
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onRequestBrowserPermission}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Allow Push
                </button>
              )}
            </div>
          </section>

          {/* Preview of Next Reminder */}
          <section className="bg-slate-900 text-white rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-amber-300 tabular-nums">
              <span className="flex items-center gap-1.5 font-semibold">
                <Bell className="w-4 h-4" />
                NEXT CLOCK REMINDER
              </span>
              <span>EVERY {config.globalIntervalMinutes}M</span>
            </div>

            <div className="text-sm font-bold text-white">
              {previewPayload.title}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {previewPayload.body}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
