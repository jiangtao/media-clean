import { useEffect } from 'react';

import { reconcileReminderRuntimeInForeground } from '../features/reminders/reminder-runtime';
import { OBSERVABILITY_EVENTS } from '../services/observability/observability';
import { useAppPreferences } from './AppPreferencesContext';
import { getAppObservability } from './observability';

export function CleanupReminderBootstrap() {
  const { isReady, language, copy } = useAppPreferences();

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let isActive = true;

    async function reconcileReminderRuntime() {
      try {
        await reconcileReminderRuntimeInForeground(language, {
          name: copy.reminder.channelName,
          description: copy.reminder.channelDescription,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        getAppObservability().trackError(
          OBSERVABILITY_EVENTS.cleanupReminderReconcileFailed,
          error,
          {
            source: 'CleanupReminderBootstrap',
            language,
          },
        );
        console.error('Failed to reconcile cleanup reminder runtime:', error);
      }
    }

    void reconcileReminderRuntime();

    return () => {
      isActive = false;
    };
  }, [
    copy.reminder.channelDescription,
    copy.reminder.channelName,
    isReady,
    language,
  ]);

  return null;
}
