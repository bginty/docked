import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResearchModelBoundary } from "../../src/components/research-file";
test("retained model evidence does not inherit the missing editorial-data warning", () => {
  const retained = renderToStaticMarkup(
    createElement(ResearchModelBoundary, { modelObservationAvailable: true }),
  );
  assert.match(retained, /OBSERVATION RETAINED/);
  assert.match(retained, /unvalidated/);
  assert.doesNotMatch(retained, /MODEL BLOCKED/);
  const absent = renderToStaticMarkup(createElement(ResearchModelBoundary, {}));
  assert.match(absent, /MODEL BLOCKED/);
  assert.doesNotMatch(absent, /OBSERVATION RETAINED/);
});
