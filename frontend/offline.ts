import { useEffect, useRef, useState } from "react";

export type OfflineState = {
  supported: boolean;
  updateReady: boolean;
  updating: boolean;
  error: string;
};
type Options = {
  serviceWorker: ServiceWorkerContainer;
  baseUrl: string;
  release: string;
  flush: () => boolean;
  reload: () => void;
  onChange: (state: OfflineState) => void;
};

export function createOfflineController({
  serviceWorker,
  baseUrl,
  release,
  flush,
  reload,
  onChange,
}: Options) {
  let state: OfflineState = {
    supported: true,
    updateReady: false,
    updating: false,
    error: "",
  };
  let registration: ServiceWorkerRegistration | undefined;
  let disposed = false;
  let requestedRefresh = false;
  let changedController = false;
  let priorController = serviceWorker.controller;
  const removers: (() => void)[] = [];
  const patch = (next: Partial<OfflineState>) => {
    state = { ...state, ...next };
    if (!disposed) onChange(state);
  };
  const reportRelease = () =>
    serviceWorker.controller?.postMessage({ type: "CLIENT_RELEASE", release });
  function controllerChange() {
    reportRelease();
    if (requestedRefresh) {
      reload();
      return;
    }
    if (priorController) {
      changedController = true;
      patch({ updateReady: true, updating: false });
    }
    priorController = serviceWorker.controller;
  }
  function inspect() {
    if (registration?.waiting) patch({ updateReady: true, updating: false });
    const installing = registration?.installing;
    if (!installing) return;
    const changed = () => {
      if (installing.state === "installed" && serviceWorker.controller)
        patch({ updateReady: true, updating: false });
      if (installing.state === "redundant")
        patch({
          updating: false,
          error:
            "The update could not finish downloading. Your previous offline version is still available.",
        });
    };
    installing.addEventListener("statechange", changed);
    removers.push(() => installing.removeEventListener("statechange", changed));
  }
  serviceWorker.addEventListener("controllerchange", controllerChange);
  async function start() {
    try {
      registration = await serviceWorker.register(
        new URL("sw.js", baseUrl).href,
        { scope: baseUrl, updateViaCache: "none" },
      );
      if (disposed) return;
      registration.addEventListener("updatefound", inspect);
      removers.push(() =>
        registration?.removeEventListener("updatefound", inspect),
      );
      reportRelease();
      inspect();
      // The browser checks on registration; explicitly checking also catches a long-lived tab.
    } catch {
      patch({
        error:
          "Offline storage could not be prepared. You can keep using the app while connected.",
      });
    }
  }
  async function refresh() {
    if (
      disposed ||
      state.updating ||
      (!registration?.waiting && !changedController)
    )
      return false;
    if (!flush()) {
      patch({
        error:
          "Your changes could not be saved. Export a backup before refreshing.",
      });
      return false;
    }
    patch({ updating: true, error: "" });
    if (changedController && !registration?.waiting) {
      reload();
      return true;
    }
    requestedRefresh = true;
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    return true;
  }
  async function check() {
    try {
      await registration?.update();
      inspect();
    } catch {
      /* Offline update checks are optional. */
    }
  }
  return {
    start,
    refresh,
    check,
    getState: () => state,
    dispose() {
      disposed = true;
      serviceWorker.removeEventListener("controllerchange", controllerChange);
      removers.forEach((remove) => remove());
    },
  };
}

export function useOffline(flush: () => boolean) {
  const flushRef = useRef(flush);
  flushRef.current = flush;
  const controller = useRef<ReturnType<typeof createOfflineController> | null>(
    null,
  );
  const [state, setState] = useState<OfflineState>({
    supported: false,
    updateReady: false,
    updating: false,
    error: "",
  });
  useEffect(() => {
    if (
      !import.meta.env.PROD ||
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    )
      return;
    const release =
      document.querySelector<HTMLMetaElement>(
        'meta[name="recipe-book-release"]',
      )?.content || "";
    const current = createOfflineController({
      serviceWorker: navigator.serviceWorker,
      baseUrl: new URL(import.meta.env.BASE_URL, location.origin).href,
      release,
      flush: () => flushRef.current(),
      reload: () => location.reload(),
      onChange: setState,
    });
    controller.current = current;
    setState(current.getState());
    void current.start();
    const onVisible = () => {
      if (document.visibilityState === "visible") void current.check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      current.dispose();
      controller.current = null;
    };
  }, []);
  return {
    ...state,
    refresh: () => controller.current?.refresh() || Promise.resolve(false),
  };
}
