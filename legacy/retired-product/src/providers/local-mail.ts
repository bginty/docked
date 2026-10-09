import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { hash } from "@/core/pricing";
import type { EmailProvider } from "./contracts";
/** Local inspection sink only; never opens a network connection. */
export class LocalMailSink implements EmailProvider {
  constructor(private readonly directory = "private-data/mail") {}
  async send(message: Parameters<EmailProvider["send"]>[0]) {
    if (
      process.env.APP_ENV === "production" ||
      !/@[^@]+\.(test|invalid)$/.test(message.to)
    )
      throw new Error(
        "Local sink requires a reserved test/invalid recipient and non-production environment",
      );
    const directory = path.resolve(this.directory);
    await mkdir(directory, { recursive: true });
    const id = hash(message.idempotencyKey),
      file = path.join(directory, `${id}.json`);
    const body = JSON.stringify(
      { label: "LOCAL TEST MESSAGE — NEVER SENT", ...message },
      null,
      2,
    );
    try {
      await writeFile(file, body, { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if ((await readFile(file, "utf8")) !== body)
        throw new Error("Idempotency key payload mismatch");
    }
    return { id: `local-only:${id}` };
  }
}
