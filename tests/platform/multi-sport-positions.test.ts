import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SevenField } from "../../src/components/seven-field";
import { sportConfigurations } from "../../src/core/sport-configuration";
import { autoSelect } from "../../src/core/lineup-auto-select";
import { sevenIssues } from "../../src/core/nfl-seven";
import { sandboxConfig } from "../fixtures/multi-sport-db";
for (const sport of Object.values(sportConfigurations).filter(
  (s) => s.id !== "nfl",
))
  test(`${sport.label}: dual eligibility, sport isolation, exact saved slots and historical format fallback`, () => {
    const cfg = sandboxConfig(sport);
    const cards = cfg.slots.map((s, i) => ({
      id: `qa:${i}`,
      player_id: `qa:p${i}`,
      sport: sport.id,
      tier: "CORE",
      position: s.positions[0],
      eligible_positions: s.positions,
      status: "active",
      listed: false,
      value: 100 + i,
    }));
    // Provider primary position differs, but verified eligibility contains the slot.
    cards[0] = {
      ...cards[0],
      position: "VERIFIED-OTHER",
      eligible_positions: [cfg.slots[0].positions[0]],
    };
    const choice = autoSelect(
      [
        ...cards,
        { ...cards[0], id: "wrong-sport", sport: "nfl", value: 999999 },
      ],
      "OPEN",
      [],
      cfg,
    );
    assert.equal(choice.picks.length, cfg.slots.length);
    assert.equal(
      choice.picks.some((p) => p.card === "wrong-sport"),
      false,
    );
    assert.deepEqual(
      sevenIssues("OPEN", choice.picks, cards, true, cfg).errors,
      [],
    );
    const assigned = new Map(choice.picks.map((p) => [p.slot, p.card]));
    const field = renderToStaticMarkup(
      createElement(SevenField, {
        sport: sport.id,
        list: true,
        label: "QA saved",
        slots: [...cfg.slots].reverse(),
        children: (s) => assigned.get(s.id),
      }),
    );
    for (const p of choice.picks)
      assert(field.includes(`data-slot="${p.slot}"`));
    assert.equal((field.match(/data-slot=/g) ?? []).length, cfg.slots.length);
    const old = renderToStaticMarkup(
      createElement(SevenField, {
        sport: sport.id,
        list: true,
        label: "QA history",
        slots: [{ id: "LEGACY1" }],
        children: () => "original-card",
      }),
    );
    assert(old.includes('data-slot="LEGACY1"'));
    assert(old.includes("original-card"));
  });
