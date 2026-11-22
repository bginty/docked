import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { commercialPack } from "../../src/core/commercial-billing";
import { ownerPackAwardCommand } from "../../src/core/owner-pack-awards";

function command() {
  return {
    request: randomUUID(),
    member: randomUUID(),
    reason: "PROMOTION" as const,
    reference: "  Launch promotion  ",
    confirmed: true,
    lines: [
      {
        sport: "nfl" as const,
        family: "PREMIUM" as const,
        size: 1 as const,
        quantity: 1,
        configurationHash: commercialPack("nfl", "PREMIUM", 1)
          .configurationHash,
      },
      {
        sport: "nfl" as const,
        family: "STANDARD" as const,
        size: 9 as const,
        quantity: 1,
        configurationHash: commercialPack("nfl", "STANDARD", 9)
          .configurationHash,
      },
    ],
  };
}

test("pack-only award command preserves the requested mixed bundle and normalises its review", () => {
  const input = command();
  const parsed = ownerPackAwardCommand.parse(input);
  assert.equal(parsed.reference, "Launch promotion");
  assert.equal(
    parsed.lines.reduce((n, line) => n + line.quantity, 0),
    2,
  );
  assert.equal(
    parsed.lines.reduce((n, line) => n + line.quantity * line.size, 0),
    10,
  );
  assert.deepEqual(
    ownerPackAwardCommand.parse({
      ...input,
      lines: [...input.lines].reverse(),
    }),
    parsed,
  );
});

test("all Standard and Premium sizes can be awarded, with bounded positive quantities", () => {
  const input = command();
  for (const family of ["STANDARD", "PREMIUM"] as const) {
    for (const size of [1, 3, 9] as const) {
      const product = commercialPack("nfl", family, size);
      assert.equal(
        ownerPackAwardCommand.parse({
          ...input,
          reason: "PRIZE",
          lines: [
            {
              sport: "nfl",
              family,
              size,
              quantity: 1,
              configurationHash: product.configurationHash,
            },
          ],
        }).lines[0].size,
        size,
      );
    }
  }
  for (const quantity of [0, -1, 1.5, 21, Number.MAX_SAFE_INTEGER])
    assert.throws(() =>
      ownerPackAwardCommand.parse({
        ...input,
        lines: [{ ...input.lines[0], quantity }],
      }),
    );
});

test("award review cannot submit credits, selected cards, actor identity, duplicate products or unconfirmed bundles", () => {
  const input = command();
  for (const bad of [
    { ...input, actor: randomUUID() },
    { ...input, credits: 700 },
    { ...input, price: 0 },
    { ...input, confirmed: false },
    { ...input, member: "another-account" },
    { ...input, reason: "PAID_CONTEST" },
    { ...input, reference: "x" },
    { ...input, reference: "line\nbreak" },
    { ...input, lines: [] },
    { ...input, lines: [input.lines[0], input.lines[0]] },
    { ...input, lines: [{ ...input.lines[0], quantity: 20 }, input.lines[1]] },
    { ...input, lines: [{ ...input.lines[0], size: 5 }] },
    { ...input, lines: [{ ...input.lines[0], sport: "nba" }] },
    { ...input, lines: [{ ...input.lines[0], cards: [randomUUID()] }] },
    { ...input, lines: [{ ...input.lines[0], priceCredits: 0 }] },
  ])
    assert.throws(() => ownerPackAwardCommand.parse(bad));
});
