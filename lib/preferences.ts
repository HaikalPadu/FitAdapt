import {useSyncExternalStore} from 'react';

interface Preferences {
  language: 'ms' | 'en';
  theme: 'dark' | 'light';
  text: (value: string) => string;
  system: (value: string) => string;
}
declare global { interface Window { FitAdaptPreferences: Preferences; } }
const subscribe = (listener: () => void) => {
  window.addEventListener('fitadapt:preferences', listener);
  return () => window.removeEventListener('fitadapt:preferences', listener);
};
export const t = (value: string) => window.FitAdaptPreferences.text(value);
export const systemText = (value: string) => window.FitAdaptPreferences.system(value);
export function useLanguage() {
  return useSyncExternalStore(subscribe, () => window.FitAdaptPreferences.language, () => 'ms');
}
