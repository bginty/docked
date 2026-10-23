/** Offline review only. No credentials, database, inventory issuance or deployment. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  paidPackOffers,
  paidPackWeights,
} from "../src/core/paid-pack-catalogue";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../src/core/sport-configuration";
import { sandboxLineupConfiguration } from "../src/core/sport-sandbox-configuration";
async function main() {
  const migration = "20261023092404_sport_social_and_pack_entitlements.sql";
  const sql = await readFile(`supabase/migrations/${migration}`, "utf8");
  const plan = {
    status: "REVIEW_ONLY_NOT_DEPLOYED",
    migration,
    sha256: createHash("sha256").update(sql).digest("hex"),
    customerSports: ["nfl", "afl", "nrl"],
    nba: "hidden; data retained",
    products: ["nfl", "afl", "nrl"].flatMap((sport) =>
      paidPackOffers.map((p) => ({
        ...p,
        id:
          sport === "nfl"
            ? p.id
            : `${p.type.toLowerCase()}-${p.cards}-${sport}-real-roster-beta-v1`,
        sport,
        weightsBasisPoints: paidPackWeights[p.type],
        coreExcluded: true,
        inventory:
          sport === "nfl"
            ? "Existing NFL policy unchanged"
            : "Non-permanent authorised beta inventory only",
        change:
          sport === "nfl" || p.cards === 9
            ? "Preserve existing immutable product"
            : "Register new variant after review",
      })),
    ),
    configurations: [aflConfiguration, nrlConfiguration].map((s) => ({
      sport: s.id,
      slots: s.slots,
      configuredTestCap: sandboxLineupConfiguration(s).salaryCap,
      unit: "QA units, not fantasy dollars",
      minimumAllCoreCost: s.slots.length * 100,
      approvedDollarCap: s.salaryCap,
      prizes: "Unconfigured; no awards",
      seasonAggregation: "Unconfigured; no inferred season table",
    })),
    weekly: {
      sports: ["afl", "nrl"],
      enabledByMigration: false,
      intervalSeconds: 604800,
      cards: 4,
      tier: "CORE",
      initialAnchor:
        "First eligible server reconciliation after programme activation",
      overdue:
        "Catch up each earned cycle, at most 500 per reconciliation; resume next worker run",
      scheduler:
        "Reuse sports_feed.weekly_core_job() and existing one-minute cron; inspect before changing",
      openingResetsSchedule: false,
    },
    approvals: [
      "Deploy application and reviewed migration after target backup and compatibility rehearsal",
      "Register additional AFL/NRL 1/3-card beta products without changing existing versions",
      "Enable AFL/NRL weekly starter programmes with recorded authority; retain current NFL schedule",
    ],
    forbiddenChanges: [
      "No public registration",
      "No permanent card issuance",
      "No commercial feed activation",
      "No NFL scoring or historical result changes",
      "No wallet adjustment",
      "No prize enablement",
    ],
  };
  await mkdir("docs/qa/three-sport-parity", { recursive: true });
  await writeFile(
    "docs/qa/three-sport-parity/release-plan.json",
    JSON.stringify(plan, null, 2) + "\n",
  );
  console.log("Prepared 18-product review plan; no hosted actions performed.");
}
void main();
