import test from "node:test";
import assert from "node:assert/strict";
import { registerModal, topModal } from "../../src/core/modal-lifecycle";

test("statistics sheet Back and explicit close preserve the parent and scroll lock", () => {
  const listeners = new Set<() => void>();
  const entries: Record<string, unknown>[] = [{ __NA: true }];
  let popPending = false;
  const fakeWindow = {
    location: { href: "https://example.test/cards" },
    addEventListener: (_: string, f: () => void) => listeners.add(f),
    removeEventListener: (_: string, f: () => void) => listeners.delete(f),
    history: {
      get state() {
        return entries.at(-1);
      },
      pushState(value: Record<string, unknown>) {
        entries.push(value);
      },
      back() {
        entries.pop();
        popPending = true;
      },
    },
  };
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { body: { style: { overflow: "auto" } } },
  });
  const emitPop = () => {
    assert.ok(popPending);
    popPending = false;
    [...listeners].forEach((f) => f());
  };
  let parentClosed = 0,
    childClosed = 0;
  const parent = {} as HTMLDialogElement,
    child = {} as HTMLDialogElement;
  const releaseParent = registerModal(parent, () => parentClosed++);
  try {
    let releaseChild = registerModal(
      child,
      () => {
        childClosed++;
        releaseChild();
      },
      true,
    );
    assert.equal(entries.length, 2);
    assert.equal(fakeWindow.history.state?.__NA, true);
    fakeWindow.history.back();
    emitPop();
    assert.equal(childClosed, 1);
    assert.equal(parentClosed, 0);
    assert.equal(topModal(), parent);
    assert.equal(document.body.style.overflow, "hidden");
    releaseChild = registerModal(child, () => childClosed++, true);
    releaseChild();
    emitPop();
    assert.equal(parentClosed, 0);
    assert.equal(entries.length, 1);
    assert.equal(topModal(), parent);
    releaseChild(); // idempotent cleanup
  } finally {
    releaseParent();
    assert.equal(document.body.style.overflow, "auto");
    assert.equal(listeners.size, 0);
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
