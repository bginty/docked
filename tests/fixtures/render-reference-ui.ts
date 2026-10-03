import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EdgeCard } from "../../src/components/edge-card";
import { referenceTip } from "./reference-ui";
const render = (tip: typeof referenceTip) =>
  renderToStaticMarkup(
    createElement(EdgeCard, {
      tip,
      now: Date.parse("2026-10-03T12:01:15Z"),
      detail: true,
    }),
  );
process.stdout.write(
  JSON.stringify({
    ready: render(referenceTip),
    missing: render({
      ...referenceTip,
      current_market_reference: null,
      display_status: "suspended",
    }),
    legacy: render({ ...referenceTip, pricing_model: "legacy_bookmaker_v1" }),
  }),
);
