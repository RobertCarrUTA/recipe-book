import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "./useWakeLock";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function sentinel() {
  const lock = new EventTarget();
  const release = vi.fn(async () => {
    lock.dispatchEvent(new Event("release"));
  });
  return Object.assign(lock, {
    release,
    released: false,
    type: "screen",
  }) as unknown as WakeLockSentinel & { release: typeof release };
}
function api(request: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
}
async function visibility(value: DocumentVisibilityState) {
  await act(async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: undefined,
  });
  vi.restoreAllMocks();
});

describe("wake-lock visibility lifecycle", () => {
  it("releases a held lock while hidden and reacquires only one lock when visible", async () => {
    const first = sentinel(),
      second = sentinel(),
      failure = vi.fn();
    const request = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    api(request);
    const { result } = renderHook(() => useWakeLock(true, failure));
    await act(async () => {});
    expect(result.current.active).toBe(true);
    await visibility("hidden");
    expect(first.release).toHaveBeenCalledOnce();
    expect(result.current.active).toBe(false);
    await visibility("hidden");
    expect(request).toHaveBeenCalledTimes(1);
    await visibility("visible");
    await visibility("visible");
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith("screen");
    expect(result.current.active).toBe(true);
    expect(failure).not.toHaveBeenCalled();
  });

  it("discards a pending pre-hide lock before reacquiring after visibility returns", async () => {
    const pending = deferred<WakeLockSentinel>(),
      old = sentinel(),
      current = sentinel(),
      failure = vi.fn();
    const request = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(current);
    api(request);
    const { result } = renderHook(() => useWakeLock(true, failure));
    await visibility("hidden");
    await visibility("visible");
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve(old);
    });
    expect(old.release).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.current.active).toBe(true);
    expect(current.release).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
  });

  it("retries a stale pending request that rejects after hide and visible", async () => {
    const pending = deferred<WakeLockSentinel>(),
      current = sentinel(),
      failure = vi.fn();
    const request = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(current);
    api(request);
    const { result } = renderHook(() => useWakeLock(true, failure));
    await visibility("hidden");
    await visibility("visible");
    await act(async () => {
      pending.reject(
        new DOMException("Document was hidden", "NotAllowedError"),
      );
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.current.active).toBe(true);
    expect(failure).not.toHaveBeenCalled();
  });

  it("does not acquire while initially hidden and releases a late lock after unmount", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const pending = deferred<WakeLockSentinel>(),
      late = sentinel(),
      failure = vi.fn();
    const request = vi.fn(() => pending.promise);
    api(request);
    const { unmount } = renderHook(() => useWakeLock(true, failure));
    expect(request).not.toHaveBeenCalled();
    await visibility("visible");
    expect(request).toHaveBeenCalledOnce();
    unmount();
    await act(async () => {
      pending.resolve(late);
    });
    expect(late.release).toHaveBeenCalledOnce();
    await visibility("hidden");
    await visibility("visible");
    expect(request).toHaveBeenCalledOnce();
    expect(failure).not.toHaveBeenCalled();
  });

  it("reacquires an OS-released lock while visible without retaining a cleanup retry", async () => {
    const first = sentinel(),
      second = sentinel(),
      failure = vi.fn();
    const request = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    api(request);
    const { result, unmount } = renderHook(() => useWakeLock(true, failure));
    await act(async () => {});
    act(() => {
      first.dispatchEvent(new Event("release"));
    });
    expect(result.current.active).toBe(false);
    await act(async () => {
      vi.runOnlyPendingTimers();
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.current.active).toBe(true);
    act(() => {
      second.dispatchEvent(new Event("release"));
    });
    unmount();
    await act(async () => {
      vi.runOnlyPendingTimers();
    });
    expect(request).toHaveBeenCalledTimes(2);
  });
});
