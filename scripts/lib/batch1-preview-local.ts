/** Isolated schema/fixture rehearsal. No network, no customer rows or credentials. */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { Duplex } from "node:stream";
import postgres from "postgres";
export const syntheticTarget = "docked-batch1-synthetic-20261116";
export function syntheticDatabase(runtime = false) {
  const cfg = JSON.parse(
    execFileSync("docker", ["inspect", syntheticTarget], {
      windowsHide: true,
    }).toString(),
  )[0];
  assert.equal(cfg.HostConfig.NetworkMode, "none");
  assert.equal(Object.keys(cfg.HostConfig.PortBindings ?? {}).length, 0);
  return postgres({
    username: runtime ? "docked_pack_acceptance" : "postgres",
    database: "postgres",
    max: runtime ? 8 : 1,
    prepare: false,
    ssl: false,
    connect_timeout: 20,
    onnotice: () => {},
    connection: { options: "-c jit=off -c work_mem=3500kB" },
    socket: () => {
      const p = spawn(
        "docker",
        ["exec", "-i", syntheticTarget, "nc", "-n", "127.0.0.1", "5432"],
        { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
      );
      const socket = new Duplex({
        read() {
          p.stdout.resume();
        },
        write(chunk, encoding, done) {
          p.stdin.write(chunk, encoding, done);
        },
        final(done) {
          p.stdin.end(done);
        },
      });
      p.stdout.on("data", (c) => {
        if (!socket.push(c)) p.stdout.pause();
      });
      p.stdout.on("end", () => socket.push(null));
      p.stdout.on("error", (e) => socket.destroy(e));
      p.stdin.on("error", (e) => socket.destroy(e));
      p.stderr.resume();
      p.on("error", (e) => socket.destroy(e));
      p.on("exit", (code) => {
        if (code && !socket.destroyed)
          socket.destroy(Error("Synthetic database transport stopped"));
      });
      Object.defineProperty(socket, "readyState", {
        get: () => (socket.destroyed ? "closed" : "open"),
      });
      socket.on("close", () => {
        if (p.exitCode === null) p.kill();
      });
      return socket;
    },
  } as postgres.Options<Record<string, never>>);
}
