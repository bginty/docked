import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PaidLaunchHome } from "../../src/components/paid-launch-home";

test("closed launch landing offers no registration or beta-advantage promises", () => {
  const html = renderToStaticMarkup(
    createElement(PaidLaunchHome, { canRegister: false }),
  );
  assert(!html.includes('href="/app/signup"'));
  assert.match(html, /registration is not open yet/);
  assert(
    !/free Starter|earn daily|Trade with fellow|invitation-only beta|fictional player/i.test(
      html,
    ),
  );
  assert.match(html, /href="\/app\/login"/);
  assert.match(html, /Beta credits, cards and packs do not transfer/);
});

test("paid launch landing preserves product/pack prices and clear exclusions", () => {
  const html = renderToStaticMarkup(
    createElement(PaidLaunchHome, { canRegister: true }),
  );
  assert.match(html, /href="\/app\/signup"/);
  for (const text of [
    "A$49 for 4,900",
    "A$99 for 9,900",
    "including GST",
    "1 card for 100",
    "3 for 300",
    "9 for 700",
    "1 card for 700",
    "3 for 1,900",
    "9 for 5,000",
    "4,900-credit purchase alone does not cover",
    "NFL",
    "AFL",
    "NRL",
    "18 or older",
    "Australian mobile",
    "Marketplace trading and swaps are unavailable",
    "Practice competitions",
    "does not claim endorsement",
  ])
    assert(html.includes(text), text);
  assert(!html.includes("NBA"));
  for (const href of [
    "/commercial-policy",
    "/refund-policy",
    "/privacy",
    "mailto:support@docked.com.au",
  ])
    assert(html.includes(`href="${href}"`));
});
