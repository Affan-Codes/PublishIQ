import { AppState, AppStateStatus } from 'react-native';
import { focusManager } from '@tanstack/react-query';

let lastBackgroundTimestamp: number | null = null;
type ResumeCallback = (backgroundDurationMs: number) => void;
const resumeCallbacks = new Set<ResumeCallback>();

export function onAppResume(cb: ResumeCallback): () => void {
  resumeCallbacks.add(cb);
  return () => {
    resumeCallbacks.delete(cb);
  };
}

export function initAppStateListener(): () => void {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    const isFocused = status === 'active';
    focusManager.setFocused(isFocused);

    if (status === 'background') {
      lastBackgroundTimestamp = Date.now();
    } else if (status === 'active' && lastBackgroundTimestamp !== null) {
      const duration = Date.now() - lastBackgroundTimestamp;
      lastBackgroundTimestamp = null;
      resumeCallbacks.forEach((cb) => cb(duration));
    }
  });

  return () => {
    subscription.remove();
  };
}
