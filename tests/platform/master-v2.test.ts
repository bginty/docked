import test from "node:test";
import assert from "node:assert/strict";
import {
  displayCity,
  collectibleSerial,
  jerseyPresentation,
} from "../../src/core/card-presentation";
import { registerModal, topModal } from "../../src/core/modal-lifecycle";

test("city display preserves canonical and historical team identity without splitting names", () => {
  for (const [team, city] of [
    ["KC", "Kansas City"],
    ["Buffalo Bills", "Buffalo"],
    ["PHI", "Philadelphia"],
    ["BAL", "Baltimore"],
    ["NYJ", "New York"],
    ["NYG", "New York"],
    ["LAR", "Los Angeles"],
    ["SF", "San Francisco"],
    ["WAS", "Washington"],
    ["OAK", "Oakland"],
    ["SD", "San Diego"],
  ]) {
    const card = Object.freeze({ sport: "nfl", team });
    assert.equal(displayCity(card), city);
    assert.equal(card.team, team);
  }
  for (const team of ["", "QA_unknown"])
    assert.equal(displayCity({ sport: "nfl", team }), "Location unavailable");
  assert.equal(
    displayCity({ sport: "football", team: "Unverified City United" }),
    "Location unavailable",
  );
});
test("serials and verified jersey numbers remain authoritative", () => {
  assert.equal(
    collectibleSerial({ tier: "RARE", serial: 42, max_supply: 5000 }),
    "#042 / 5,000",
  );
  assert.equal(
    collectibleSerial({ tier: "CORE", serial: 42, max_supply: 5000 }),
    "Unlimited Core",
  );
  assert.equal(
    jerseyPresentation({ sport: "nfl", team: "KC", shirt: 99 }).number,
    "—",
  );
  assert.equal(
    jerseyPresentation({ sport: "nfl", team: "KC", verifiedJerseyNumber: 15 })
      .number,
    "15",
  );
});
test("nested and out-of-order modal teardown never leaves a stale body lock", () => {
  const listeners = new Map<string, () => void>();
  const body = { style: { overflow: "auto" } };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { body },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: (name: string, cb: () => void) =>
        listeners.set(name, cb),
      removeEventListener: (name: string) => listeners.delete(name),
    },
  });
  try {
    for (let i = 0; i < 10; i++) {
      const a = {} as HTMLDialogElement,
        b = {} as HTMLDialogElement;
      let closed = "";
      const releaseA = registerModal(a, () => {
        closed = "a";
      });
      const releaseB = registerModal(b, () => {
        closed = "b";
      });
      listeners.get("popstate")!();
      assert.equal(closed, "b");
      releaseA();
      releaseA();
      assert.equal(body.style.overflow, "hidden");
      assert.equal(topModal(), b);
      releaseB();
      assert.equal(body.style.overflow, "auto");
      assert.equal(listeners.size, 0);
      assert.equal(topModal(), undefined);
    }
  } finally {
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "window");
  }
});
