import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadText } from "./RecipeDetail";

const originalCreate = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevoke = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
const create = vi.fn((_blob: Blob) => "blob:recipe-export");
const revoke = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  create.mockClear();
  revoke.mockClear();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: create,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revoke,
  });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalCreate)
    Object.defineProperty(URL, "createObjectURL", originalCreate);
  else Reflect.deleteProperty(URL, "createObjectURL");
  if (originalRevoke)
    Object.defineProperty(URL, "revokeObjectURL", originalRevoke);
  else Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("recipe and backup download cleanup", () => {
  it("clicks the attached filename/type link, then removes it and revokes its URL", () => {
    let link: HTMLAnchorElement | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      link = this;
      expect(this.isConnected).toBe(true);
      expect(this.download).toBe("recipe.json");
      expect(this.href).toBe("blob:recipe-export");
    });
    const text = '{"title":"Bean Soup"}';
    downloadText(text, "recipe.json", "application/json");
    expect(create).toHaveBeenCalledOnce();
    const blob = create.mock.calls[0][0];
    expect(blob.type).toBe("application/json");
    expect(blob.size).toBe(new Blob([text]).size);
    expect(link).toBeTruthy();
    expect(link?.isConnected).toBe(false);
    expect(revoke).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:recipe-export");
  });

  it("removes the anchor and revokes its URL while propagating a blocked-click error", () => {
    let link: HTMLAnchorElement | undefined;
    const blocked = new Error("Download blocked");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      link = this;
      throw blocked;
    });
    expect(() => downloadText("Beans", "recipe.txt")).toThrow(blocked);
    expect(create.mock.calls[0][0].type).toBe("text/plain");
    expect(link).toBeTruthy();
    expect(link?.isConnected).toBe(false);
    vi.runOnlyPendingTimers();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:recipe-export");
  });
});
