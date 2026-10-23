import { useSyncExternalStore } from 'react';
import {
  isLightweightPublicRouteNow,
  isPublicFormDataRouteNow,
  isPublicLeadFormRouteNow,
} from '../routes/publicRoutePath';

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  window.addEventListener('popstate', callback);
  return () => {
    window.removeEventListener('hashchange', callback);
    window.removeEventListener('popstate', callback);
  };
}

/** `true` saat halaman publik tidak membutuhkan dataset vendor global. */
export function useIsLightweightPublicRoute(): boolean {
  return useSyncExternalStore(subscribe, isLightweightPublicRouteNow, () => false);
}

/** Dataset pendukung hanya dimuat untuk formulir paket/booking publik. */
export function useIsPublicFormDataRoute(): boolean {
  return useSyncExternalStore(subscribe, isPublicFormDataRouteNow, () => false);
}

/** Form prospek memakai pengaturan profil, tetapi tidak perlu dataset global. */
export function useIsPublicLeadFormRoute(): boolean {
  return useSyncExternalStore(subscribe, isPublicLeadFormRouteNow, () => false);
}
