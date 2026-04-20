import { useEffect } from 'react';

import { reconcileReminderRuntimeOnLaunch } from '../features/reminders/reminder-runtime';
import { useAppPreferences } from './AppPreferencesContext';

export function CleanupReminderBootstrap() {
  const { isReady, language, copy } = useAppPreferences();

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let isActive = true;

    async function reconcileReminderRuntime() {
      try {
        await reconcileReminderRuntimeOnLaunch(language, {
          name: copy.reminder.channelName,
          description: copy.reminder.channelDescription,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

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
