import type { CapacitorConfig } from "@capacitor/cli";
import { resolveAndroidTarget } from "./scripts/android-preview-config.mjs";
import brand from "./src/brand/brand-tokens.json";

const target = resolveAndroidTarget();
const config: CapacitorConfig = {
  appId:
    target.mode === "store-internal"
      ? process.env.DOCKED_STORE_PLATFORM === "ios"
        ? target.manifest.appleBundleId
        : target.manifest.applicationId
      : "au.com.docked.app",
  appName:
    target.mode === "store-internal"
      ? "Docked"
      : target.mode === "beta"
        ? "Docked Beta"
        : "Docked Preview",
  webDir: target.webDir,
  loggingBehavior: "none",
  backgroundColor: brand.colors.navy,
  zoomEnabled: true,
  ios: {
    path: "ios",
    scheme: "App",
    contentInset: "automatic",
    webContentsDebuggingEnabled: false,
  },
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
    SystemBars: { insetsHandling: "css", style: "DARK", hidden: false },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      launchFadeOutDuration: 150,
      backgroundColor: brand.colors.navy,
      showSpinner: false,
    },
  },
};
export default config;
