import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { preserveAndroidApks } from "../../scripts/preserve-android-apks.mjs";

test("APK archive survives a cleared Gradle output and refuses corrupted prior copies", () => {
  const temporaryRoot = path.resolve("tmp");
  mkdirSync(temporaryRoot, { recursive: true });
  const fixture = mkdtempSync(path.join(temporaryRoot, "apk-preservation-"));
  try {
    const archive = path.join(fixture, "preserved");
    const inputs = [
      ["preview", "fixture-v2.apk", "Isolated v2 test bytes."],
      ["preview", "fixture-v3.apk", "Different v3 test bytes."],
      ["debug", "fixture-v1.apk", "Isolated debug test bytes."],
    ] as const;
    const outputs = ["preview", "debug"].map((variant) =>
      path.join(fixture, variant),
    );
    const populate = () => {
      for (const [variant, filename, bytes] of inputs) {
        const output = path.join(fixture, variant);
        mkdirSync(output, { recursive: true });
        writeFileSync(path.join(output, filename), bytes);
      }
    };
    populate();
    const saved = outputs.flatMap((output) =>
      preserveAndroidApks(output, archive),
    );
    assert.equal(saved.length, 3);
    for (const output of outputs) {
      assert.ok(path.resolve(output).startsWith(fixture + path.sep));
      rmSync(output, { recursive: true });
    }
    for (const [, filename, bytes] of inputs) {
      assert.equal(
        readFileSync(
          saved.find((record) => record.filename === filename)!.path,
          "utf8",
        ),
        bytes,
      );
    }
    populate();
    assert.deepEqual(
      outputs.flatMap((output) => preserveAndroidApks(output, archive)),
      saved,
    );
    writeFileSync(saved[0].path, "corrupt");
    assert.throws(
      () => outputs.flatMap((output) => preserveAndroidApks(output, archive)),
      /hash mismatch; build stopped/,
    );
  } finally {
    assert.ok(path.resolve(fixture).startsWith(temporaryRoot + path.sep));
    rmSync(fixture, { recursive: true });
  }
});
