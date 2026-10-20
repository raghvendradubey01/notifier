import React from 'react';
import { Bell, Play, Trash2, Volume2 } from 'lucide-react';
import {
  NOTIFICATION_TONES,
  type NotificationDigestPayload,
} from '../utils/schedulerLogic';
import { playNotificationTone } from '../utils/pushService';

interface DispatchLogViewProps {
  logs: NotificationDigestPayload[];
  onTriggerDigestNow: () => void;
  onClearLogs: () => void;
}

export const DispatchLogView: React.FC<DispatchLogViewProps> = ({
  logs,
  onTriggerDigestNow,
  onClearLogs,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Today’s Clock Alarm History
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Every clock alarm and interval notification that rang today is listed below.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {logs.length > 0 && (
            <button
              type="button"
              onClick={onClearLogs}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              Clear History
            </button>
          )}
          <button
            type="button"
            onClick={onTriggerDigestNow}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4" />
            Ring Schedule Now
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Bell className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="mt-3 text-base font-bold text-slate-900">
            No Alarms Rang Yet
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            When your clock hits a scheduled start time, your interval timer completes, or you tap "Ring Schedule Now", it will appear here.
          </p>
          <button
            type="button"
            onClick={onTriggerDigestNow}
            className="mt-5 min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4" />
            Trigger First Alarm
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((entry) => {
            const toneMeta =
              NOTIFICATION_TONES.find((t) => t.id === entry.toneId) ||
              NOTIFICATION_TONES[0];
            return (
              <div
                key={entry.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 tabular-nums">
                    <span className="font-bold text-slate-900">
                      Rang at {entry.dispatchedAt}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Every {entry.intervalMinutes}m timer</span>
                    <span aria-hidden="true">·</span>
                    <span>{toneMeta.name}</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">
                    {entry.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {entry.body}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => playNotificationTone(entry.toneId)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Replay Tone
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
