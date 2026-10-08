import {useEffect, useState} from 'react';

/** One lifecycle, mounted once by Cooking even while its dialog is closed. */
export function useWakeLock(enabled: boolean, onFailure: () => void) {
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.wakeLock?.request);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!supported || !enabled) {setActive(false); return;}
    let disposed = false;
    let pending = false;
    let generation = 0;
    let sentinel: WakeLockSentinel | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const wantsLock = () => !disposed && document.visibilityState === 'visible';
    const release = async (lock: WakeLockSentinel | null) => {
      if (!lock) return;
      try {await lock.release();} catch { /* A released or suspended lock is already safe. */ }
    };
    async function request() {
      if (!wantsLock() || pending || sentinel) return;
      const requestGeneration = generation;
      pending = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        pending = false;
        if (!wantsLock() || requestGeneration !== generation) {
          await release(lock);
          if (wantsLock()) void request();
          return;
        }
        sentinel = lock;
        setActive(true);
        lock.addEventListener('release', () => {
          if (sentinel !== lock) return;
          sentinel = null;
          if (!disposed) setActive(false);
          if (wantsLock()) retry = setTimeout(() => void request(), 0);
        });
      } catch {
        pending = false;
        if (!disposed && requestGeneration === generation) {setActive(false); onFailure();}
      }
    }
    function visibilityChanged() {
      if (document.visibilityState === 'visible') void request();
      else {
        generation += 1;
        const held = sentinel; sentinel = null; setActive(false); void release(held);
      }
    }
    document.addEventListener('visibilitychange', visibilityChanged);
    void request();
    return () => {
      disposed = true; generation += 1; clearTimeout(retry);
      document.removeEventListener('visibilitychange', visibilityChanged);
      const held = sentinel; sentinel = null; void release(held);
    };
  }, [enabled, onFailure, supported]);
  return {supported, active};
}
