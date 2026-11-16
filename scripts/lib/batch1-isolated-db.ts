import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { Duplex } from "node:stream";
import postgres from "postgres";

// This target uses tmpfs. Stopping it erases the restore: restore the authenticated
// archive into a new target instead of treating a restarted empty cluster as data.
export const batch1Target = "docked-commercial-restore-20261116a-attempt-3";
export const batch1Notices: string[] = [];
export const batch1Plans: unknown[] = [];
// Aggregate transport counters only; never store query text, parameters or rows.
export const batch1WireTraffic = { sentBytes: 0, receivedBytes: 0, queries: 0 };
/** PostgreSQL wire protocol over Docker stdin/stdout, through the container's
 * private loopback. No host port, network attachment, URL or credential input.
 */
export function batch1Database(database = "batch1", max = 1, runtime = false) {
  assert(["postgres", "batch1"].includes(database));
  const [config] = JSON.parse(
    execFileSync("docker", ["inspect", batch1Target], {
      windowsHide: true,
    }).toString(),
  );
  assert.equal(config.HostConfig.NetworkMode, "none");
  assert.equal(Object.keys(config.HostConfig.PortBindings ?? {}).length, 0);
  return postgres({
    database,
    username: "postgres",
    password: "",
    ssl: false,
    max,
    // Read-only Production inspection on 16 Nov: jit=off, work_mem=3500kB.
    // Logical backups omit these runtime settings. Match both benchmark phases.
    connection: {
      options: `-c jit=off -c work_mem=3500kB${runtime ? " -c role=docked_beta_app" : ""}`,
    },
    prepare: false,
    debug: () => {
      batch1WireTraffic.queries++;
    },
    idle_timeout: 10,
    connect_timeout: 30,
    onnotice: (notice: postgres.Notice) => {
      if (notice.message.startsWith("BATCH1_PROFILE:"))
        batch1Notices.push(notice.message);
      if (
        notice.message.startsWith("duration:") &&
        notice.message.includes("plan:")
      ) {
        const plan = JSON.parse(
          notice.message.slice(notice.message.indexOf("plan:") + 5),
        );
        const safe = (p: any): any =>
          Object.fromEntries(
            Object.entries(p)
              .filter(([k]) =>
                [
                  "Plan",
                  "Plans",
                  "Node Type",
                  "Relation Name",
                  "Index Name",
                  "Actual Startup Time",
                  "Actual Total Time",
                  "Actual Rows",
                  "Actual Loops",
                  "Rows Removed by Filter",
                  "Shared Hit Blocks",
                  "Temp Read Blocks",
                  "Temp Written Blocks",
                ].includes(k),
              )
              .map(([k, v]) => [
                k,
                k === "Plans"
                  ? (v as any[]).map(safe)
                  : k === "Plan"
                    ? safe(v)
                    : v,
              ]),
          );
        batch1Plans.push({
          duration: notice.message.match(/^duration: ([\d.]+)/)?.[1],
          queryKind: String(plan["Query Text"]).slice(0, 100),
          ...safe(plan),
        });
      }
    },
    socket: () => {
      const child = spawn(
        "docker",
        ["exec", "-i", batch1Target, "nc", "-n", "127.0.0.1", "5432"],
        { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
      );
      const socket = new Duplex({
        read() {
          child.stdout.resume();
        },
        write(chunk, encoding, done) {
          batch1WireTraffic.sentBytes += Buffer.byteLength(chunk, encoding);
          child.stdin.write(chunk, encoding, done);
        },
        final(done) {
          child.stdin.end(done);
        },
      });
      child.stdout.on("data", (chunk) => {
        batch1WireTraffic.receivedBytes += chunk.length;
        if (!socket.push(chunk)) child.stdout.pause();
      });
      child.stdout.on("end", () => socket.push(null));
      child.stdout.on("error", (error) => socket.destroy(error));
      child.stdin.on("error", (error) => socket.destroy(error));
      Object.defineProperty(socket, "readyState", {
        get: () => (socket.destroyed ? "closed" : "open"),
      });
      child.stderr.resume();
      child.on("error", (error) => socket.destroy(error));
      child.on("exit", (code) => {
        if (code && !socket.destroyed)
          socket.destroy(Error("Isolated database transport stopped"));
      });
      socket.on("close", () => {
        if (child.exitCode === null) child.kill();
      });
      return socket;
    },
  } as postgres.Options<Record<string, never>>);
}
