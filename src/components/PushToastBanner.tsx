import React from 'react';
import { Bell, CheckCircle2, Clock, Volume2, X } from 'lucide-react';
import {
  NOTIFICATION_TONES,
  type NotificationDigestPayload,
} from '../utils/schedulerLogic';
import { playNotificationTone } from '../utils/pushService';

interface PushToastBannerProps {
  notification: NotificationDigestPayload | null;
  onDismiss: () => void;
  onCompleteTask: (taskId: string) => void;
  onSnooze: (minutes: number) => void;
}

export const PushToastBanner: React.FC<PushToastBannerProps> = ({
  notification,
  onDismiss,
  onCompleteTask,
  onSnooze,
}) => {
  if (!notification) return null;

  const leadTask = notification.featuredTasks[0];
  const toneMeta =
    NOTIFICATION_TONES.find((t) => t.id === notification.toneId) ||
    NOTIFICATION_TONES[0];

  return (
    <div
      role="region"
      aria-label="Live Schedule Push Notification"
      data-testid="live-push-banner"
      className="fixed bottom-20 md:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50 sm:w-full sm:max-w-md bg-slate-900 text-white border border-slate-700 rounded-2xl shadow-xl p-5 transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-mono text-amber-300 tabular-nums">
          <Bell className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold">CLOCK ALARM</span>
          <span aria-hidden="true">·</span>
          <span>{notification.dispatchedAt}</span>
          <span aria-hidden="true">·</span>
          <span>{toneMeta.name}</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss push notification"
          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <h3 className="mt-2 text-base font-bold text-white leading-snug">
        {notification.title}
      </h3>

      <p className="mt-1 text-xs text-slate-300 leading-relaxed">
        {notification.body}
      </p>

      <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {leadTask && (
            <button
              type="button"
              onClick={() => {
                onCompleteTask(leadTask.id);
                onDismiss();
              }}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark Done
            </button>
          )}
          <button
            type="button"
            onClick={() => onSnooze(5)}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Clock className="w-4 h-4" />
            Snooze 5m
          </button>
          <button
            type="button"
            onClick={() => playNotificationTone(notification.toneId)}
            aria-label="Replay alarm tone"
            className="min-h-[40px] inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl border border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Volume2 className="w-4 h-4" />
            Ring
          </button>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[40px] px-3 py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
