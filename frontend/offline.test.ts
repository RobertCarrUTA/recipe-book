import { describe, it, expect } from "vitest";
import { createOfflineController } from "./offline";

function fixture({ hasController = true, flushResult = true } = {}) {
  const messages: unknown[] = [];
  let reloads = 0,
    flushes = 0;
  const worker = {
    postMessage(message: unknown) {
      messages.push(message);
    },
  };
  const container = Object.assign(new EventTarget(), {
    controller: hasController ? worker : null,
    async register() {
      return registration;
    },
  });
  const registration = Object.assign(new EventTarget(), {
    waiting: worker,
    installing: null,
    async update() {},
  });
  const controller = createOfflineController({
    serviceWorker: container as unknown as ServiceWorkerContainer,
    baseUrl: "https://example.test/recipe-book/",
    release: "a".repeat(24),
    flush: () => {
      flushes++;
      return flushResult;
    },
    reload: () => {
      reloads++;
    },
    onChange: () => {},
  });
  return {
    controller,
    container,
    registration,
    messages,
    get reloads() {
      return reloads;
    },
    get flushes() {
      return flushes;
    },
  };
}
describe("explicit offline update activation", () => {
  it("does not activate merely because a worker is waiting", async () => {
    const f = fixture();
    await f.controller.start();
    expect(f.controller.getState().updateReady).toBe(true);
    expect(f.messages).not.toContainEqual({ type: "SKIP_WAITING" });
    expect(f.reloads).toBe(0);
  });
  it("flushes first and blocks activation when persistence fails", async () => {
    const f = fixture({ flushResult: false });
    await f.controller.start();
    expect(await f.controller.refresh()).toBe(false);
    expect(f.flushes).toBe(1);
    expect(f.messages).not.toContainEqual({ type: "SKIP_WAITING" });
    expect(f.controller.getState().error).toMatch(/Export a backup/);
  });
  it("reloads the requesting tab only after successful activation", async () => {
    const f = fixture();
    await f.controller.start();
    expect(await f.controller.refresh()).toBe(true);
    expect(f.flushes).toBe(1);
    expect(f.reloads).toBe(0);
    expect(f.messages).toContainEqual({ type: "SKIP_WAITING" });
    f.container.dispatchEvent(new Event("controllerchange"));
    expect(f.reloads).toBe(1);
  });
  it("keeps another tab in place until that tab explicitly refreshes", async () => {
    const f = fixture();
    await f.controller.start();
    f.registration.waiting = null as unknown as typeof f.registration.waiting;
    f.container.dispatchEvent(new Event("controllerchange"));
    expect(f.reloads).toBe(0);
    expect(f.controller.getState().updateReady).toBe(true);
    await f.controller.refresh();
    expect(f.reloads).toBe(1);
    expect(f.flushes).toBe(1);
  });
  it("never reloads on first control or after disposal", async () => {
    const f = fixture({ hasController: false });
    await f.controller.start();
    f.container.controller = { postMessage() {} };
    f.container.dispatchEvent(new Event("controllerchange"));
    expect(f.reloads).toBe(0);
    f.controller.dispose();
    expect(await f.controller.refresh()).toBe(false);
  });
});
