import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, renderHook, cleanup } from "@testing-library/react";
import { readTheme, useTheme, themeKey } from "./theme";
let systemDark = false;
let changes = new Set<() => void>();
beforeEach(() => {
  localStorage.clear();
  systemDark = false;
  changes = new Set();
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return systemDark;
    },
    addEventListener: (_event: string, callback: () => void) =>
      changes.add(callback),
    removeEventListener: (_event: string, callback: () => void) =>
      changes.delete(callback),
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("theme preference", () => {
  it("uses System for absent or malformed storage", () => {
    expect(readTheme()).toBe("system");
    localStorage.setItem(themeKey, "invalid");
    expect(readTheme()).toBe("system");
  });
  it("follows live OS changes only while System is selected", () => {
    const { result } = renderHook(useTheme);
    expect(document.documentElement.dataset.theme).toBe("light");
    act(() => {
      systemDark = true;
      changes.forEach((callback) => callback());
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
    act(() => result.current.setTheme("light"));
    act(() => {
      systemDark = true;
      changes.forEach((callback) => callback());
    });
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(themeKey)).toBe("light");
  });
  it("applies an explicit preference before waiting for an effect and keeps working if persistence fails", () => {
    const { result } = renderHook(useTheme);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    let saved = true;
    act(() => {
      saved = result.current.setTheme("dark");
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(saved).toBe(false);
    expect(result.current.theme).toBe("dark");
  });
  it("does not retain OS listeners after unmount", () => {
    const { unmount } = renderHook(useTheme);
    expect(changes.size).toBe(1);
    unmount();
    expect(changes.size).toBe(0);
  });
});
