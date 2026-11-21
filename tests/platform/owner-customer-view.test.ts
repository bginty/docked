import assert from "node:assert/strict";
import test from "node:test";
import {
  activeOwnerCustomerView,
  ownerViewBinding,
} from "../../src/core/owner-view";
import { postBetaOwnerDestination } from "../../src/core/post-beta-owner";
import { nativeSessionDestination } from "../../src/core/native-navigation";

test("a selected public Owner login follows ordinary routes, with no cross-account or cross-device preference", () => {
  for (const id of ["founder", "barry"]) {
    const binding = ownerViewBinding(id, "session-a");
    assert.equal(
      activeOwnerCustomerView(true, true, "aal2", binding, binding),
      true,
    );
    for (const other of [
      undefined,
      ownerViewBinding("member", "session-a"),
      ownerViewBinding(id, "session-b"),
    ])
      assert.equal(
        activeOwnerCustomerView(true, true, "aal2", binding, other),
        false,
      );
    assert.equal(
      activeOwnerCustomerView(false, true, "aal2", binding, binding),
      false,
    );
    assert.equal(
      activeOwnerCustomerView(true, false, "aal2", binding, binding),
      false,
    );
    assert.equal(
      activeOwnerCustomerView(true, true, "aal1", binding, binding),
      false,
    );
    assert.equal(
      postBetaOwnerDestination({
        postBetaOwner: true,
        customerView: true,
        aal: "aal2",
      }),
      null,
    );
    assert.match(
      postBetaOwnerDestination({
        postBetaOwner: true,
        customerView: true,
        aal: "aal1",
      })!,
      /^\/mfa/,
    );
    for (const tab of ["play", "cards", "packs", "market", "social", "profile"])
      assert.equal(
        nativeSessionDestination(
          200,
          { authenticated: true, onboardingRequired: false },
          "/fantasy/" + tab,
        ),
        null,
      );
  }
});
