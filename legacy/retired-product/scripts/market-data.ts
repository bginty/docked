import {
  ingestCurrentMarketData,
  purgeExpiredMarketData,
} from "../src/server/market-data";
import { marketDataEnvironment } from "../src/core/market-data-environment";
import { oddsApiCredential } from "../src/providers/credentials";
async function main() {
  if (process.argv[2] === "--status") {
    const configured =
      process.env.MARKET_DATA_PROVIDER === "odds-papi"
        ? !!process.env.ODDSPAPI_API_KEY?.trim()
        : !!oddsApiCredential(process.env);
    console.log(
      JSON.stringify({
        status: !configured
          ? "NOT_CONFIGURED"
          : marketDataEnvironment(process.env)
            ? "REVIEW_DATABASE_AUTHORITY"
            : "DISABLED",
        pollingEnabled: marketDataEnvironment(process.env),
        publicationEnabled: false,
      }),
    );
    return;
  }
  if (process.argv[2] === "--purge-expired") {
    console.log(JSON.stringify(await purgeExpiredMarketData()));
    return;
  }
  if (process.argv[2] !== "--sync-authorised-preview")
    throw new Error("Explicit market-data-only preview invocation required");
  console.log(JSON.stringify(await ingestCurrentMarketData()));
}
main().catch(() => {
  console.error(
    "Market-data operation stopped by a configuration, rights, quota or runtime guard. Credentials and provider payloads are not printed.",
  );
  process.exitCode = 1;
});
