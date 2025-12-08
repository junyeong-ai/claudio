import { useSyncExternalStore } from 'react';
import { useMounted } from './use-mounted';

const MOBILE_BREAKPOINT = 768;

const subscribe = (callback: () => void) => {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener('change', callback);
  window.addEventListener('resize', callback);
  return () => {
    mql.removeEventListener('change', callback);
    window.removeEventListener('resize', callback);
  };
};

const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT;
const getServerSnapshot = () => false;

export function useIsMobile(): boolean {
  const mounted = useMounted();
  const isMobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return mounted && isMobile;
}
