import type { CapacitorConfig } from "@capacitor/cli";
import { resolveAndroidTarget } from "./scripts/android-preview-config.mjs";

const target = resolveAndroidTarget();
const config: CapacitorConfig = {
  appId: "au.com.docked.app",
  appName: "Docked Preview",
  webDir: target.webDir,
  loggingBehavior: "none",
  backgroundColor: "#f7f7ef",
  zoomEnabled: true,
  android: {
    path: "android",
    allowMixedContent: false,
    useLegacyBridge: false,
    webContentsDebuggingEnabled: target.inspect,
  },
  server: {
    androidScheme: "https",
    errorPath: "offline.html",
    ...(target.entryUrl
      ? { url: target.entryUrl, cleartext: target.cleartext }
      : {}),
  },
  plugins: {
    CapacitorHttp: { enabled: false },
    CapacitorCookies: { enabled: false },
    SystemBars: { insetsHandling: "css", style: "LIGHT", hidden: false },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#142b35",
      showSpinner: false,
    },
  },
};
export default config;
