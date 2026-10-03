import type { CapacitorConfig } from "@capacitor/cli";

const preview = process.env.CAPACITOR_PREVIEW_SERVER;
const inspect = process.env.CAPACITOR_PREVIEW_DEBUGGING === "1";
if (inspect && preview !== "http://localhost:3000")
  throw new Error(
    "WebView inspection requires the explicit local development attachment.",
  );
if (preview && preview !== "http://localhost:3000")
  throw new Error(
    "Android development attachment accepts only http://localhost:3000 through adb reverse.",
  );
const config: CapacitorConfig = {
  appId: "au.com.docked.app",
  appName: "Docked",
  webDir: "mobile/www",
  loggingBehavior: "none",
  backgroundColor: "#f7f7ef",
  zoomEnabled: true,
  android: {
    path: "android",
    allowMixedContent: false,
    useLegacyBridge: false,
    webContentsDebuggingEnabled: inspect,
  },
  server: {
    androidScheme: "https",
    errorPath: "offline.html",
    ...(preview ? { url: preview, cleartext: true } : {}),
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
