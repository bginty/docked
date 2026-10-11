import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import packet from "../../config/friends-policy-content.json";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

test("friends policy digest matches exact versioned sources and preserves qualified privacy commitments", () => {
  for (const d of packet.documents) {
    const text = readFileSync(
      `docs/policies/${packet.version}/${d.id}.md`,
      "utf8",
    ).replaceAll("\r\n", "\n");
    assert.equal(d.text, text);
    assert.equal(d.sha256, hash(text));
    assert.doesNotMatch(
      text,
      /Docked Edge|market reference|fair odds|Edge Signal|BUILT FOR AN EDGE|\[VERIFY/i,
    );
  }
  assert.equal(
    packet.packetDigest,
    hash(
      packet.documents
        .map((d) => d.id + ":" + d.sha256)
        .sort()
        .join("\n") + "\n",
    ),
  );
  const privacy = packet.documents.find((d) => d.id === "privacy")!.text;
  assert.match(
    privacy,
    /We have not verified this mailbox's data-at-rest geography/,
  );
  assert.match(
    privacy,
    /do not promise immediate or guaranteed complete provider erasure/,
  );
  assert.match(privacy, /active mailbox 12 months/);
});
